from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any


class GameTipsRequest(BaseModel):
    player_name: str = Field(..., example="LeBron James")
    prop_type: str = Field(..., example="points", description="points | rebounds | assists | pra | pts_rebs | pts_asts")
    line: Optional[float] = Field(None, example=26.5, description="The bookmaker's over/under line (auto-fetched if not provided)")
    opponent: Optional[str] = Field(None, example="Boston Celtics")
    event_id: Optional[str] = Field(None, description="Odds API event ID for fetching live lines")
    last_n_games: int = Field(default=10, ge=3, le=30)


class BookmakerOdds(BaseModel):
    over: Optional[float] = None
    under: Optional[float] = None


class TipResponse(BaseModel):
    player_name: str
    prop_type: str
    line: float
    opponent: Optional[str]
    stats_summary: Dict[str, Any]
    recommendation: str          # "OVER" | "UNDER" | "SKIP"
    confidence: int              # 0-100
    reasoning: str
    value_rating: str            # "excellent" | "good" | "fair" | "poor" | "skip"
    key_factors: List[str]
    odds: Dict[str, Dict[str, float]]
    best_bookmaker: Optional[str]
    best_odd: float


class PlayerStatsResponse(BaseModel):
    player_name: str
    team: str
    position: str
    season_averages: Dict[str, float]
    last_n_games: List[Dict[str, Any]]
    averages_last_n: Dict[str, float]
    home_away_splits: Dict[str, Dict[str, float]]
    vs_opponent: Optional[Dict[str, float]]
    recent_trend: str            # "hot" | "cold" | "neutral"
    injury_status: Optional[str]
