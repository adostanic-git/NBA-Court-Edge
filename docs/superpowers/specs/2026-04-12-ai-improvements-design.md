# AI Improvements — Phase 1 Design Spec
**Date:** 2026-04-12  
**Project:** Court Edge — NBA Prop Analyzer  
**Scope:** 3 backend-only improvements to AI analysis quality

---

## Overview

Add three signal layers to the AI prop analysis pipeline to reduce bad tips:
1. **Injury Report** — skip players who are out/doubtful for today's game
2. **Back-to-back Detection** — penalize confidence -12 pts for B2B games
3. **Home/Away Split** — use location-specific averages in AI prompt instead of blended L10

All changes are backend-only. No UI changes. Confidence numbers in the tip card will reflect improvements automatically.

---

## Architecture

### New file: `backend/services/context_enricher.py`

A `ContextEnricher` class that receives game/player context and returns enriched flags and adjusted stats. Instantiated once in `TopPicksService.__init__`.

```
ContextEnricher
  ├── get_injury_report(game_id) → Dict[str, str]   # player_name → "active"|"inactive"|"unknown"
  ├── is_back_to_back(team_abbr, game_date) → bool
  └── get_home_away_avg(stats, is_home, stat_key) → float
```

### Changes to `top_picks.py`

In `_analyze_candidate`, before AI call:
1. Call `enricher.get_injury_report(game_id)` → if player status is `"inactive"`, return `[]` immediately
2. Call `enricher.is_back_to_back(team_abbr, game_date)` → store result
3. After AI response: if `back_to_back=True`, reduce confidence by 12, add `"B2B penalizacija (-12 confidence)"` to `key_factors`

### Changes to `ai_analyzer.py`

- `analyze_prop` accepts new optional param `is_home: bool = None`
- Prompt uses home/away split avg as primary reference when available, with note: `"HOME avg (18 games): 28.3"` vs `"AWAY avg (19 games): 24.1"`
- `_fallback_analysis` uses split avg instead of blended L10 avg when `is_home` is provided

---

## Feature 1 — Injury Report

**Data source:** `nba_api.live.nba.endpoints.scoreboard` — already used for today's games. The scoreboard response includes per-team player availability for active games.

**Approach:**
- `get_injury_report(game_id)` calls NBA live scoreboard, finds the game by `game_id`, returns dict of `{player_name: "active"|"inactive"}`
- "inactive" = player is on injury report / DNP for this game
- Cache: 1 hour (injury status rarely changes day-of after ~2h before tip-off)
- If API fails or game not found: return `{}` (safe default — don't block analysis)

**Filter logic in `top_picks.py`:**
```python
injury_report = await self.enricher.get_injury_report(candidate["game_id"])
status = injury_report.get(player_name, "unknown")
if status == "inactive":
    print(f"[TopPicks] {player_name} — inactive danas, preskačem")
    return []
```

**Key teammate logic:**  
Not in Phase 1 scope. If Curry is out → Warriors players get more minutes is a Phase 2 enhancement. Phase 1 only skips the injured player themselves.

---

## Feature 2 — Back-to-back Detection

**Data source:** `nba_api.stats.endpoints.leaguegamelog` filtered by team abbreviation, last 3 days.

**Logic:**
```python
def is_back_to_back(team_abbr, today_date) -> bool:
    # fetch team game log for last 3 days
    # if any game found on (today - 1 day): return True
    return False
```

**Confidence penalty:**
```python
if back_to_back:
    analysis["confidence"] = max(0, analysis["confidence"] - 12)
    analysis["key_factors"].append("B2B penalizacija (-12 confidence)")
    analysis["risk_factors"].append("Drugi meč za 24h — statistički lošije performanse")
```

**Cache:** 4 hours (same pattern as roster cache in `nba_stats.py`)

**Edge case:** If team played yesterday but this is their first game today (they're the away team traveling), still counts as B2B.

---

## Feature 3 — Home/Away Split Analysis

**Data already available:** `nba_stats.py` already computes and returns `home_splits` and `away_splits` in the stats object:
```python
stats["home_splits"] = {"pts": 28.3, "reb": 7.1, "ast": 5.2, "games": 18}
stats["away_splits"] = {"pts": 24.1, "reb": 6.8, "ast": 4.9, "games": 19}
```

**`candidate["is_home"]`** already exists in `top_picks.py` candidates.

**Changes to `ai_analyzer.py`:**

1. `analyze_prop(...)` gains `is_home: Optional[bool] = None` parameter
2. If `is_home` is not None and the relevant split has `>= 5 games`:
   - Use split avg as primary avg in prompt
   - Add to prompt: `HOME SPLIT (18 games): 28.3 pts` or `AWAY SPLIT (19 games): 24.1 pts`
   - Recalculate `pct_diff = (split_avg - line) / line * 100` for the prompt
3. `_fallback_analysis` updated to accept and use split avg

**`top_picks.py` change:**
```python
await self.ai.analyze_prop(
    player_name=player_name,
    prop_type=pt,
    line=ln,
    stats=stats,
    opponent=opponent,
    is_home=candidate["is_home"],   # NEW
)
```

---

## Caching Strategy

| Data | Cache duration | Where |
|------|---------------|-------|
| Injury report | 1 hour | `ContextEnricher._injury_cache` |
| B2B schedule | 4 hours | `ContextEnricher._b2b_cache` |
| Home/Away splits | Already cached via player stats | `NBAStatsService._player_cache` |

---

## Out of Scope (Phase 2)

- Key teammate injury impact (Curry out → Warriors teammates boost)
- Pace matchup analysis
- Referee tendency analysis
- Automatic error learning from missed tips

---

## Files to Change

| File | Change |
|------|--------|
| `backend/services/context_enricher.py` | **NEW** — injury report + B2B detection |
| `backend/services/top_picks.py` | Use enricher in `_analyze_candidate`, pass `is_home` to AI |
| `backend/services/ai_analyzer.py` | Accept `is_home`, use splits in prompt + fallback |
