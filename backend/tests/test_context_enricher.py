import asyncio
import pytest
from unittest.mock import patch, AsyncMock
from datetime import datetime, timedelta
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.context_enricher import ContextEnricher


def test_is_back_to_back_true():
    """Tim koji je igrao juče je na B2B."""
    enricher = ContextEnricher()
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    async def run():
        with patch.object(enricher, "_fetch_team_recent_games", new=AsyncMock(return_value=[yesterday])):
            return await enricher.is_back_to_back("LAL", datetime.now().strftime("%Y-%m-%d"))

    assert asyncio.run(run()) is True


def test_is_back_to_back_false():
    """Tim koji nije igrao juče nije na B2B."""
    enricher = ContextEnricher()
    two_days_ago = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")

    async def run():
        with patch.object(enricher, "_fetch_team_recent_games", new=AsyncMock(return_value=[two_days_ago])):
            return await enricher.is_back_to_back("LAL", datetime.now().strftime("%Y-%m-%d"))

    assert asyncio.run(run()) is False


def test_is_back_to_back_no_games():
    """Bez prethodnih mečeva — nije B2B."""
    enricher = ContextEnricher()

    async def run():
        with patch.object(enricher, "_fetch_team_recent_games", new=AsyncMock(return_value=[])):
            return await enricher.is_back_to_back("LAL", datetime.now().strftime("%Y-%m-%d"))

    assert asyncio.run(run()) is False


def test_b2b_cache_key_includes_date():
    """Cache key mora uključivati datum da se izbjegne stale data."""
    enricher = ContextEnricher()
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    async def run():
        with patch.object(enricher, "_fetch_team_recent_games", new=AsyncMock(return_value=[yesterday])):
            result1 = await enricher.is_back_to_back("GSW", today)
        # Cache treba biti pod ključem "GSW_YYYY-MM-DD", ne samo "GSW"
        assert f"GSW_{today}" in enricher._b2b_cache
        return result1

    asyncio.run(run())


def test_injury_report_returns_statuses():
    """Igrač koji je INACTIVE vraća se kao 'inactive', ACTIVE kao 'active'."""
    enricher = ContextEnricher()

    async def run():
        with patch.object(enricher, "_fetch_injury_sync", return_value={
            "LeBron James": "active",
            "Anthony Davis": "inactive",
        }):
            return await enricher.get_injury_report("0022400001")

    result = asyncio.run(run())
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

    async def run():
        with patch.object(enricher, "_fetch_injury_report", new=AsyncMock(return_value={})):
            return await enricher.get_injury_report("0022400001")

    result = asyncio.run(run())
    assert result == {}


def test_injury_report_cache():
    """Drugi poziv sa istim game_id vraća keširan rezultat."""
    enricher = ContextEnricher()
    mock_report = {"stephen curry": "active", "klay thompson": "inactive"}

    async def run():
        with patch.object(enricher, "_fetch_injury_report", new=AsyncMock(return_value=mock_report)) as mock_fetch:
            await enricher.get_injury_report("0022400002")
            await enricher.get_injury_report("0022400002")  # drugi poziv
            # _fetch_injury_report treba biti pozvan SAMO jednom (cache hit na 2. pozivu)
            assert mock_fetch.call_count == 1

    asyncio.run(run())
