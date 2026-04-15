"""
NBA Stats Service
Uses the official nba_api library which wraps stats.nba.com endpoints.
Completely free, no API key needed.
"""
import asyncio
from functools import lru_cache
from typing import Optional, Dict, Any, List
from datetime import datetime
import statistics


class NBAStatsService:
    def __init__(self):
        self._player_cache: Dict[str, Any] = {}
        self._season_stats_cache: tuple = (None, 0.0)  # (DataFrame, timestamp)
        self._roster_cache: Dict[str, tuple] = {}       # team_name → ([names], timestamp)

    async def get_todays_games(self) -> List[Dict]:
        """Fetch today's NBA schedule."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._fetch_todays_games)

    def _fetch_todays_games(self) -> List[Dict]:
        try:
            from nba_api.live.nba.endpoints import scoreboard
            board = scoreboard.ScoreBoard()
            games_data = board.get_dict()
            games = []
            for game in games_data.get("scoreboard", {}).get("games", []):
                status = game.get("gameStatusText", "")
                if "Final" in status or "final" in status:
                    continue
                games.append({
                    "game_id": game.get("gameId"),
                    "home_team": game.get("homeTeam", {}).get("teamName"),
                    "away_team": game.get("awayTeam", {}).get("teamName"),
                    "home_city": game.get("homeTeam", {}).get("teamCity"),
                    "away_city": game.get("awayTeam", {}).get("teamCity"),
                    "status": status,
                    "game_time": game.get("gameEt"),
                })

            if not games:
                games = self._fetch_upcoming_games()

            return games
        except Exception as e:
            return [{"error": str(e), "message": "Could not fetch today's games"}]

    def _fetch_upcoming_games(self) -> List[Dict]:
        """Fetch next scheduled NBA games using ScoreboardV3."""
        try:
            from nba_api.stats.endpoints import scoreboardv3
            from datetime import datetime, timedelta
            import time

            # Try today first, then next 3 days
            for days_ahead in range(0, 4):
                date = (datetime.now() + timedelta(days=days_ahead)).strftime("%m/%d/%Y")
                time.sleep(0.6)
                try:
                    board = scoreboardv3.ScoreboardV3(game_date=date, league_id="00")
                    data = board.get_dict()
                    game_dates = data.get("scoreboard", {}).get("games", [])
                    if not game_dates:
                        # fallback to dataframe
                        df = board.get_data_frames()[0]
                        if df.empty:
                            continue
                        games = []
                        for _, row in df.iterrows():
                            games.append({
                                "game_id": str(row.get("GAME_ID", "")),
                                "home_team": str(row.get("HOME_TEAM_NAME", row.get("HOME_TEAM_ABBREVIATION", ""))),
                                "away_team": str(row.get("AWAY_TEAM_NAME", row.get("VISITOR_TEAM_ABBREVIATION", ""))),
                                "home_city": str(row.get("HOME_TEAM_CITY", "")),
                                "away_city": str(row.get("AWAY_TEAM_CITY", "")),
                                "status": str(row.get("GAME_STATUS_TEXT", f"Scheduled {date}")),
                                "game_time": date,
                            })
                        if games:
                            return games
                    else:
                        games = []
                        for game in game_dates:
                            status = game.get("gameStatusText", "")
                            if "Final" in status:
                                continue
                            games.append({
                                "game_id": game.get("gameId", ""),
                                "home_team": game.get("homeTeam", {}).get("teamName", ""),
                                "away_team": game.get("awayTeam", {}).get("teamName", ""),
                                "home_city": game.get("homeTeam", {}).get("teamCity", ""),
                                "away_city": game.get("awayTeam", {}).get("teamCity", ""),
                                "status": status,
                                "game_time": game.get("gameTimeUTC", date),
                            })
                        if games:
                            return games
                except Exception:
                    continue

            # Last resort: use ScoreboardV2 with team ID mapping
            return self._fetch_with_scoreboardv2()
        except Exception:
            return []

    def _fetch_with_scoreboardv2(self) -> List[Dict]:
        """Fallback using ScoreboardV2 with team ID to name mapping."""
        TEAM_MAP = {
            1610612737: ("Hawks", "Atlanta"), 1610612738: ("Celtics", "Boston"),
            1610612739: ("Cavaliers", "Cleveland"), 1610612740: ("Pelicans", "New Orleans"),
            1610612741: ("Bulls", "Chicago"), 1610612742: ("Mavericks", "Dallas"),
            1610612743: ("Nuggets", "Denver"), 1610612744: ("Warriors", "Golden State"),
            1610612745: ("Rockets", "Houston"), 1610612746: ("Clippers", "LA"),
            1610612747: ("Lakers", "Los Angeles"), 1610612748: ("Heat", "Miami"),
            1610612749: ("Bucks", "Milwaukee"), 1610612750: ("Timberwolves", "Minnesota"),
            1610612751: ("Nets", "Brooklyn"), 1610612752: ("Knicks", "New York"),
            1610612753: ("Magic", "Orlando"), 1610612754: ("Pacers", "Indiana"),
            1610612755: ("76ers", "Philadelphia"), 1610612756: ("Suns", "Phoenix"),
            1610612757: ("Trail Blazers", "Portland"), 1610612758: ("Kings", "Sacramento"),
            1610612759: ("Spurs", "San Antonio"), 1610612760: ("Thunder", "Oklahoma City"),
            1610612761: ("Raptors", "Toronto"), 1610612762: ("Jazz", "Utah"),
            1610612763: ("Grizzlies", "Memphis"), 1610612764: ("Wizards", "Washington"),
            1610612765: ("Pistons", "Detroit"), 1610612766: ("Hornets", "Charlotte"),
        }
        try:
            from nba_api.stats.endpoints import scoreboardv2
            from datetime import datetime
            import time
            date = datetime.now().strftime("%m/%d/%Y")
            time.sleep(0.6)
            board = scoreboardv2.ScoreboardV2(game_date=date)
            df = board.get_data_frames()[0]
            if df.empty:
                return []
            games = []
            for _, row in df.iterrows():
                status = str(row.get("GAME_STATUS_TEXT", ""))
                if "Final" in status:
                    continue
                home_id = int(row.get("HOME_TEAM_ID", 0))
                away_id = int(row.get("VISITOR_TEAM_ID", 0))
                home_name, home_city = TEAM_MAP.get(home_id, ("Unknown", ""))
                away_name, away_city = TEAM_MAP.get(away_id, ("Unknown", ""))
                games.append({
                    "game_id": str(row.get("GAME_ID", "")),
                    "home_team": home_name,
                    "away_team": away_name,
                    "home_city": home_city,
                    "away_city": away_city,
                    "status": status,
                    "game_time": date,
                })
            return games
        except Exception:
            return []

    async def get_player_stats(self, player_name: str, last_n_games: int = 10) -> Optional[Dict]:
        """Get comprehensive player stats."""
        cache_key = f"{player_name}_{last_n_games}"
        if cache_key in self._player_cache:
            return self._player_cache[cache_key]

        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None, self._fetch_player_stats, player_name, last_n_games
        )
        if result:
            self._player_cache[cache_key] = result
        return result

    def _fetch_player_stats(self, player_name: str, last_n_games: int) -> Optional[Dict]:
        try:
            from nba_api.stats.static import players
            from nba_api.stats.endpoints import (
                playergamelog, playerprofilev2, playerdashboardbygeneralsplits
            )
            import time

            # Find player ID
            all_players = players.get_players()
            player = next(
                (p for p in all_players
                 if p["full_name"].lower() == player_name.lower()),
                None
            )
            if not player:
                # Try partial match
                player = next(
                    (p for p in all_players
                     if player_name.lower() in p["full_name"].lower()),
                    None
                )
            if not player:
                return None

            player_id = player["id"]
            time.sleep(0.6)  # Respect rate limits

            # Dinamički odredi trenutnu NBA sezonu
            # NBA sezona počinje oktobra, završava juna
            # Okt-Dec → nova sezona (iste god), Jan-Sep → sezona prethodne god
            from datetime import datetime as dt
            now = dt.now()
            season_year = now.year if now.month >= 10 else now.year - 1
            current_season = f"{season_year}-{str(season_year + 1)[-2:]}"

            # Pokušaj tekuću sezonu
            gamelog = playergamelog.PlayerGameLog(
                player_id=player_id,
                season=current_season,
                season_type_all_star="Regular Season"
            )
            log_df = gamelog.get_data_frames()[0]

            # Fallback na prethodnu sezonu ako nema podataka
            if log_df.empty:
                prev = season_year - 1
                prev_season = f"{prev}-{str(prev + 1)[-2:]}"
                time.sleep(0.6)
                gamelog = playergamelog.PlayerGameLog(
                    player_id=player_id,
                    season=prev_season,
                    season_type_all_star="Regular Season"
                )
                log_df = gamelog.get_data_frames()[0]

            if log_df.empty:
                return None

            # Sortiraj po datumu — najnoviji mečevi prve (nba_api vraća descending ali osiguramo)
            if "GAME_DATE" in log_df.columns:
                try:
                    log_df["_sort_date"] = log_df["GAME_DATE"].apply(
                        lambda d: dt.strptime(d, "%b %d, %Y") if isinstance(d, str) else dt.min
                    )
                    log_df = log_df.sort_values("_sort_date", ascending=False).drop(columns=["_sort_date"])
                except Exception:
                    pass  # Ako parse ne uspe, ostavi originalni redosled

            # Poslednjih N mečeva
            recent = log_df.head(last_n_games)

            def safe_avg(col):
                if col in recent.columns and not recent[col].empty:
                    return round(float(recent[col].mean()), 1)
                return 0.0

            def safe_list(col):
                if col in recent.columns:
                    return [round(float(v), 1) for v in recent[col].tolist()]
                return []

            pts_list = safe_list("PTS")
            reb_list = safe_list("REB")
            ast_list = safe_list("AST")
            min_list = safe_list("MIN")

            # Trend detection (last 3 vs previous 7)
            def detect_trend(values: list) -> str:
                if len(values) < 6:
                    return "neutral"
                recent_3 = statistics.mean(values[:3])
                older = statistics.mean(values[3:])
                pct_diff = (recent_3 - older) / older * 100 if older > 0 else 0
                if pct_diff > 15:
                    return "hot"
                elif pct_diff < -15:
                    return "cold"
                return "neutral"

            # Season averages (use full log)
            season_pts = round(float(log_df["PTS"].mean()), 1) if "PTS" in log_df else 0
            season_reb = round(float(log_df["REB"].mean()), 1) if "REB" in log_df else 0
            season_ast = round(float(log_df["AST"].mean()), 1) if "AST" in log_df else 0

            # Home/away splits
            home_games = log_df[log_df["MATCHUP"].str.contains("vs.", na=False)]
            away_games = log_df[log_df["MATCHUP"].str.contains("@", na=False)]

            home_splits = {}
            away_splits = {}
            if not home_games.empty:
                home_splits = {
                    "pts": round(float(home_games["PTS"].mean()), 1),
                    "reb": round(float(home_games["REB"].mean()), 1),
                    "ast": round(float(home_games["AST"].mean()), 1),
                    "games": len(home_games)
                }
            if not away_games.empty:
                away_splits = {
                    "pts": round(float(away_games["PTS"].mean()), 1),
                    "reb": round(float(away_games["REB"].mean()), 1),
                    "ast": round(float(away_games["AST"].mean()), 1),
                    "games": len(away_games)
                }

            # Build game-by-game list for AI context
            games_detail = []
            for _, row in recent.iterrows():
                pra = float(row.get("PTS", 0)) + float(row.get("REB", 0)) + float(row.get("AST", 0))
                games_detail.append({
                    "date": str(row.get("GAME_DATE", "")),
                    "matchup": str(row.get("MATCHUP", "")),
                    "result": str(row.get("WL", "")),
                    "min": round(float(row.get("MIN", 0)), 0),
                    "pts": float(row.get("PTS", 0)),
                    "reb": float(row.get("REB", 0)),
                    "ast": float(row.get("AST", 0)),
                    "stl": float(row.get("STL", 0)),
                    "blk": float(row.get("BLK", 0)),
                    "to": float(row.get("TOV", 0)),
                    "fg_pct": round(float(row.get("FG_PCT", 0)) * 100, 1),
                    "fg3_pct": round(float(row.get("FG3_PCT", 0)) * 100, 1),
                    "ft_pct": round(float(row.get("FT_PCT", 0)) * 100, 1),
                    "plus_minus": float(row.get("PLUS_MINUS", 0)),
                    "pra": round(pra, 1)
                })

            return {
                "player_id": player_id,
                "player_name": player["full_name"],
                "team": str(log_df["MATCHUP"].iloc[0]).split(" ")[0] if not log_df.empty else "",
                "games_analyzed": last_n_games,
                "season_averages": {
                    "pts": season_pts,
                    "reb": season_reb,
                    "ast": season_ast,
                    "pra": round(season_pts + season_reb + season_ast, 1)
                },
                "averages_last_n": {
                    "pts": safe_avg("PTS"),
                    "reb": safe_avg("REB"),
                    "ast": safe_avg("AST"),
                    "stl": safe_avg("STL"),
                    "blk": safe_avg("BLK"),
                    "min": safe_avg("MIN"),
                    "fg_pct": round(float(recent["FG_PCT"].mean()) * 100, 1) if "FG_PCT" in recent else 0,
                    "pra": round(safe_avg("PTS") + safe_avg("REB") + safe_avg("AST"), 1)
                },
                "game_by_game": games_detail,
                "pts_last_n": pts_list,
                "reb_last_n": reb_list,
                "ast_last_n": ast_list,
                "home_splits": home_splits,
                "away_splits": away_splits,
                "recent_trend": detect_trend(pts_list),
                "games_above_pts_avg": sum(1 for p in pts_list if p > season_pts),
                "consistency_rating": max(0, round(
                    (1 - (statistics.stdev(pts_list) / season_pts if season_pts > 0 and len(pts_list) > 1 else 0)) * 100, 0
                )) if len(pts_list) > 1 else 50
            }

        except Exception as e:
            return {"error": str(e), "player_name": player_name}

    # ─── Roster fetching ───────────────────────────────────────────────────────

    async def get_team_active_players(self, team_name: str) -> List[str]:
        """
        Vraća aktuelni roster tima — samo igrači koji zapravo igraju
        (GP >= 5, MIN >= 15 po utakmici). Keširano 4h.
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._fetch_team_active_players, team_name)

    def _current_season(self) -> str:
        now = datetime.now()
        year = now.year if now.month >= 10 else now.year - 1
        return f"{year}-{str(year + 1)[-2:]}"

    def _get_team_abbreviation(self, team_name: str) -> Optional[str]:
        """Mapira naziv tima ('Lakers', 'Los Angeles Lakers', 'LAL') → NBA abbreviation."""
        from nba_api.stats.static import teams as nba_teams
        name_lower = team_name.lower().strip()
        for t in nba_teams.get_teams():
            if (t["nickname"].lower() == name_lower
                    or t["full_name"].lower() == name_lower
                    or t["abbreviation"].lower() == name_lower
                    or t["city"].lower() in name_lower):
                return t["abbreviation"]
        return None

    def _load_season_stats(self):
        """
        Jedan API poziv za SVE igrače u ligi — PerGame statistike.
        Kešira rezultat 4 sata. Ako je kesh svjež, odmah vraća.
        """
        import time as _time
        df, ts = self._season_stats_cache
        if df is not None and (_time.time() - ts) < 4 * 3600:
            return df

        from nba_api.stats.endpoints import leaguedashplayerstats
        import time

        season = self._current_season()
        print(f"[Roster] Fetchujem season stats za {season}...")
        time.sleep(0.6)
        endpoint = leaguedashplayerstats.LeagueDashPlayerStats(
            season=season,
            per_mode_detailed="PerGame",
        )
        df = endpoint.get_data_frames()[0]
        self._season_stats_cache = (df, _time.time())
        print(f"[Roster] Ucitano {len(df)} igraca iz NBA API")
        return df

    def _fetch_team_active_players(self, team_name: str) -> List[str]:
        """
        Filtrira aktuelni roster tima iz keširanih season stats.
        Kriterijumi: GP >= 5 i MIN >= 15 → isključuje povrijeđene,
        suspended igrače i end-of-bench koji nikad ne ulaze.
        """
        import time as _time

        cached = self._roster_cache.get(team_name)
        if cached:
            players, ts = cached
            if (_time.time() - ts) < 4 * 3600:
                return players

        abbr = self._get_team_abbreviation(team_name)
        if not abbr:
            print(f"[Roster] Nepoznat tim: '{team_name}'")
            return []

        try:
            df = self._load_season_stats()
            if df is None or df.empty:
                return []

            team_df = df[
                (df["TEAM_ABBREVIATION"] == abbr) &
                (df["GP"] >= 5) &
                (df["MIN"] >= 15)
            ].copy()

            # Sortiraj po minutima — starters i ključna rotacija prvi
            team_df = team_df.sort_values("MIN", ascending=False).head(12)
            players = team_df["PLAYER_NAME"].tolist()

            self._roster_cache[team_name] = (players, _time.time())
            print(f"[Roster] {team_name} ({abbr}): {len(players)} aktivnih igraca")
            return players

        except Exception as e:
            print(f"[Roster] Greska za '{team_name}': {e}")
            return []