"""
Live Stats Service
- Live rezultati mečeva sa sekundama (SSE stream + background poller)
- Live stats igrača tokom utakmice
- Provera da li je tip pogođen ili ne
"""
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime

# ── Shared cache za SSE stream ─────────────────────────────────────────────
_live_cache: Dict = {
    "games": [],
    "live_count": 0,
    "scheduled_count": 0,
    "final_count": 0,
    "ts": 0,           # unix timestamp poslednjeg update-a
}

async def start_live_poller():
    """
    Background task: pita NBA API svakih 5s dok ima live mečeva, inače 30s.
    Svi SSE klijenti čitaju iz _live_cache umesto da sami pozivaju API.
    """
    import time
    service = LiveStatsService()
    while True:
        try:
            games = await service.get_live_games()
            live       = [g for g in games if g.get("is_live")]
            scheduled  = [g for g in games if not g.get("is_live") and not g.get("is_final")]
            final      = [g for g in games if g.get("is_final")]
            _live_cache["games"]          = games
            _live_cache["live_count"]     = len(live)
            _live_cache["scheduled_count"]= len(scheduled)
            _live_cache["final_count"]    = len(final)
            _live_cache["ts"]             = time.time()
            interval = 3 if live else 30
        except Exception as e:
            print(f"[LivePoller] Greška: {e}")
            interval = 15
        await asyncio.sleep(interval)


class LiveStatsService:

    async def get_live_games(self) -> List[Dict]:
        """Vraća live rezultate svih mečeva koji se trenutno igraju."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._fetch_live_games)

    def _fetch_live_games(self) -> List[Dict]:
        """
        Strategija: ScoreboardV3 sa eksplicitnim ET datumom je PRIMARNI izvor
        (uvek vraca sve danasnje meceve ukljucujuci buduce).
        Live ScoreBoard se koristi samo za overlay realtime statusa/rezultata.
        """
        import time as _time

        # ── Korak 1: Primarni izvor — ScoreboardV3 sa tacnim ET datumom ──────
        games_by_id = {}
        try:
            from nba_api.stats.endpoints import scoreboardv3
            et_date = self._today_et()
            _time.sleep(0.4)
            board = scoreboardv3.ScoreboardV3(game_date=et_date, league_id="00")
            raw = board.get_dict().get("scoreboard", {}).get("games", [])
            for game in raw:
                gid = game.get("gameId", "")
                home = game.get("homeTeam", {})
                away = game.get("awayTeam", {})
                game_time_utc = game.get("gameTimeUTC", "")
                game_status = game.get("gameStatus", 1)
                games_by_id[gid] = {
                    "game_id": gid,
                    "home_team": home.get("teamName", ""),
                    "home_city": home.get("teamCity", ""),
                    "home_abbr": home.get("teamTricode", ""),
                    "home_score": home.get("score", 0),
                    "away_team": away.get("teamName", ""),
                    "away_city": away.get("teamCity", ""),
                    "away_abbr": away.get("teamTricode", ""),
                    "away_score": away.get("score", 0),
                    "status": game.get("gameStatusText", ""),
                    "game_status": game_status,
                    "period": game.get("period", 0),
                    "game_clock": game.get("gameClock", ""),
                    "game_time_utc": game_time_utc,
                    "sr_time": self._utc_to_sr(game_time_utc),
                    "is_live": game_status == 2,
                    "is_final": game_status == 3,
                }
        except Exception as e:
            print(f"[LiveGames] ScoreboardV3 greška: {e}")

        # ── Korak 2: Live overlay — ažuriraj score/status za mečeve u toku ──
        try:
            from nba_api.live.nba.endpoints import scoreboard as live_sb
            _time.sleep(0.3)
            live_data = live_sb.ScoreBoard().get_dict()
            for game in live_data.get("scoreboard", {}).get("games", []):
                gid = game.get("gameId", "")
                game_status = game.get("gameStatus", 1)
                home = game.get("homeTeam", {})
                away = game.get("awayTeam", {})
                game_time_utc = game.get("gameTimeUTC") or game.get("gameEt", "")

                if gid in games_by_id:
                    # Ažuriraj postojeći meč iz primarnog izvora
                    games_by_id[gid].update({
                        "home_score": home.get("score", games_by_id[gid]["home_score"]),
                        "away_score": away.get("score", games_by_id[gid]["away_score"]),
                        "game_status": game_status,
                        "period": game.get("period", games_by_id[gid]["period"]),
                        "game_clock": game.get("gameClock", ""),
                        "status": game.get("gameStatusText", games_by_id[gid]["status"]),
                        "is_live": game_status == 2,
                        "is_final": game_status == 3,
                    })
                else:
                    # Meč u live endpointu koji nije u ScoreboardV3 — dodaj ga
                    sr_time = self._utc_to_sr(game_time_utc)
                    games_by_id[gid] = {
                        "game_id": gid,
                        "home_team": home.get("teamName", ""),
                        "home_city": home.get("teamCity", ""),
                        "home_abbr": home.get("teamTricode", ""),
                        "home_score": home.get("score", 0),
                        "away_team": away.get("teamName", ""),
                        "away_city": away.get("teamCity", ""),
                        "away_abbr": away.get("teamTricode", ""),
                        "away_score": away.get("score", 0),
                        "status": game.get("gameStatusText", ""),
                        "game_status": game_status,
                        "period": game.get("period", 0),
                        "game_clock": game.get("gameClock", ""),
                        "game_time_utc": game_time_utc,
                        "sr_time": sr_time,
                        "is_live": game_status == 2,
                        "is_final": game_status == 3,
                    }
        except Exception as e:
            print(f"[LiveGames] Live overlay greška: {e}")

        games = list(games_by_id.values())

        # Sortuj: live → scheduled → final
        def sort_key(g):
            if g.get("is_live"):     return 0
            if not g.get("is_final"): return 1
            return 2

        games.sort(key=sort_key)
        return games if games else [{"error": "Nema podataka o mečevima"}]

    def _today_et(self) -> str:
        """Vraća danas datum u US Eastern Time formatu MM/DD/YYYY."""
        try:
            from zoneinfo import ZoneInfo
            et = datetime.now(ZoneInfo("America/New_York"))
        except Exception:
            from datetime import timezone, timedelta
            et = datetime.now(timezone(timedelta(hours=-4)))
        return et.strftime("%m/%d/%Y")

    def _utc_to_sr(self, game_time_utc: str) -> str:
        """Konvertuje UTC ISO string u srpsko lokalno vreme (HH:MM)."""
        if not game_time_utc:
            return None
        try:
            from datetime import timedelta
            dt = datetime.fromisoformat(game_time_utc.replace("Z", "+00:00"))
            try:
                from zoneinfo import ZoneInfo
                dt_sr = dt.astimezone(ZoneInfo("Europe/Belgrade"))
            except ImportError:
                dt_sr = dt + timedelta(hours=2)
            return dt_sr.strftime("%H:%M")
        except Exception:
            return None

    async def get_player_live_stats(self, player_name: str) -> Optional[Dict]:
        """Vraća live stats igrača ako mu je meč u toku."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._fetch_player_live, player_name)

    def _fetch_player_live(self, player_name: str) -> Optional[Dict]:
        try:
            from nba_api.live.nba.endpoints import scoreboard, boxscore
            import time

            board = scoreboard.ScoreBoard()
            data = board.get_dict()

            # Nađi game koji je live
            live_game_id = None
            for game in data.get("scoreboard", {}).get("games", []):
                if game.get("gameStatus") != 2:
                    continue
                # Proveri oba tima
                home_players = game.get("homeTeam", {}).get("players", [])
                away_players = game.get("awayTeam", {}).get("players", [])
                all_players = home_players + away_players
                for p in all_players:
                    name = f"{p.get('firstName', '')} {p.get('familyName', '')}".strip()
                    if player_name.lower() in name.lower():
                        live_game_id = game.get("gameId")
                        break
                if live_game_id:
                    break

            if not live_game_id:
                return None

            time.sleep(0.5)
            box = boxscore.BoxScore(game_id=live_game_id)
            box_data = box.get_dict()

            # Nađi igrača u boxscore-u
            for team_key in ["homeTeam", "awayTeam"]:
                team = box_data.get("game", {}).get(team_key, {})
                for player in team.get("players", []):
                    name = f"{player.get('firstName', '')} {player.get('familyName', '')}".strip()
                    if player_name.lower() in name.lower():
                        stats = player.get("statistics", {})
                        return {
                            "player_name": name,
                            "game_id": live_game_id,
                            "is_live": True,
                            "pts": stats.get("points", 0),
                            "reb": stats.get("reboundsTotal", 0),
                            "ast": stats.get("assists", 0),
                            "min": stats.get("minutesCalculated", "PT0M").replace("PT", "").replace("M", ""),
                            "fg": f"{stats.get('fieldGoalsMade', 0)}/{stats.get('fieldGoalsAttempted', 0)}",
                            "stl": stats.get("steals", 0),
                            "blk": stats.get("blocks", 0),
                            "to": stats.get("turnovers", 0),
                            "status": player.get("status", ""),
                        }
            return None
        except Exception as e:
            return {"error": str(e), "is_live": False}

    async def check_tip_result(self, player_name: str, prop_type: str, line: float, game_date: str, recommendation: str = "OVER") -> Dict:
        """
        Proverava da li je tip pogođen gledajući game log igrača.
        Vraća: hit=True/False/None (None = meč nije odigran ili ne može da nađe)
        hit=True znači da je TIP pogođen (uzima u obzir OVER/UNDER smer).
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._check_result, player_name, prop_type, line, game_date, recommendation)

    def _check_result(self, player_name: str, prop_type: str, line: float, game_date: str, recommendation: str = "OVER") -> Dict:
        try:
            from nba_api.stats.static import players
            from nba_api.stats.endpoints import playergamelog
            from datetime import datetime, timedelta
            import time
            import unicodedata

            def _norm(s: str) -> str:
                return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower()

            def _parse_date(raw: str):
                raw = raw.strip()
                for fmt in ["%b %d, %Y", "%B %d, %Y", "%Y-%m-%d", "%m/%d/%Y"]:
                    try:
                        return datetime.strptime(raw, fmt)
                    except ValueError:
                        continue
                return None

            def _row_to_result(row, matched_date):
                if prop_type == "pra":
                    actual = float(row.get("PTS", 0)) + float(row.get("REB", 0)) + float(row.get("AST", 0))
                else:
                    col = {"points": "PTS", "rebounds": "REB", "assists": "AST"}.get(prop_type, "PTS")
                    actual = float(row.get(col, 0))
                # OVER: pogođeno ako je actual > line; UNDER: pogođeno ako je actual < line
                if recommendation.upper() == "UNDER":
                    hit = actual < line
                else:
                    hit = actual > line
                return {
                    "hit": hit,
                    "actual": actual,
                    "line": line,
                    "prop_type": prop_type,
                    "game_date": str(row.get("GAME_DATE", "")),
                    "matchup": str(row.get("MATCHUP", "")),
                }

            norm_query = _norm(player_name)
            all_players = players.get_players()
            player = next((p for p in all_players if _norm(p["full_name"]) == norm_query), None)
            if not player:
                player = next((p for p in all_players if norm_query in _norm(p["full_name"])), None)
            if not player:
                # Pokušaj i sa parcijalnim poklapanjem prezimena
                parts = norm_query.split()
                if parts:
                    player = next((p for p in all_players if parts[-1] in _norm(p["full_name"])), None)
            if not player:
                return {"hit": None, "reason": "Igrač nije pronađen u NBA bazi"}

            now = datetime.now()
            season_year = now.year if now.month >= 10 else now.year - 1
            season = f"{season_year}-{str(season_year + 1)[-2:]}"
            target = datetime.strptime(game_date, "%Y-%m-%d")
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

            if target.date() >= today.date():
                return {"hit": None, "reason": "Utakmica se tek igra večeras"}

            season_types = ["Regular Season", "Playoffs", "PlayIn"]

            # Prva runda: nađi meč NAJBLIŽI ciljnom datumu u ±7 dana prozoru
            all_dfs = []
            best_row_r1 = None
            best_diff_r1 = 999
            for stype in season_types:
                try:
                    time.sleep(0.4)
                    gamelog = playergamelog.PlayerGameLog(
                        player_id=player["id"], season=season,
                        season_type_all_star=stype
                    )
                    df = gamelog.get_data_frames()[0]
                    if df.empty:
                        continue
                    all_dfs.append(df)
                    for _, row in df.iterrows():
                        row_date = _parse_date(str(row.get("GAME_DATE", "")))
                        if row_date is None or row_date.date() > today.date():
                            continue
                        diff = abs((row_date - target).days)
                        if diff <= 7 and diff < best_diff_r1:
                            best_diff_r1 = diff
                            best_row_r1 = row
                except Exception:
                    continue
            if best_row_r1 is not None:
                return _row_to_result(best_row_r1, None)

            # Ako nije nađeno u ±7 dana — probaj prethodnu sezonu
            if not all_dfs:
                prev_season = f"{season_year - 1}-{str(season_year)[-2:]}"
                for stype in ["Regular Season", "Playoffs", "PlayIn"]:
                    try:
                        time.sleep(0.4)
                        gamelog = playergamelog.PlayerGameLog(
                            player_id=player["id"], season=prev_season,
                            season_type_all_star=stype
                        )
                        df = gamelog.get_data_frames()[0]
                        if df.empty:
                            continue
                        all_dfs.append(df)
                        for _, row in df.iterrows():
                            row_date = _parse_date(str(row.get("GAME_DATE", "")))
                            if row_date is None or row_date.date() > today.date():
                                continue
                            if abs((row_date - target).days) <= 7:
                                return _row_to_result(row, row_date)
                    except Exception:
                        continue

            if not all_dfs:
                return {"hit": None, "reason": "Nije moguće dohvatiti game log (API greška)"}

            # Druga runda: nađi najbliži meč u celom game logu (do 30 dana)
            best_row = None
            best_diff = 999
            for df in all_dfs:
                for _, row in df.iterrows():
                    row_date = _parse_date(str(row.get("GAME_DATE", "")))
                    if row_date is None or row_date.date() > today.date():
                        continue
                    diff = abs((row_date - target).days)
                    if diff < best_diff:
                        best_diff = diff
                        best_row = row

            if best_row is not None and best_diff <= 30:
                return _row_to_result(best_row, None)

            # Igrač ima game log ali nijedan meč nije blizu ciljnog datuma
            return {"hit": None, "reason": "Igrač nije igrao u tom periodu (povreda/odmor)"}

        except Exception as e:
            return {"hit": None, "reason": f"Greška: {str(e)}"}