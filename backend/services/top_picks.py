"""
Top Picks Service — prolazi SVE igrače sa SVIH mečeva, vraća max 10 best value bets.
Roster se povlači dinamički sa NBA API-ja (leaguedashplayerstats) — automatski
isključuje povrijeđene, suspended i igrače koji ne dobijaju minute.
"""
import asyncio
from typing import List, Dict, Any, Optional
from services.nba_stats import NBAStatsService
from services.odds_service import OddsAPIService
from services.ai_analyzer import AIAnalyzer
from services.context_enricher import ContextEnricher

PROP_TYPES = ["points", "rebounds", "assists", "pra"]

# Minimalni prag: confidence >= 65, value_rating mora biti "excellent" ili "good"
# Max 10 tipova — sortirani po score-u, 1 tip po igraču
MIN_CONFIDENCE = 65
ACCEPTED_VALUE_RATINGS = {"excellent", "good"}
MAX_PICKS = 10


class TopPicksService:
    def __init__(self):
        self.nba = NBAStatsService()
        self.odds = OddsAPIService()
        self.ai = AIAnalyzer()
        self.enricher = ContextEnricher()
        self._cache: Optional[List[Dict]] = None
        self._cache_time: float = 0

    async def get_top_picks(self, force_refresh: bool = False) -> List[Dict]:
        import time
        if not force_refresh and self._cache and (time.time() - self._cache_time < 1800):
            return self._cache

        # 1. Svi današnji mečevi
        games = await self.nba.get_todays_games()
        valid_games = [g for g in games if "error" not in g]

        if not valid_games:
            return []

        print(f"[TopPicks] {len(valid_games)} meceva danas")

        # 2. Odds API event IDs
        odds_games = await self.odds.get_todays_games_with_odds()
        event_map = self._build_event_map(valid_games, odds_games)

        matched = sum(1 for v in event_map.values() if v)
        print(f"[TopPicks] {matched}/{len(valid_games)} meceva matchovano na Odds API")

        # 3. Props za sve mečeve — 1 API poziv po meču
        all_game_props = {}
        for game in valid_games:
            home = game.get("home_team", "")
            away = game.get("away_team", "")
            event_id = event_map.get(f"{home}_{away}")
            if event_id:
                props = await self.odds.get_all_props_for_event(event_id)
                all_game_props[event_id] = props

        # 4. Dinamički roster za svaki tim koji igra danas
        #    leaguedashplayerstats se poziva jednom i kešira — svi timovi filtriraju iz tog cachea
        team_names = {
            name
            for game in valid_games
            for key in ("home_team", "away_team")
            if (name := game.get(key, ""))
        }
        roster_map: Dict[str, List[str]] = {}
        for team_name in team_names:
            players = await self.nba.get_team_active_players(team_name)
            roster_map[team_name] = players

        print(f"[TopPicks] Rostere fetchovano za {len(roster_map)} timova")

        # 5. Kandidati iz SVIH mečeva
        candidates = self._build_candidates(valid_games, event_map, all_game_props, roster_map)
        print(f"[TopPicks] {len(candidates)} kandidata za analizu")

        # 6. Batch analiza
        all_tips: List[Dict] = []
        batch_size = 8
        for i in range(0, len(candidates), batch_size):
            batch = candidates[i:i + batch_size]
            results = await asyncio.gather(
                *[self._analyze_candidate(c) for c in batch],
                return_exceptions=True
            )
            for r in results:
                if isinstance(r, list):
                    all_tips.extend(r)
            if i + batch_size < len(candidates):
                await asyncio.sleep(0.5)

        # 7. Sortiraj, filtriraj i vrati max 10 najsigurnijih
        quality_picks = self._score_and_filter(all_tips)
        print(f"[TopPicks] {len(quality_picks)} quality picks (conf >= {MIN_CONFIDENCE}, max {MAX_PICKS})")

        self._cache = quality_picks
        self._cache_time = time.time()
        return quality_picks

    def _build_event_map(self, games: List[Dict], odds_games: List[Dict]) -> Dict[str, str]:
        event_map = {}
        for game in games:
            home = game.get("home_team", "")
            away = game.get("away_team", "")
            for og in odds_games:
                oh = og.get("home_team", "")
                oa = og.get("away_team", "")
                home_match = home.lower() in oh.lower() or all(w in oh.lower() for w in home.lower().split())
                away_match = away.lower() in oa.lower() or all(w in oa.lower() for w in away.lower().split())
                if home_match and away_match:
                    event_map[f"{home}_{away}"] = og.get("event_id")
                    break
        return event_map

    def _build_candidates(
        self,
        games: List[Dict],
        event_map: Dict,
        all_game_props: Dict,
        roster_map: Dict[str, List[str]],
    ) -> List[Dict]:
        candidates = []
        seen_players = set()

        for game in games:
            if "error" in game:
                continue

            home = game.get("home_team", "")
            away = game.get("away_team", "")
            home_city = game.get("home_city", "")
            away_city = game.get("away_city", "")
            event_id = event_map.get(f"{home}_{away}")
            props = all_game_props.get(event_id, {}) if event_id else {}

            # Puno ime tima za UI — city + nickname dolaze direktno iz NBA API-ja
            home_full = f"{home_city} {home}".strip() or home
            away_full = f"{away_city} {away}".strip() or away

            game_time = game.get("status") or game.get("game_time", "")

            for team_name, is_home in [(home, True), (away, False)]:
                opponent_name = away if is_home else home
                opponent_city = away_city if is_home else home_city
                opponent_full = f"{opponent_city} {opponent_name}".strip() or opponent_name
                team_full = home_full if is_home else away_full

                # Dinamički roster — igrači koji su aktivni ove sezone
                players = roster_map.get(team_name, [])

                if not players:
                    print(f"[TopPicks] Prazna lista igraca za tim '{team_name}' — preskacemo")
                    continue

                for player in players:
                    if player in seen_players:
                        continue
                    seen_players.add(player)
                    candidates.append({
                        "player_name": player,
                        "team": team_full,
                        "team_short": team_name,
                        "opponent": opponent_full,
                        "opponent_short": opponent_name,
                        "event_id": event_id,
                        "game_id": game.get("game_id", ""),
                        "is_home": is_home,
                        "game_time": game_time,
                        "matchup": f"{home_full} vs {away_full}",
                        "props": props,
                    })

        return candidates

    async def _analyze_candidate(self, candidate: Dict) -> List[Dict]:
        player_name = candidate["player_name"]
        opponent = candidate["opponent"]
        props = candidate.get("props", {})
        game_id = candidate.get("game_id")
        team_short = candidate.get("team_short", "")
        is_home = candidate.get("is_home", True)

        # 1. Injury check — preskoči igrača koji ne igra danas
        injury_report = await self.enricher.get_injury_report(game_id) or {}
        player_status = injury_report.get(player_name.lower().strip(), "unknown")
        if player_status == "unknown" and injury_report:
            print(f"[TopPicks] {player_name} nije u injury reportu (game {game_id})")
        if player_status == "inactive":
            print(f"[TopPicks] {player_name} — inactive danas, preskacemo")
            return []

        # 2. B2B detekcija
        from datetime import datetime
        today_str = datetime.now().strftime("%Y-%m-%d")
        back_to_back = await self.enricher.is_back_to_back(team_short, today_str)

        try:
            stats = await self.nba.get_player_stats(player_name, last_n_games=10)
        except Exception:
            return []

        if not stats or "error" in stats:
            return []

        # Provjera recency — ako igrač nije igrao u zadnjih 14 dana,
        # vjerovatno je povrijeđen, suspendovan ili na IL → preskačemo
        game_log = stats.get("game_by_game", [])
        if game_log:
            last_date_str = game_log[0].get("date", "")
            if last_date_str:
                try:
                    from datetime import datetime, timedelta
                    last_game = datetime.strptime(last_date_str, "%b %d, %Y")
                    if datetime.now() - last_game > timedelta(days=14):
                        print(f"[TopPicks] {player_name} — posljednja utakmica {last_date_str} (>14 dana), preskacemo")
                        return []
                except Exception:
                    pass

        avgs = stats.get("averages_last_n", {})

        # Pripremi konfiguraciju za svaki prop tip
        prop_configs = []
        for prop_type in PROP_TYPES:
            stat_key = {"points": "pts", "rebounds": "reb", "assists": "ast", "pra": "pra"}.get(prop_type, "pts")
            avg_val = avgs.get(stat_key, 0)

            min_thresholds = {"points": 5, "rebounds": 2, "assists": 2, "pra": 10}
            if avg_val < min_thresholds.get(prop_type, 3):
                continue

            line = None
            odds_data = {}
            player_props = props.get(prop_type, {})

            player_data = player_props.get(player_name)
            if not player_data:
                last_name = player_name.split()[-1].lower()
                for pname, pdata in player_props.items():
                    if last_name in pname.lower():
                        player_data = pdata
                        break

            if player_data:
                line = player_data.get("line")
                bookie = player_data.get("bookmaker", "odds-api")
                odds_data = {bookie: {"over": player_data.get("over"), "under": player_data.get("under")}}

            if not line:
                season_avg = stats.get("season_averages", {}).get(stat_key, avg_val)
                line = round(season_avg * 0.95 * 2) / 2

            if not line or line <= 0:
                continue

            prop_configs.append((prop_type, line, avg_val, odds_data))

        if not prop_configs:
            return []

        # Svi prop tipovi za ovog igrača paralelno — 4x brže od sekvencijalnog
        analyses = await asyncio.gather(
            *[self.ai.analyze_prop(
                player_name=player_name,
                prop_type=pt,
                line=ln,
                stats=stats,
                opponent=opponent,
                is_home=is_home,
            ) for pt, ln, _, _ in prop_configs],
            return_exceptions=True
        )

        results = []
        for analysis, (prop_type, line, avg_val, odds_data) in zip(analyses, prop_configs):
            if isinstance(analysis, Exception):
                continue
            if analysis.get("recommendation") == "SKIP":
                continue
            # B2B penalizacija
            if back_to_back:
                analysis["confidence"] = max(0, analysis.get("confidence", 0) - 12)
                kf = analysis.get("key_factors", [])
                kf.append("B2B penalizacija (-12 confidence)")
                analysis["key_factors"] = kf
                rf = analysis.get("risk_factors", [])
                rf.append("Drugi meč za 24h — statistički lošije performanse")
                analysis["risk_factors"] = rf
            results.append({
                "player_name": player_name,
                "team": candidate["team"],
                "team_short": candidate["team_short"],
                "opponent": candidate["opponent"],
                "opponent_short": candidate["opponent_short"],
                "matchup": candidate["matchup"],
                "is_home": candidate["is_home"],
                "game_time": candidate["game_time"],
                "prop_type": prop_type,
                "line": line,
                "avg_last_10": avg_val,
                "recommendation": analysis.get("recommendation"),
                "confidence": analysis.get("confidence", 0),
                "reasoning": analysis.get("reasoning", ""),
                "value_rating": analysis.get("value_rating", "fair"),
                "key_factors": analysis.get("key_factors", []),
                "edge": analysis.get("edge", ""),
                "risk_factors": analysis.get("risk_factors", []),
                "odds": odds_data,
            })

        return results

    def _score_and_filter(self, tips: List[Dict]) -> List[Dict]:
        """
        Sortira i filtrira tipove po sigurnosti.
        - Prihvata value_rating: "excellent" ili "good"
        - Minimalna pouzdanost: conf >= MIN_CONFIDENCE (65)
        - Max 1 tip po igraču (najjači prop)
        - Max 2 igrača po utakmici (matchup) — samo najsigurniji iz svakog meča
        - Max MAX_PICKS (10) ukupno — najsigurniji tipovi iz SVIH mečeva
        - "Excellent" tipovi imaju prednost u score-u nad "good"
        """
        value_mult = {"excellent": 1.5, "good": 1.2, "fair": 1.0, "poor": 0.5, "skip": 0.0}

        filtered = [
            t for t in tips
            if t.get("recommendation") in ("OVER", "UNDER")
            and t.get("confidence", 0) >= MIN_CONFIDENCE
            and t.get("value_rating") in ACCEPTED_VALUE_RATINGS
        ]

        # Score = confidence × value multiplier (excellent > good)
        for tip in filtered:
            tip["_score"] = tip.get("confidence", 0) * value_mult.get(tip.get("value_rating", "fair"), 1.0)

        # Sortiraj od najsigurnijeg
        filtered.sort(key=lambda t: t["_score"], reverse=True)

        # Max 1 tip po igraču — uzmi najjači prop za svakog
        seen_players = set()
        per_player_tips = []
        for tip in filtered:
            if tip["player_name"] not in seen_players:
                seen_players.add(tip["player_name"])
                per_player_tips.append(tip)

        # Max 2 igrača po utakmici — biramo najsigurnije iz svakog meča
        # Zatim sortiramo sve zajedno po score-u i uzimamo globalno max MAX_PICKS
        game_player_counts: Dict[str, int] = {}
        unique_tips = []
        for tip in per_player_tips:
            matchup = tip.get("matchup", "unknown")
            count = game_player_counts.get(matchup, 0)
            if count < 2:
                game_player_counts[matchup] = count + 1
                unique_tips.append(tip)

        for tip in unique_tips:
            tip.pop("_score", None)

        # Max 10 — samo najsigurniji tipovi (već sortirani)
        return unique_tips[:MAX_PICKS]