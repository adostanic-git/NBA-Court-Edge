"""
AI Analyzer — uses Claude API to analyze player props.
Sends stats to Claude and gets structured betting recommendations.
"""
import os
import json
import httpx
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

load_dotenv()


CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"
CLAUDE_MODEL = "claude-sonnet-4-5"

SYSTEM_PROMPT = """You are an expert NBA sports analyst specializing in player prop betting.
Your job is to analyze player statistics and provide data-driven betting recommendations.

You ALWAYS respond with valid JSON only. No markdown, no explanation outside the JSON.

Your analysis must be:
- Based strictly on statistics provided
- Honest about uncertainty (never >90% confidence)
- Conservative with "OVER" recommendations when a player is on a cold streak
- Aware of home/away splits, opponent quality, and recent form

Response format:
{
  "recommendation": "OVER" | "UNDER" | "SKIP",
  "confidence": <integer 0-100>,
  "reasoning": "<2-3 sentence explanation in Serbian or English>",
  "value_rating": "excellent" | "good" | "fair" | "poor" | "skip",
  "key_factors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "edge": "<what gives us the edge vs the line>",
  "risk_factors": ["<risk 1>", "<risk 2>"]
}

Value ratings:
- excellent: avg is 15%+ above/below line with high consistency
- good: avg is 8-15% above/below line
- fair: avg is 3-8% above/below line  
- poor: avg is <3% above/below or high variance
- skip: data is insufficient or conflicting signals"""


class AIAnalyzer:

    async def analyze_prop(
        self,
        player_name: str,
        prop_type: str,
        line: float,
        stats: Dict[str, Any],
        opponent: Optional[str] = None,
        is_home: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Analyze a single prop bet using Claude."""

        prop_map = {
            "points": ("pts", "pts_last_n"),
            "rebounds": ("reb", "reb_last_n"),
            "assists": ("ast", "ast_last_n"),
            "pra": ("pra", None),
            "pts_rebs": ("pts_reb", None),
            "pts_asts": ("pts_ast", None),
        }

        stat_key, list_key = prop_map.get(prop_type, ("pts", "pts_last_n"))
        avg_last_n = stats.get("averages_last_n", {}).get(stat_key, 0)
        season_avg = stats.get("season_averages", {}).get(stat_key, 0)

        game_log_summary = []
        for g in stats.get("game_by_game", [])[:10]:
            val = g.get(stat_key.split("_")[0], g.get("pts", 0))
            if prop_type == "pra":
                val = g.get("pra", 0)
            game_log_summary.append(f"{g['date']} vs {g['matchup']}: {val} ({g['result']})")

        location_context = ""
        if is_home is not None:
            split_key = "home_splits" if is_home else "away_splits"
            split_data = stats.get(split_key, {})
            split_val = split_data.get(stat_key, 0)
            split_games = split_data.get("games", 0)
            if split_games >= 5 and split_val > 0:
                location = "HOME" if is_home else "AWAY"
                location_context = f"\nRELEVANT {location} SPLIT ({split_games} games): {split_val} {stat_key.upper()} avg — USE THIS as primary reference, not L10 avg"

        prompt = f"""Analyze this NBA player prop bet:

PLAYER: {player_name}
PROP: {prop_type.upper()} Over/Under {line}
OPPONENT: {opponent or 'Unknown'}

SEASON AVERAGE ({stat_key}): {season_avg}
AVERAGE LAST {stats.get('games_analyzed', 10)} GAMES: {avg_last_n}
RECENT TREND: {stats.get('recent_trend', 'neutral').upper()}{location_context}

GAME LOG (most recent first):
{chr(10).join(game_log_summary)}

HOME SPLITS: {json.dumps(stats.get('home_splits', {}))}
AWAY SPLITS: {json.dumps(stats.get('away_splits', {}))}

CONSISTENCY RATING: {stats.get('consistency_rating', 50)}/100

The line is {line}. The average last {stats.get('games_analyzed', 10)} games is {avg_last_n}.
Percentage above/below line: {round((avg_last_n - line) / line * 100, 1)}%

Provide your analysis as JSON."""

        try:
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                return self._fallback_analysis(avg_last_n, season_avg, line, prop_type, is_home=is_home, splits=stats)

            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    CLAUDE_API_URL,
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": CLAUDE_MODEL,
                        "max_tokens": 800,
                        "system": SYSTEM_PROMPT,
                        "messages": [{"role": "user", "content": prompt}]
                    }
                )
                
                # Check for billing/credit errors — fall back to stats
                if response.status_code == 400:
                    err = response.json().get("error", {})
                    if "credit" in err.get("message", "").lower() or "balance" in err.get("message", "").lower():
                        return self._fallback_analysis(avg_last_n, season_avg, line, prop_type, is_home=is_home, splits=stats)
                
                response.raise_for_status()
                data = response.json()
                resp_content = data["content"][0]["text"].strip()

                # Clean up potential markdown fences
                if resp_content.startswith("```"):
                    resp_content = resp_content.split("```")[1]
                    if resp_content.startswith("json"):
                        resp_content = resp_content[4:]
                resp_content = resp_content.strip()

                return json.loads(resp_content)

        except json.JSONDecodeError:
            return self._fallback_analysis(avg_last_n, season_avg, line, prop_type, is_home=is_home, splits=stats)
        except Exception as e:
            return self._fallback_analysis(avg_last_n, season_avg, line, prop_type, is_home=is_home, splits=stats)

    async def analyze_all_props(
        self,
        player_name: str,
        stats: Dict[str, Any],
        opponent: Optional[str] = None
    ) -> List[Dict]:
        """Auto-analyze all relevant props for a player."""
        import asyncio

        avgs = stats.get("averages_last_n", {})
        season = stats.get("season_averages", {})

        # Build prop lines based on season averages (simulating bookmaker lines)
        props_to_analyze = []

        if avgs.get("pts", 0) > 5:
            line = round(season.get("pts", avgs["pts"]) * 0.95, 1)
            props_to_analyze.append(("points", round(line * 2) / 2))  # Round to .5

        if avgs.get("reb", 0) > 2:
            line = round(season.get("reb", avgs["reb"]) * 0.95, 1)
            props_to_analyze.append(("rebounds", round(line * 2) / 2))

        if avgs.get("ast", 0) > 2:
            line = round(season.get("ast", avgs["ast"]) * 0.95, 1)
            props_to_analyze.append(("assists", round(line * 2) / 2))

        if avgs.get("pra", 0) > 10:
            line = round(season.get("pra", avgs["pra"]) * 0.95, 1)
            props_to_analyze.append(("pra", round(line * 2) / 2))

        tasks = [
            self.analyze_prop(player_name, prop_type, line, stats, opponent)
            for prop_type, line in props_to_analyze
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        output = []
        for (prop_type, line), result in zip(props_to_analyze, results):
            if isinstance(result, Exception):
                continue
            output.append({
                "prop_type": prop_type,
                "line": line,
                **result
            })

        # Sort by confidence descending
        output.sort(key=lambda x: x.get("confidence", 0), reverse=True)
        return output

    def _fallback_analysis(
        self,
        avg: float,
        season_avg: float,
        line: float,
        prop_type: str,
        is_home: Optional[bool] = None,
        splits: Optional[Dict] = None,
    ) -> Dict:
        """
        Statistical fallback when AI/credits unavailable.
        Koristi home/away split avg kao primarni avg kada je dostupan (>= 5 games).
        """
        if line <= 0:
            return {"recommendation": "SKIP", "confidence": 0, "reasoning": "Invalid line",
                    "value_rating": "skip", "key_factors": [], "edge": "N/A", "risk_factors": []}

        # Odabir primarnog prosjeka — split ima prioritet nad L10 avg
        primary_avg = avg
        split_label = "L10 avg"

        if is_home is not None and splits:
            split_key = "home_splits" if is_home else "away_splits"
            split_data = splits.get(split_key, {})
            stat_key = {"points": "pts", "rebounds": "reb", "assists": "ast", "pra": "pra"}.get(prop_type, "pts")
            split_val = split_data.get(stat_key, 0)
            split_games = split_data.get("games", 0)
            location = "doma" if is_home else "gostujući"

            if split_games >= 5 and split_val > 0:
                primary_avg = split_val
                split_label = f"{location} avg ({split_games} utakmica)"

        pct_recent = (primary_avg - line) / line * 100
        pct_season = (season_avg - line) / line * 100 if season_avg > 0 else 0

        both_over  = pct_recent > 0 and pct_season > 0
        both_under = pct_recent < 0 and pct_season < 0

        abs_diff = abs(pct_recent)

        if abs_diff > 20 and (both_over or both_under):
            conf, rating = 78, "excellent"
        elif abs_diff > 12 and (both_over or both_under):
            conf, rating = 70, "good"
        elif abs_diff > 12:
            conf, rating = 62, "fair"
        elif abs_diff > 5 and (both_over or both_under):
            conf, rating = 62, "fair"
        elif abs_diff > 5:
            conf, rating = 54, "fair"
        else:
            conf, rating = 35, "poor"

        if pct_recent > 6:
            rec = "OVER"
        elif pct_recent < -6:
            rec = "UNDER"
        else:
            rec, conf, rating = "SKIP", 35, "poor"

        direction = "iznad" if rec == "OVER" else "ispod"
        reasoning = (
            f"Statisticka analiza: {split_label} {primary_avg} je {direction} linije {line} "
            f"({pct_recent:+.1f}%). Sezonski prosek: {season_avg}."
        )
        if both_over or both_under:
            reasoning += " Oba proseka ukazuju na isti smer — jači signal."

        return {
            "recommendation": rec,
            "confidence": conf,
            "reasoning": reasoning,
            "value_rating": rating,
            "key_factors": [
                f"{split_label}: {primary_avg}",
                f"Sezonski avg: {season_avg}",
                f"Linija: {line}",
                f"Razlika: {pct_recent:+.1f}%"
            ],
            "edge": f"{abs_diff:.1f}% edge vs linija" if rec != "SKIP" else "Nema jasnog edgea",
            "risk_factors": ["Statistička analiza — bez AI obrazloženja"]
        }