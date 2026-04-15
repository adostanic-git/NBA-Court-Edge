"""
ContextEnricher — obogaćuje kandidate za analizu sa:
  1. Injury report (active/inactive status za današnji meč)
  2. Back-to-back detekcija (je li tim igrao juče?)
"""
import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional


class ContextEnricher:
    def __init__(self):
        self._injury_cache: Dict[str, tuple] = {}   # game_id → ({player: status}, timestamp)
        self._b2b_cache: Dict[str, tuple] = {}       # "{team_abbr}_{date}" → (bool, timestamp)
        self._INJURY_TTL = 3600       # 1 sat
        self._B2B_TTL = 4 * 3600     # 4 sata

    # ─── Back-to-back ────────────────────────────────────────────────────────

    async def is_back_to_back(self, team_abbr: str, today_date: str) -> bool:
        """
        Vraća True ako je tim igrao juče (24h prije today_date).
        today_date: "YYYY-MM-DD" string.
        """
        cache_key = f"{team_abbr}_{today_date}"
        cached = self._b2b_cache.get(cache_key)
        if cached:
            result, ts = cached
            if time.time() - ts < self._B2B_TTL:
                return result

        recent_games = await self._fetch_team_recent_games(team_abbr)
        try:
            today = datetime.strptime(today_date, "%Y-%m-%d")
        except ValueError:
            today = datetime.now()

        yesterday = today - timedelta(days=1)
        yesterday_str = yesterday.strftime("%Y-%m-%d")

        result = yesterday_str in recent_games
        self._b2b_cache[cache_key] = (result, time.time())
        return result

    async def _fetch_team_recent_games(self, team_abbr: str) -> List[str]:
        """
        Dohvata datume posljednjih 3 utakmice tima.
        Vraća listu "YYYY-MM-DD" stringova.
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._fetch_team_recent_games_sync, team_abbr)

    def _fetch_team_recent_games_sync(self, team_abbr: str) -> List[str]:
        try:
            from nba_api.stats.endpoints import leaguegamelog
            import time as _time

            season = self._current_season()
            _time.sleep(0.6)
            log = leaguegamelog.LeagueGameLog(
                season=season,
                player_or_team_abbreviation="T",
                season_type_all_star="Regular Season",
            )
            df = log.get_data_frames()[0]
            if df.empty:
                return []

            team_df = df[df["TEAM_ABBREVIATION"] == team_abbr].copy()
            if team_df.empty:
                return []

            team_df = team_df.sort_values("GAME_DATE", ascending=False).head(3)
            dates = []
            for d in team_df["GAME_DATE"].tolist():
                d_str = str(d).strip()
                # Normalizuj na YYYY-MM-DD — nba_api može vratiti različite formate
                try:
                    parsed = datetime.strptime(d_str, "%Y-%m-%d")
                    dates.append(parsed.strftime("%Y-%m-%d"))
                except ValueError:
                    try:
                        parsed = datetime.strptime(d_str, "%b %d, %Y")
                        dates.append(parsed.strftime("%Y-%m-%d"))
                    except ValueError:
                        print(f"[ContextEnricher] Nepoznat GAME_DATE format: '{d_str}'")
            return dates

        except Exception as e:
            print(f"[ContextEnricher] B2B fetch error za {team_abbr}: {e}")
            return []

    # ─── Injury Report ───────────────────────────────────────────────────────

    async def get_injury_report(self, game_id: Optional[str]) -> Dict[str, str]:
        """
        Vraća dict {player_name: "active"|"inactive"} za dati game_id.
        Ako game_id nije dostupan ili API ne odgovori, vraća {} (safe default).
        """
        if not game_id:
            return {}

        cached = self._injury_cache.get(game_id)
        if cached:
            report, ts = cached
            if time.time() - ts < self._INJURY_TTL:
                return report

        report = await self._fetch_injury_report(game_id)
        self._injury_cache[game_id] = (report, time.time())
        return report

    async def _fetch_injury_report(self, game_id: str) -> Dict[str, str]:
        """
        Čita NBA live boxscore i vraća availability status igrača.
        """
        try:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, self._fetch_injury_sync, game_id)
        except Exception as e:
            print(f"[ContextEnricher] Injury fetch error za game {game_id}: {e}")
            return {}

    def _fetch_injury_sync(self, game_id: str) -> Dict[str, str]:
        try:
            from nba_api.live.nba.endpoints import boxscore
            import time as _time

            _time.sleep(0.6)
            box = boxscore.BoxScore(game_id=game_id)

            try:
                raw = box.get_json()
            except Exception:
                raw = None

            # Live boxscore vraća prazan odgovor ako meč još nije počeo — tiho preskačemo
            if not raw or raw.strip() in ("", "null"):
                return {}

            data = box.get_dict()
            game_data = data.get("game", {})
            report = {}

            for side in ("homeTeam", "awayTeam"):
                team_data = game_data.get(side, {})
                for player in team_data.get("players", []):
                    name = player.get("name", "")
                    status = player.get("status", "ACTIVE").upper()
                    if name:
                        report[name.lower().strip()] = "inactive" if status in ("INACTIVE", "DNP", "OUT") else "active"

            return report

        except ValueError:
            # Prazan JSON odgovor — meč još nije počeo, normalno ponašanje
            return {}
        except Exception as e:
            print(f"[ContextEnricher] BoxScore fetch error: {e}")
            return {}

    # ─── Helpers ─────────────────────────────────────────────────────────────

    def _current_season(self) -> str:
        now = datetime.now()
        year = now.year if now.month >= 10 else now.year - 1
        return f"{year}-{str(year + 1)[-2:]}"
