# AI Improvements Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodati tri signal sloja u AI analizu propova — injury filter, back-to-back penalizaciju i home/away split korištenje — bez ikakvih UI promjena.

**Architecture:** Novi `ContextEnricher` servis enkapsulira injury report i B2B detekciju. `top_picks.py` poziva enricher prije AI analize i filtrira injured igrače. `ai_analyzer.py` prima `is_home` parametar i koristi location-specific split prosjek u promptu i fallback kalkulaciji.

**Tech Stack:** Python, nba_api 1.5.2, FastAPI, pytest (za testove)

---

## File Map

| Akcija | Fajl | Odgovornost |
|--------|------|-------------|
| CREATE | `backend/services/context_enricher.py` | Injury report + B2B detekcija, own cache |
| MODIFY | `backend/services/top_picks.py` | Koristi enricher, prosljeđuje `is_home` AI-ju |
| MODIFY | `backend/services/ai_analyzer.py` | Prihvata `is_home`, koristi split avg u promptu i fallbacku |
| CREATE | `backend/tests/test_context_enricher.py` | Unit testovi za enricher logiku |
| CREATE | `backend/tests/test_ai_analyzer_splits.py` | Unit testovi za home/away split u analyzer-u |

---

## Task 1: Kreiraj `ContextEnricher` — B2B detekcija

**Files:**
- Create: `backend/services/context_enricher.py`
- Create: `backend/tests/test_context_enricher.py`

- [ ] **Step 1: Kreiraj test fajl i napiši failing test za B2B logiku**

```python
# backend/tests/test_context_enricher.py
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.context_enricher import ContextEnricher


def test_is_back_to_back_true():
    """Tim koji je igrao juče je na B2B."""
    enricher = ContextEnricher()
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    with patch.object(enricher, "_fetch_team_recent_games", return_value=[yesterday]):
        result = enricher.is_back_to_back("LAL", datetime.now().strftime("%Y-%m-%d"))
    assert result is True


def test_is_back_to_back_false():
    """Tim koji nije igrao juče nije na B2B."""
    enricher = ContextEnricher()
    two_days_ago = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")

    with patch.object(enricher, "_fetch_team_recent_games", return_value=[two_days_ago]):
        result = enricher.is_back_to_back("LAL", datetime.now().strftime("%Y-%m-%d"))
    assert result is False


def test_is_back_to_back_no_games():
    """Bez prethodnih mečeva — nije B2B."""
    enricher = ContextEnricher()

    with patch.object(enricher, "_fetch_team_recent_games", return_value=[]):
        result = enricher.is_back_to_back("LAL", datetime.now().strftime("%Y-%m-%d"))
    assert result is False
```

- [ ] **Step 2: Pokreni test — potvrdi da failuje**

```bash
cd backend
python -m pytest tests/test_context_enricher.py -v
```

Očekivano: `ImportError: cannot import name 'ContextEnricher'`

- [ ] **Step 3: Kreiraj `context_enricher.py` sa B2B logikom**

```python
# backend/services/context_enricher.py
"""
ContextEnricher — obogaćuje kandidate za analizu sa:
  1. Injury report (active/inactive status za današnji meč)
  2. Back-to-back detekcija (je li tim igrao juče?)
"""
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional


class ContextEnricher:
    def __init__(self):
        self._injury_cache: Dict[str, tuple] = {}   # game_id → ({player: status}, timestamp)
        self._b2b_cache: Dict[str, tuple] = {}       # team_abbr → (bool, timestamp)
        self._INJURY_TTL = 3600       # 1 sat
        self._B2B_TTL = 4 * 3600     # 4 sata

    # ─── Back-to-back ────────────────────────────────────────────────────────

    def is_back_to_back(self, team_abbr: str, today_date: str) -> bool:
        """
        Vraća True ako je tim igrao juče (±24h od today_date).
        today_date: "YYYY-MM-DD" string.
        """
        cached = self._b2b_cache.get(team_abbr)
        if cached:
            result, ts = cached
            if time.time() - ts < self._B2B_TTL:
                return result

        recent_games = self._fetch_team_recent_games(team_abbr)
        try:
            today = datetime.strptime(today_date, "%Y-%m-%d")
        except ValueError:
            today = datetime.now()

        yesterday = today - timedelta(days=1)
        yesterday_str = yesterday.strftime("%Y-%m-%d")

        result = yesterday_str in recent_games
        self._b2b_cache[team_abbr] = (result, time.time())
        return result

    def _fetch_team_recent_games(self, team_abbr: str) -> List[str]:
        """
        Dohvata datume posljednjih 3 utakmice tima.
        Vraća listu "YYYY-MM-DD" stringova.
        """
        try:
            from nba_api.stats.endpoints import leaguegamelog
            import time as _time

            season = self._current_season()
            _time.sleep(0.6)
            log = leaguegamelog.LeagueGameLog(
                season=season,
                player_or_team_abbreviation="T",   # T = team log
                season_type_all_star="Regular Season",
            )
            df = log.get_data_frames()[0]
            if df.empty:
                return []

            team_df = df[df["TEAM_ABBREVIATION"] == team_abbr].copy()
            if team_df.empty:
                return []

            # GAME_DATE format u nba_api: "YYYY-MM-DD"
            team_df = team_df.sort_values("GAME_DATE", ascending=False).head(3)
            return team_df["GAME_DATE"].tolist()

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
        Čita NBA live scoreboard i vraća availability status igrača.
        Koristi nba_api.live koji je već dependency u projektu.
        """
        try:
            import asyncio
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
            data = box.get_dict()

            game_data = data.get("game", {})
            report = {}

            for side in ("homeTeam", "awayTeam"):
                team_data = game_data.get(side, {})
                for player in team_data.get("players", []):
                    name = player.get("name", "")
                    status = player.get("status", "ACTIVE").upper()
                    if name:
                        report[name] = "inactive" if status in ("INACTIVE", "DNP", "OUT") else "active"

            return report

        except Exception as e:
            print(f"[ContextEnricher] BoxScore fetch error: {e}")
            return {}

    # ─── Helpers ─────────────────────────────────────────────────────────────

    def _current_season(self) -> str:
        now = datetime.now()
        year = now.year if now.month >= 10 else now.year - 1
        return f"{year}-{str(year + 1)[-2:]}"
```

- [ ] **Step 4: Pokreni testove — potvrdi da prolaze**

```bash
cd backend
python -m pytest tests/test_context_enricher.py -v
```

Očekivano:
```
PASSED tests/test_context_enricher.py::test_is_back_to_back_true
PASSED tests/test_context_enricher.py::test_is_back_to_back_false
PASSED tests/test_context_enricher.py::test_is_back_to_back_no_games
```

- [ ] **Step 5: Commit**

```bash
git add backend/services/context_enricher.py backend/tests/test_context_enricher.py
git commit -m "feat: add ContextEnricher with B2B detection"
```

---

## Task 2: ContextEnricher — Injury Report testovi

**Files:**
- Modify: `backend/tests/test_context_enricher.py`

- [ ] **Step 1: Dodaj failing testove za injury report**

Dodaj na kraj `backend/tests/test_context_enricher.py`:

```python
import asyncio


def test_injury_report_returns_inactive():
    """Igrač koji je INACTIVE vraća se kao 'inactive'."""
    enricher = ContextEnricher()
    mock_data = {
        "game": {
            "homeTeam": {
                "players": [
                    {"name": "LeBron James", "status": "ACTIVE"},
                    {"name": "Anthony Davis", "status": "INACTIVE"},
                ]
            },
            "awayTeam": {"players": []}
        }
    }

    with patch.object(enricher, "_fetch_injury_sync", return_value={
        "LeBron James": "active",
        "Anthony Davis": "inactive",
    }):
        result = asyncio.run(enricher.get_injury_report("0022400001"))

    assert result["LeBron James"] == "active"
    assert result["Anthony Davis"] == "inactive"


def test_injury_report_empty_on_no_game_id():
    """Bez game_id vraća prazan dict — ne blokira analizu."""
    enricher = ContextEnricher()
    result = asyncio.run(enricher.get_injury_report(None))
    assert result == {}


def test_injury_report_empty_on_api_error():
    """API error → prazan dict, ne crashuje pipeline."""
    enricher = ContextEnricher()

    with patch.object(enricher, "_fetch_injury_sync", side_effect=Exception("network error")):
        result = asyncio.run(enricher.get_injury_report("0022400001"))

    assert result == {}
```

- [ ] **Step 2: Pokreni testove**

```bash
cd backend
python -m pytest tests/test_context_enricher.py -v
```

Očekivano: svih 6 testova PASSED

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_context_enricher.py
git commit -m "test: add injury report tests for ContextEnricher"
```

---

## Task 3: Integracija enrichera u `top_picks.py`

**Files:**
- Modify: `backend/services/top_picks.py`

- [ ] **Step 1: Dodaj `enricher` u `TopPicksService.__init__`**

U `backend/services/top_picks.py`, pronađi `__init__` metodu i dodaj enricher:

```python
# Staro:
def __init__(self):
    self.nba = NBAStatsService()
    self.odds = OddsAPIService()
    self.ai = AIAnalyzer()
    self._cache: Optional[List[Dict]] = None
    self._cache_time: float = 0

# Novo:
def __init__(self):
    self.nba = NBAStatsService()
    self.odds = OddsAPIService()
    self.ai = AIAnalyzer()
    self.enricher = ContextEnricher()
    self._cache: Optional[List[Dict]] = None
    self._cache_time: float = 0
```

Dodaj import na vrh fajla (nakon postojećih importa):

```python
from services.context_enricher import ContextEnricher
```

- [ ] **Step 2: Dodaj `game_id` u candidate dict**

U metodi `_build_candidates`, u petlji gdje se kreira candidate dict, dodaj `game_id` polje. Pronađi blok koji počinje sa `candidates.append({` i dodaj `"game_id": game.get("game_id", ""),`:

```python
candidates.append({
    "player_name": player,
    "team": team_full,
    "team_short": team_name,
    "opponent": opponent_full,
    "opponent_short": opponent_name,
    "event_id": event_id,
    "game_id": game.get("game_id", ""),   # NOVO
    "is_home": is_home,
    "game_time": game_time,
    "matchup": f"{home_full} vs {away_full}",
    "props": props,
})
```

- [ ] **Step 3: Dodaj injury filter i B2B penalizaciju u `_analyze_candidate`**

Pronađi metodu `_analyze_candidate`. Zamijeni početak metode (do `stats = await self.nba.get_player_stats(...)`) sa:

```python
async def _analyze_candidate(self, candidate: Dict) -> List[Dict]:
    player_name = candidate["player_name"]
    opponent = candidate["opponent"]
    props = candidate.get("props", {})
    game_id = candidate.get("game_id")
    team_short = candidate.get("team_short", "")
    is_home = candidate.get("is_home", True)

    # 1. Injury check — preskoči igrača koji ne igra danas
    injury_report = await self.enricher.get_injury_report(game_id)
    player_status = injury_report.get(player_name, "unknown")
    if player_status == "inactive":
        print(f"[TopPicks] {player_name} — inactive danas, preskačem")
        return []

    # 2. B2B detekcija
    from datetime import datetime
    today_str = datetime.now().strftime("%Y-%m-%d")
    back_to_back = self.enricher.is_back_to_back(team_short, today_str)

    try:
        stats = await self.nba.get_player_stats(player_name, last_n_games=10)
    except Exception:
        return []
```

- [ ] **Step 4: Proslijedi `is_home` AI-ju i primijeni B2B penalizaciju**

Pronađi blok `analyses = await asyncio.gather(...)` u `_analyze_candidate` i ažuriraj poziv `analyze_prop` da uključi `is_home`:

```python
analyses = await asyncio.gather(
    *[self.ai.analyze_prop(
        player_name=player_name,
        prop_type=pt,
        line=ln,
        stats=stats,
        opponent=opponent,
        is_home=is_home,          # NOVO
    ) for pt, ln, _, _ in prop_configs],
    return_exceptions=True
)
```

Zatim pronađi petlju `for analysis, (prop_type, line, avg_val, odds_data) in zip(analyses, prop_configs):` i dodaj B2B penalizaciju PRIJE nego se doda u `results`:

```python
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
        # ... ostatak ostaje isti
    })
```

- [ ] **Step 5: Pokreni backend i provjeri da se podiže bez greške**

```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

Očekivano: server se podiže bez ImportError ili sintaksnih grešaka.

- [ ] **Step 6: Commit**

```bash
git add backend/services/top_picks.py
git commit -m "feat: integrate ContextEnricher into TopPicksService — injury filter + B2B penalty"
```

---

## Task 4: Home/Away split u `ai_analyzer.py`

**Files:**
- Modify: `backend/services/ai_analyzer.py`
- Create: `backend/tests/test_ai_analyzer_splits.py`

- [ ] **Step 1: Napiši failing testove za split logiku**

```python
# backend/tests/test_ai_analyzer_splits.py
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.ai_analyzer import AIAnalyzer


def make_stats(home_pts=28.3, away_pts=24.1, avg_pts=26.0):
    return {
        "averages_last_n": {"pts": avg_pts, "reb": 7.0, "ast": 5.0, "pra": 38.0},
        "season_averages": {"pts": avg_pts, "reb": 7.0, "ast": 5.0, "pra": 38.0},
        "home_splits": {"pts": home_pts, "reb": 7.5, "ast": 5.2, "games": 18},
        "away_splits": {"pts": away_pts, "reb": 6.8, "ast": 4.9, "games": 19},
        "game_by_game": [],
        "recent_trend": "neutral",
        "consistency_rating": 70,
        "games_analyzed": 10,
    }


def test_fallback_uses_home_split_when_home():
    """Fallback analiza koristi home_splits avg kada is_home=True."""
    ai = AIAnalyzer()
    stats = make_stats(home_pts=30.0, away_pts=22.0, avg_pts=26.0)
    # Linija 27.5 — home avg (30.0) je iznad, away avg (22.0) je ispod
    result = ai._fallback_analysis(
        avg=stats["averages_last_n"]["pts"],
        season_avg=stats["season_averages"]["pts"],
        line=27.5,
        prop_type="points",
        is_home=True,
        splits=stats,
    )
    # Home avg 30.0 > linija 27.5 → trebalo bi biti OVER
    assert result["recommendation"] == "OVER"


def test_fallback_uses_away_split_when_away():
    """Fallback analiza koristi away_splits avg kada is_home=False."""
    ai = AIAnalyzer()
    stats = make_stats(home_pts=30.0, away_pts=22.0, avg_pts=26.0)
    # Linija 27.5 — away avg (22.0) je ispod
    result = ai._fallback_analysis(
        avg=stats["averages_last_n"]["pts"],
        season_avg=stats["season_averages"]["pts"],
        line=27.5,
        prop_type="points",
        is_home=False,
        splits=stats,
    )
    # Away avg 22.0 < linija 27.5 → trebalo bi biti UNDER
    assert result["recommendation"] == "UNDER"


def test_fallback_ignores_split_when_not_enough_games():
    """Fallback ignorira split koji ima < 5 utakmica i koristi L10 avg."""
    ai = AIAnalyzer()
    stats = make_stats(home_pts=30.0, away_pts=22.0, avg_pts=26.0)
    stats["home_splits"]["games"] = 3   # premalo podataka
    result = ai._fallback_analysis(
        avg=26.0,
        season_avg=26.0,
        line=27.5,
        prop_type="points",
        is_home=True,
        splits=stats,
    )
    # Bez split-a — koristi L10 avg (26.0) koji je ispod linije 27.5
    assert result["recommendation"] == "UNDER"
```

- [ ] **Step 2: Pokreni testove — potvrdi da failuju**

```bash
cd backend
python -m pytest tests/test_ai_analyzer_splits.py -v
```

Očekivano: `TypeError: _fallback_analysis() got unexpected keyword argument 'is_home'`

- [ ] **Step 3: Ažuriraj `_fallback_analysis` signature i logiku**

U `backend/services/ai_analyzer.py`, pronađi `_fallback_analysis` metodu i zamijeni sa:

```python
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
    split_label = f"L10 avg"

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

    # Koliko primary avg odskače od linije
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
    elif abs_diff > 6 and (both_over or both_under):
        conf, rating = 62, "fair"
    elif abs_diff > 6:
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
```

- [ ] **Step 4: Ažuriraj `analyze_prop` signature da prihvata `is_home` i `splits`**

Pronađi `async def analyze_prop(` i dodaj parametre:

```python
async def analyze_prop(
    self,
    player_name: str,
    prop_type: str,
    line: float,
    stats: Dict[str, Any],
    opponent: Optional[str] = None,
    is_home: Optional[bool] = None,      # NOVO
) -> Dict[str, Any]:
```

- [ ] **Step 5: Ažuriraj prompt u `analyze_prop` da uključuje split info**

Pronađi blok gdje se gradi `prompt` string u `analyze_prop`. Odmah nakon linije `AWAY SPLITS: ...` u promptu (već postoji u originalnom kodu), dodaj blok koji ističe relevantni split:

```python
# Odmah ispod HOME SPLITS / AWAY SPLITS linija u promptu, dodaj:
location_context = ""
if is_home is not None:
    split_key = "home_splits" if is_home else "away_splits"
    split_data = stats.get(split_key, {})
    stat_key = {"points": "pts", "rebounds": "reb", "assists": "ast", "pra": "pra"}.get(prop_type, "pts")
    split_val = split_data.get(stat_key, 0)
    split_games = split_data.get("games", 0)
    if split_games >= 5 and split_val > 0:
        location = "HOME" if is_home else "AWAY"
        location_context = f"\nRELEVANT {location} SPLIT ({split_games} games): {split_val} {stat_key.upper()} avg — USE THIS as primary reference, not L10 avg"
```

Zatim uključi `location_context` u prompt string:

```python
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
```

- [ ] **Step 6: Ažuriraj fallback poziv unutar `analyze_prop`**

Pronađi liniju `return self._fallback_analysis(avg_last_n, season_avg, line, prop_type)` (pojavljuje se na 2-3 mjesta) i zamijeni svaki poziv sa:

```python
return self._fallback_analysis(avg_last_n, season_avg, line, prop_type, is_home=is_home, splits=stats)
```

- [ ] **Step 7: Pokreni sve testove**

```bash
cd backend
python -m pytest tests/ -v
```

Očekivano: svi testovi PASSED

- [ ] **Step 8: Commit**

```bash
git add backend/services/ai_analyzer.py backend/tests/test_ai_analyzer_splits.py
git commit -m "feat: use home/away splits as primary avg in AI analysis"
```

---

## Task 5: End-to-end smoke test

**Files:**
- Nema novih fajlova

- [ ] **Step 1: Pokreni backend**

```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

- [ ] **Step 2: Test picks endpoint**

```bash
curl -s "http://localhost:8000/api/picks/top10?refresh=true" | python -m json.tool | head -60
```

Očekivano: JSON odgovor sa `picks` listom, bez stack trace-a u konzoli. Provjeri konzolu da vidiš `[ContextEnricher]` log poruke.

- [ ] **Step 3: Provjeri B2B log**

U konzoli servera trebalo bi vidjeti (ako postoje B2B mečevi):
```
[ContextEnricher] B2B fetch error ... 
```
ili tiho prolazi. Ako nema B2B mečeva danas — normalno, nema loga.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: AI Phase 1 complete — injury filter, B2B penalty, home/away splits"
```

---

## Spec Coverage Provjera

| Spec zahtjev | Task koji ga implementira |
|---|---|
| Injury filter — skip inactive igrača | Task 1 (enricher), Task 3 (integracija) |
| B2B detekcija — -12 confidence | Task 1 (enricher), Task 3 (penalizacija) |
| B2B warning u key_factors | Task 3 |
| Home/Away split u fallback kalkulaciji | Task 4 (_fallback_analysis) |
| Home/Away split u AI promptu | Task 4 (prompt location_context) |
| `is_home` prosljeđen iz top_picks | Task 3 (analyze_prop poziv) |
| Cache za enricher podatke | Task 1 (TTL konstante u __init__) |
