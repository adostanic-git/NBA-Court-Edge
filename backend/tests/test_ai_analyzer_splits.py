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
    """Fallback koristi home_splits avg kada is_home=True."""
    ai = AIAnalyzer()
    stats = make_stats(home_pts=30.0, away_pts=22.0, avg_pts=26.0)
    result = ai._fallback_analysis(
        avg=stats["averages_last_n"]["pts"],
        season_avg=stats["season_averages"]["pts"],
        line=27.5,
        prop_type="points",
        is_home=True,
        splits=stats,
    )
    # Home avg 30.0 > linija 27.5 → OVER
    assert result["recommendation"] == "OVER"


def test_fallback_uses_away_split_when_away():
    """Fallback koristi away_splits avg kada is_home=False."""
    ai = AIAnalyzer()
    stats = make_stats(home_pts=30.0, away_pts=22.0, avg_pts=26.0)
    result = ai._fallback_analysis(
        avg=stats["averages_last_n"]["pts"],
        season_avg=stats["season_averages"]["pts"],
        line=27.5,
        prop_type="points",
        is_home=False,
        splits=stats,
    )
    # Away avg 22.0 < linija 27.5 → UNDER
    assert result["recommendation"] == "UNDER"


def test_fallback_ignores_split_when_not_enough_games():
    """Fallback ignorira split sa < 5 utakmica, koristi L10 avg."""
    ai = AIAnalyzer()
    stats = make_stats(home_pts=30.0, away_pts=22.0, avg_pts=26.0)
    stats["home_splits"]["games"] = 3  # premalo podataka
    result = ai._fallback_analysis(
        avg=26.0,
        season_avg=26.0,
        line=30.0,
        prop_type="points",
        is_home=True,
        splits=stats,
    )
    # Bez splita (premalo games) — L10 avg (26.0) << linija 30.0 → UNDER
    assert result["recommendation"] == "UNDER"


def test_fallback_no_split_when_is_home_none():
    """Fallback koristi L10 avg kada is_home nije proslijeđen."""
    ai = AIAnalyzer()
    stats = make_stats(home_pts=30.0, away_pts=22.0, avg_pts=26.0)
    result = ai._fallback_analysis(
        avg=26.0,
        season_avg=26.0,
        line=30.0,
        prop_type="points",
        is_home=None,
        splits=stats,
    )
    # is_home=None → koristi L10 avg (26.0) << linija 30.0 → UNDER
    assert result["recommendation"] == "UNDER"
