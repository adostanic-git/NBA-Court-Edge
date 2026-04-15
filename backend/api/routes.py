from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from typing import Optional
import asyncio
import json
import time
from services.nba_stats import NBAStatsService
from services.ai_analyzer import AIAnalyzer
from services.odds_scraper import OddsScraper
from services.odds_service import OddsAPIService
from services.top_picks import TopPicksService
from services.live_stats import LiveStatsService, _live_cache
from models.schemas import TipResponse, GameTipsRequest

router = APIRouter()
nba_service = NBAStatsService()
ai_analyzer = AIAnalyzer()
odds_scraper = OddsScraper()
odds_service = OddsAPIService()
top_picks_service = TopPicksService()
live_service = LiveStatsService()


@router.get("/games/today")
async def get_todays_games():
    """Today's NBA games."""
    try:
        games = await nba_service.get_todays_games()
        odds_games = await odds_service.get_todays_games_with_odds()
        enriched = []
        for game in games:
            if "error" in game:
                continue
            event_id = None
            home = game.get("home_team", "")
            away = game.get("away_team", "")
            for og in odds_games:
                if home.lower() in og.get("home_team", "").lower() or \
                   away.lower() in og.get("away_team", "").lower():
                    event_id = og.get("event_id")
                    break
            enriched.append({**game, "event_id": event_id})
        return {"games": enriched, "count": len(enriched)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/picks/top10")
async def get_top10_picks(refresh: bool = False):
    """
    AI top 10 value bets for today (max).
    Vraća samo tipove za koje je AI siguran (conf >= 65, value excellent/good).
    Ako nema 10 sigurnih tipova, vraća manje. Cached 30 min.
    """
    try:
        picks = await top_picks_service.get_top_picks(force_refresh=refresh)
        return {"picks": picks, "count": len(picks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Backwards compat — stari URL preusmjerava na novi
@router.get("/picks/top5")
async def get_top5_picks_legacy(refresh: bool = False):
    picks = await top_picks_service.get_top_picks(force_refresh=refresh)
    return {"picks": picks, "count": len(picks)}


@router.get("/player/{player_name}/props")
async def get_player_props_today(player_name: str, event_id: Optional[str] = None):
    """Get available prop lines for a player from odds-api."""
    try:
        if not event_id:
            games = await odds_service.get_todays_games_with_odds()
            stats = await nba_service.get_player_stats(player_name, 3)
            team = stats.get("team", "") if stats else ""
            for g in games:
                if team.lower() in g.get("home_team", "").lower() or \
                   team.lower() in g.get("away_team", "").lower():
                    event_id = g.get("event_id")
                    break

        if not event_id:
            return {"player": player_name, "props": {}, "message": "No game today or ODDS_API_KEY missing"}

        props = {}
        for prop_type in ["points", "rebounds", "assists", "pra"]:
            data = await odds_service.get_player_line(player_name, event_id, prop_type)
            if data:
                props[prop_type] = data

        return {"player": player_name, "event_id": event_id, "props": props}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tips/analyze")
async def analyze_player_prop(request: GameTipsRequest):
    """Full analysis: auto-fetches opponent + line if not provided."""
    try:
        import asyncio

        stats = await nba_service.get_player_stats(request.player_name, request.last_n_games)
        if not stats:
            raise HTTPException(status_code=404, detail=f"Player '{request.player_name}' not found")

        line = request.line
        event_id = request.event_id

        # Auto-fetch line from odds-api if not provided
        if not line and event_id:
            prop_data = await odds_service.get_player_line(request.player_name, event_id, request.prop_type)
            if prop_data:
                line = prop_data.get("line")

        # Fallback line from season avg
        if not line:
            stat_key = {"points": "pts", "rebounds": "reb", "assists": "ast", "pra": "pra"}.get(request.prop_type, "pts")
            season_avg = stats.get("season_averages", {}).get(stat_key, 0)
            line = round(season_avg * 0.95 * 2) / 2

        # Auto-detect opponent from today's schedule
        opponent = request.opponent
        if not opponent:
            games = await nba_service.get_todays_games()
            team = stats.get("team", "")
            for g in games:
                if "error" in g:
                    continue
                home, away = g.get("home_team", ""), g.get("away_team", "")
                home_city = g.get("home_city", "")
                away_city = g.get("away_city", "")
                if team in home or team in home_city:
                    opponent = f"{g.get('away_city', '')} {away}".strip()
                    break
                elif team in away or team in away_city:
                    opponent = f"{g.get('home_city', '')} {home}".strip()
                    break

        odds_task = odds_scraper.get_player_prop_odds(request.player_name, request.prop_type, line)
        analysis_task = ai_analyzer.analyze_prop(
            player_name=request.player_name,
            prop_type=request.prop_type,
            line=line,
            stats=stats,
            opponent=opponent
        )
        odds_result, analysis_result = await asyncio.gather(odds_task, analysis_task, return_exceptions=True)

        odds = odds_result if not isinstance(odds_result, Exception) else {}
        analysis = analysis_result if not isinstance(analysis_result, Exception) else {
            "recommendation": "N/A", "confidence": 0,
            "reasoning": "AI analysis unavailable", "value_rating": "unknown"
        }

        best_bookmaker, best_odd = None, 0.0
        if odds:
            direction_key = "over" if "OVER" in analysis.get("recommendation", "") else "under"
            for bookmaker, book_odds in odds.items():
                if direction_key in book_odds and book_odds[direction_key] > best_odd:
                    best_odd = book_odds[direction_key]
                    best_bookmaker = bookmaker

        return TipResponse(
            player_name=request.player_name,
            prop_type=request.prop_type,
            line=line,
            opponent=opponent,
            stats_summary=stats,
            recommendation=analysis.get("recommendation", "SKIP"),
            confidence=analysis.get("confidence", 0),
            reasoning=analysis.get("reasoning", ""),
            value_rating=analysis.get("value_rating", "unknown"),
            key_factors=analysis.get("key_factors", []),
            odds=odds,
            best_bookmaker=best_bookmaker,
            best_odd=best_odd
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/player/{player_name}/stats")
async def get_player_stats(
    player_name: str,
    last_n_games: int = Query(default=10, ge=3, le=30)
):
    try:
        stats = await nba_service.get_player_stats(player_name, last_n_games)
        if not stats:
            raise HTTPException(status_code=404, detail=f"Player '{player_name}' not found")
        return stats
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tips/quick/{player_name}")
async def quick_tips(player_name: str, opponent: Optional[str] = None, last_n_games: int = 10):
    try:
        stats = await nba_service.get_player_stats(player_name, last_n_games)
        if not stats:
            raise HTTPException(status_code=404, detail=f"Player '{player_name}' not found")
        tips = await ai_analyzer.analyze_all_props(player_name=player_name, stats=stats, opponent=opponent)
        return {"player": player_name, "tips": tips}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/games/live")
async def get_live_games():
    """Live rezultati + raspored sa srpskim vremenom."""
    try:
        games = await live_service.get_live_games()
        live = [g for g in games if g.get("is_live")]
        scheduled = [g for g in games if not g.get("is_live") and not g.get("is_final")]
        final = [g for g in games if g.get("is_final")]
        return {
            "games": games,
            "live_count": len(live),
            "scheduled_count": len(scheduled),
            "final_count": len(final),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/games/live/stream")
async def stream_live_games(request: Request):
    """
    SSE stream: šalje update svaki put kad se cache promeni.
    Klijent dobije novi podatak čim poller osvježi cache (3s live / 30s idle).
    """
    async def event_gen():
        last_ts = -1
        # Odmah pošaljemo trenutni cache ako postoji
        if _live_cache["ts"] > 0:
            yield f"data: {json.dumps(_live_cache)}\n\n"
            last_ts = _live_cache["ts"]
        while True:
            if await request.is_disconnected():
                break
            if _live_cache["ts"] > last_ts:
                last_ts = _live_cache["ts"]
                yield f"data: {json.dumps(_live_cache)}\n\n"
            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/player/{player_name}/live")
async def get_player_live_stats(player_name: str):
    """Live stats igrača ako mu je meč u toku."""
    try:
        stats = await live_service.get_player_live_stats(player_name)
        return stats or {"is_live": False, "player_name": player_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tips/check")
async def check_tip_result(
    player_name: str,
    prop_type: str,
    line: float,
    game_date: str
):
    """Proverava da li je tip pogođen na osnovu game loga."""
    try:
        result = await live_service.check_tip_result(player_name, prop_type, line, game_date)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))