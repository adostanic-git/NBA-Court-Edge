"""
Odds Service — The Odds API (odds-api.com)
Besplatno 500 req/mesec. Registracija na https://the-odds-api.com/
Vraca player props (points, rebounds, assists) za NBA utakmice.
"""
import os
import httpx
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv

load_dotenv()


ODDS_API_BASE = "https://api.the-odds-api.com/v4"
NBA_SPORT = "basketball_nba"

# Mapiranje prop tipova na odds-api market nazive
PROP_MARKET_MAP = {
    "points":    "player_points",
    "rebounds":  "player_rebounds",
    "assists":   "player_assists",
    "pra":       "player_points_rebounds_assists",
    "pts_rebs":  "player_points_rebounds",
    "pts_asts":  "player_points_assists",
    "steals":    "player_steals",
    "blocks":    "player_blocks",
}

# Srpske kladionice koje odds-api podrzava (ako ih nema, vraca globalne)
PREFERRED_BOOKMAKERS = ["meridianbet", "mozzartbet"]
FALLBACK_BOOKMAKERS  = ["draftkings", "fanduel", "betmgm", "williamhill_us"]


class OddsAPIService:
    def __init__(self):
        self.api_key = os.getenv("ODDS_API_KEY", "")
        self._game_cache: Dict[str, Any] = {}
        self._props_cache: Dict[str, Any] = {}

    def _has_key(self) -> bool:
        return bool(self.api_key and self.api_key != "your_odds_api_key_here")

    async def get_todays_games_with_odds(self) -> List[Dict]:
        """
        Fetch today's NBA games with head-to-head odds.
        Returns games enriched with team info.
        """
        if not self._has_key():
            return []

        cache_key = "today_games"
        if cache_key in self._game_cache:
            return self._game_cache[cache_key]

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{ODDS_API_BASE}/sports/{NBA_SPORT}/odds",
                    params={
                        "apiKey": self.api_key,
                        "regions": "eu,us",
                        "markets": "h2h",
                        "oddsFormat": "decimal",
                        "dateFormat": "iso",
                    }
                )
                if resp.status_code != 200:
                    return []

                games = []
                for event in resp.json():
                    games.append({
                        "event_id":   event.get("id"),
                        "home_team":  event.get("home_team"),
                        "away_team":  event.get("away_team"),
                        "commence_time": event.get("commence_time"),
                    })
                self._game_cache[cache_key] = games
                return games
        except Exception:
            return []

    async def get_player_props(
        self,
        event_id: str,
        prop_type: str,
    ) -> Dict[str, Any]:
        """
        Fetch player props for a specific game and prop type.
        Returns: {player_name: {"line": 26.5, "over": 1.87, "under": 1.93, "bookmaker": "..."}}
        """
        if not self._has_key():
            return {}

        market = PROP_MARKET_MAP.get(prop_type)
        if not market:
            return {}

        cache_key = f"{event_id}_{market}"
        if cache_key in self._props_cache:
            return self._props_cache[cache_key]

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{ODDS_API_BASE}/sports/{NBA_SPORT}/events/{event_id}/odds",
                    params={
                        "apiKey":      self.api_key,
                        "regions":     "eu,us",
                        "markets":     market,
                        "oddsFormat":  "decimal",
                    }
                )
                if resp.status_code != 200:
                    return {}

                result = self._parse_player_props(resp.json(), prop_type)
                self._props_cache[cache_key] = result
                return result

        except Exception:
            return {}

    def _parse_player_props(self, data: Dict, prop_type: str) -> Dict[str, Any]:
        """
        Parse odds-api response into:
        {player_name: {line, over, under, bookmaker}}
        """
        market_key = PROP_MARKET_MAP.get(prop_type, "")
        players: Dict[str, Dict] = {}

        bookmakers = data.get("bookmakers", [])

        # Prefer Serbian bookmakers, fall back to US ones
        def bookie_priority(b):
            name = b.get("key", "")
            if name in PREFERRED_BOOKMAKERS:
                return 0
            if name in FALLBACK_BOOKMAKERS:
                return 1
            return 2

        bookmakers_sorted = sorted(bookmakers, key=bookie_priority)

        for bookmaker in bookmakers_sorted:
            bookie_name = bookmaker.get("title", bookmaker.get("key", "Unknown"))
            for market in bookmaker.get("markets", []):
                if market.get("key") != market_key:
                    continue
                for outcome in market.get("outcomes", []):
                    # Player name is in 'description', Over/Under is in 'name'
                    player_name = outcome.get("description", "")
                    side = outcome.get("name", "").lower()
                    point = outcome.get("point")
                    price = outcome.get("price")

                    if not player_name or point is None or price is None:
                        continue

                    if player_name not in players:
                        players[player_name] = {
                            "line": point,
                            "over": None,
                            "under": None,
                            "bookmaker": bookie_name
                        }

                    if "over" in side and players[player_name]["over"] is None:
                        players[player_name]["over"] = price
                        players[player_name]["line"] = point
                    elif "under" in side and players[player_name]["under"] is None:
                        players[player_name]["under"] = price

        return players

    async def get_player_line(
        self,
        player_name: str,
        event_id: str,
        prop_type: str
    ) -> Optional[Dict]:
        """
        Get the line and odds for a specific player + prop.
        Returns: {line, over, under, bookmaker} or None
        """
        props = await self.get_player_props(event_id, prop_type)

        # Exact match first
        if player_name in props:
            return props[player_name]

        # Partial match (last name)
        last_name = player_name.split()[-1].lower()
        for pname, data in props.items():
            if last_name in pname.lower():
                return data

        return None

    def get_remaining_requests(self) -> Optional[int]:
        """Check how many API requests remain this month."""
        # This is returned in response headers — tracked externally
        return None

    async def get_all_props_for_event(self, event_id: str) -> Dict[str, Any]:
        """
        Fetch ALL prop types for a game in ONE API call.
        Returns: {prop_type: {player_name: {line, over, under, bookmaker}}}
        """
        if not self._has_key():
            return {}

        cache_key = f"all_props_{event_id}"
        if cache_key in self._props_cache:
            return self._props_cache[cache_key]

        markets = ",".join(PROP_MARKET_MAP.values())

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{ODDS_API_BASE}/sports/{NBA_SPORT}/events/{event_id}/odds",
                    params={
                        "apiKey":     self.api_key,
                        "regions":    "us",
                        "markets":    markets,
                        "oddsFormat": "decimal",
                    }
                )
                if resp.status_code != 200:
                    return {}

                data = resp.json()
                result = {}
                for prop_type, market_key in PROP_MARKET_MAP.items():
                    # Temporarily filter data for this market
                    filtered = {
                        **data,
                        "bookmakers": [
                            {**b, "markets": [m for m in b.get("markets", []) if m.get("key") == market_key]}
                            for b in data.get("bookmakers", [])
                        ]
                    }
                    result[prop_type] = self._parse_player_props(filtered, prop_type)

                self._props_cache[cache_key] = result
                return result

        except Exception:
            return {}