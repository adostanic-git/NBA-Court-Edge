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
        try:
            from nba_api.live.nba.endpoints import scoreboard
            board = scoreboard.ScoreBoard()
            data = board.get_dict()
            games = []

            for game in data.get("scoreboard", {}).get("games", []):
                status = game.get("gameStatusText", "")
                game_status = game.get("gameStatus", 1)  # 1=scheduled, 2=live, 3=final

                home = game.get("homeTeam", {})
                away = game.get("awayTeam", {})

                game_time_utc = game.get("gameTimeUTC") or game.get("gameEt")
                sr_time = self._utc_to_sr(game_time_utc)

                games.append({
                    "game_id": game.get("gameId"),
                    "home_team": home.get("teamName", ""),
                    "home_city": home.get("teamCity", ""),
                    "home_abbr": home.get("teamTricode", ""),
                    "home_score": home.get("score", 0),
                    "away_team": away.get("teamName", ""),
                    "away_city": away.get("teamCity", ""),
                    "away_abbr": away.get("teamTricode", ""),
                    "away_score": away.get("score", 0),
                    "status": status,
                    "game_status": game_status,
                    "period": game.get("period", 0),
                    "game_clock": game.get("gameClock", ""),
                    "game_time_utc": game_time_utc,
                    "sr_time": sr_time,
                    "is_live": game_status == 2,
                    "is_final": game_status == 3,
                })

            # Ako live endpoint ne vidi mečeve (još nisu počeli) — fallback na ScoreboardV3
            if not games:
                games = self._fetch_scheduled_games_fallback()

            return games
        except Exception as e:
            # Ako live endpoint potpuno pukne, probaj fallback
            try:
                return self._fetch_scheduled_games_fallback()
            except Exception:
                return [{"error": str(e)}]

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

    def _fetch_scheduled_games_fallback(self) -> List[Dict]:
        """
        Fallback kada live ScoreBoard ne vidi mečeve (pre početka).
        Koristi ScoreboardV3 kao nba_stats.py — vraća mečeve u formatu koji UI očekuje.
        """
        from nba_api.stats.endpoints import scoreboardv3
        import time as _time

        today = datetime.now().strftime("%m/%d/%Y")
        _time.sleep(0.6)

        board = scoreboardv3.ScoreboardV3(game_date=today, league_id="00")
        data = board.get_dict()
        raw_games = data.get("scoreboard", {}).get("games", [])

        games = []
        for game in raw_games:
            status = game.get("gameStatusText", "")
            game_status = game.get("gameStatus", 1)
            home = game.get("homeTeam", {})
            away = game.get("awayTeam", {})
            game_time_utc = game.get("gameTimeUTC", "")
            sr_time = self._utc_to_sr(game_time_utc)

            games.append({
                "game_id": game.get("gameId", ""),
                "home_team": home.get("teamName", ""),
                "home_city": home.get("teamCity", ""),
                "home_abbr": home.get("teamTricode", ""),
                "home_score": home.get("score", 0),
                "away_team": away.get("teamName", ""),
                "away_city": away.get("teamCity", ""),
                "away_abbr": away.get("teamTricode", ""),
                "away_score": away.get("score", 0),
                "status": status,
                "game_status": game_status,
                "period": game.get("period", 0),
                "game_clock": game.get("gameClock", ""),
                "game_time_utc": game_time_utc,
                "sr_time": sr_time,
                "is_live": game_status == 2,
                "is_final": game_status == 3,
            })
        return games

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

    async def check_tip_result(self, player_name: str, prop_type: str, line: float, game_date: str) -> Dict:
        """
        Proverava da li je tip pogođen gledajući game log igrača.
        Vraća: hit=True/False/None (None = meč nije odigran ili ne može da nađe)
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._check_result, player_name, prop_type, line, game_date)

    def _check_result(self, player_name: str, prop_type: str, line: float, game_date: str) -> Dict:
        try:
            from nba_api.stats.static import players
            from nba_api.stats.endpoints import playergamelog
            from datetime import datetime, timedelta
            import time
            import unicodedata

            def _norm(s: str) -> str:
                """Ukloni dijakritike za poređenje — npr. Jokić → Jokic."""
                return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower()

            norm_query = _norm(player_name)
            all_players = players.get_players()
            player = next((p for p in all_players if _norm(p["full_name"]) == norm_query), None)
            if not player:
                player = next((p for p in all_players if norm_query in _norm(p["full_name"])), None)
            if not player:
                return {"hit": None, "reason": "Igrač nije pronađen"}

            now = datetime.now()
            season_year = now.year if now.month >= 10 else now.year - 1
            season = f"{season_year}-{str(season_year + 1)[-2:]}"
            target = datetime.strptime(game_date, "%Y-%m-%d")
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            stat_map = {"points": "PTS", "rebounds": "REB", "assists": "AST", "pra": None}

            # Ako je meč danas ili u budućnosti, ne gledaj game log — utakmica još nije odigrana
            if target.date() >= today.date():
                return {"hit": None, "reason": "Utakmica se tek igra večeras"}

            def _parse_date(raw: str):
                raw = raw.strip()
                for fmt in ["%b %d, %Y", "%B %d, %Y", "%Y-%m-%d", "%m/%d/%Y"]:
                    try:
                        return datetime.strptime(raw, fmt)
                    except ValueError:
                        continue
                return None

            def _search_df(df):
                """Pretraži DataFrame game loga za ciljni datum (tolerancija ±3 dana)."""
                for _, row in df.iterrows():
                    row_date = _parse_date(str(row.get("GAME_DATE", "")))
                    if row_date is None:
                        continue
                    diff = (row_date - target).days
                    # ±3 dana: pokriva timezone pomake, kasno čuvanje tipova,
                    # i slučajeve gdje je tip sačuvan 1-2 dana nakon odigranog meča
                    if abs(diff) > 3:
                        continue
                    if row_date.date() > today.date():
                        continue
                    if prop_type == "pra":
                        actual = float(row.get("PTS", 0)) + float(row.get("REB", 0)) + float(row.get("AST", 0))
                    else:
                        col = stat_map.get(prop_type, "PTS")
                        actual = float(row.get(col, 0))
                    return {
                        "hit": actual > line,
                        "actual": actual,
                        "line": line,
                        "prop_type": prop_type,
                        "game_date": str(row["GAME_DATE"]),
                        "matchup": str(row.get("MATCHUP", "")),
                    }
                return None

            # Probaj sve relevantne tipove sezone — April je play-in/playoff period
            season_types = ["Regular Season", "Playoffs", "PlayIn"]
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
                    result = _search_df(df)
                    if result is not None:
                        return result
                except Exception:
                    continue

            # Meč nije nađen ni u jednom tipu sezone
            if target.date() >= today.date():
                return {"hit": None, "reason": "Utakmica se tek igra večeras"}
            return {"hit": None, "reason": f"Meč na datum {game_date} nije pronađen u game logu"}
        except Exception as e:
            return {"hit": None, "reason": str(e)}