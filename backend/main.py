import asyncio
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from api.routes import router, top_picks_service
from services.cache import init_cache
from services.live_stats import start_live_poller
from auth import router as auth_router, init_db, save_picks_to_db

SERBIA_TZ = ZoneInfo("Europe/Belgrade")


async def _daily_picks_scheduler():
    """
    Pokreće auto-generisanje tipova svaki dan u 16:00 (srbijansko vreme).
    Ako backend startuje nakon 16:00, generiše odmah pa čeka sutrašnji slot.
    """
    first_run = True
    while True:
        now = datetime.now(SERBIA_TZ)
        target = now.replace(hour=16, minute=0, second=0, microsecond=0)

        if now >= target:
            if first_run:
                # Backend startovao nakon 16:00 — generišemo odmah
                print("[Scheduler] Backend startovao nakon 16:00 — pokrecem generisanje odmah...")
                try:
                    picks = await top_picks_service.get_top_picks(force_refresh=True)
                    saved = save_picks_to_db(picks)
                    print(f"[Scheduler] Generisano {len(picks)} tipova, upisano u bazu: {saved}.")
                except Exception as e:
                    print(f"[Scheduler] Greska pri generisanju: {e}")
            target += timedelta(days=1)

        first_run = False
        wait_secs = (target - now).total_seconds()
        h, m = divmod(int(wait_secs), 3600)
        m //= 60
        print(f"[Scheduler] Sledece generisanje u 16:00 — za {h}h {m}m")

        await asyncio.sleep(wait_secs)

        print("[Scheduler] 16:00 — pokrecem auto-generisanje AI tipova...")
        try:
            picks = await top_picks_service.get_top_picks(force_refresh=True)
            saved = save_picks_to_db(picks)
            print(f"[Scheduler] Generisano {len(picks)} tipova, upisano u bazu: {saved}.")
        except Exception as e:
            print(f"[Scheduler] Greska pri generisanju: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_cache()
    init_db()
    scheduler_task   = asyncio.create_task(_daily_picks_scheduler())
    live_poller_task = asyncio.create_task(start_live_poller())
    yield
    scheduler_task.cancel()
    live_poller_task.cancel()
    for t in (scheduler_task, live_poller_task):
        try:
            await t
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="NBA Tips API",
    description="AI-powered NBA betting tips with odds comparison",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://nba-court-edge-seven.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.include_router(auth_router, prefix="/api/auth")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "NBA Tips API v2"}