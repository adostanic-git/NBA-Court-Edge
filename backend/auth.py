"""
Auth Service — JWT + SQLite
Tabele: users, tip_history, daily_games, ai_picks
"""
import os, sqlite3, hashlib, hmac, json, base64, time
from typing import Optional, Dict
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()
security = HTTPBearer()

SECRET_KEY = os.getenv("JWT_SECRET", "court-edge-secret-change-this")
DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("""CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )""")

    # Unique na user+player+prop+linija+datum — sprečava duplikate
    c.execute("""CREATE TABLE IF NOT EXISTS tip_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        player_name TEXT, prop_type TEXT, line REAL,
        recommendation TEXT, confidence INTEGER, reasoning TEXT,
        value_rating TEXT, key_factors TEXT, odds_data TEXT,
        game_date TEXT DEFAULT (date('now')),
        created_at TEXT DEFAULT (datetime('now')),
        result INTEGER DEFAULT NULL,
        actual_value REAL DEFAULT NULL,
        result_checked_at TEXT DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, player_name, prop_type, line, game_date)
    )""")
    # Migracija — dodaj kolone ako ne postoje (za stare baze)
    for col_def in [
        ("result", "INTEGER DEFAULT NULL"),
        ("actual_value", "REAL DEFAULT NULL"),
        ("result_checked_at", "TEXT DEFAULT NULL"),
    ]:
        try:
            c.execute(f"ALTER TABLE tip_history ADD COLUMN {col_def[0]} {col_def[1]}")
        except Exception:
            pass  # Kolona već postoji

    # Keš mečeva po datumu
    c.execute("""CREATE TABLE IF NOT EXISTS daily_games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_date TEXT NOT NULL,
        game_id TEXT, home_team TEXT, away_team TEXT,
        home_city TEXT, away_city TEXT, status TEXT, game_time TEXT,
        cached_at TEXT DEFAULT (datetime('now')),
        UNIQUE(game_date, home_team, away_team)
    )""")

    # Keš AI tipova po datumu — ne generiše se ponovo ako već postoje
    c.execute("""CREATE TABLE IF NOT EXISTS ai_picks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pick_date TEXT NOT NULL,
        player_name TEXT NOT NULL, team TEXT, opponent TEXT,
        prop_type TEXT, line REAL, avg_last_10 REAL,
        recommendation TEXT, confidence INTEGER, reasoning TEXT,
        value_rating TEXT, key_factors TEXT, edge TEXT, odds_data TEXT,
        is_home INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(pick_date, player_name, prop_type)
    )""")

    conn.commit()
    conn.close()


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ─── Auth helpers ─────────────────────────────────────────────────────────────

def hash_password(pw: str) -> str:
    salt = os.urandom(16).hex()
    return f"{salt}:{hashlib.sha256(f'{salt}{pw}'.encode()).hexdigest()}"

def verify_password(pw: str, stored: str) -> bool:
    try:
        salt, h = stored.split(":")
        return hmac.compare_digest(hashlib.sha256(f"{salt}{pw}".encode()).hexdigest(), h)
    except:
        return False

def create_token(uid: int, email: str) -> str:
    h = base64.urlsafe_b64encode(json.dumps({"alg":"HS256","typ":"JWT"}).encode()).decode().rstrip("=")
    p = base64.urlsafe_b64encode(json.dumps({"sub":uid,"email":email,"exp":int(time.time())+604800}).encode()).decode().rstrip("=")
    sig = hmac.new(SECRET_KEY.encode(), f"{h}.{p}".encode(), hashlib.sha256).hexdigest()
    return f"{h}.{p}.{sig}"

def verify_token(token: str) -> Optional[Dict]:
    try:
        h, p, sig = token.split(".")
        if not hmac.compare_digest(hmac.new(SECRET_KEY.encode(), f"{h}.{p}".encode(), hashlib.sha256).hexdigest(), sig):
            return None
        data = json.loads(base64.urlsafe_b64decode(p + "=" * (4 - len(p) % 4)))
        return data if data.get("exp", 0) > time.time() else None
    except:
        return None

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    data = verify_token(creds.credentials)
    if not data:
        raise HTTPException(401, "Invalid or expired token")
    conn = get_db()
    user = conn.execute("SELECT id,username,email,created_at FROM users WHERE id=?", (data["sub"],)).fetchone()
    conn.close()
    if not user:
        raise HTTPException(401, "User not found")
    return dict(user)


# ─── Auth ─────────────────────────────────────────────────────────────────────

@router.post("/register")
async def register(req: RegisterRequest):
    if len(req.password) < 6: raise HTTPException(400, "Lozinka mora imati najmanje 6 karaktera")
    if len(req.username) < 2: raise HTTPException(400, "Korisničko ime mora imati najmanje 2 karaktera")
    conn = get_db()
    try:
        c = conn.execute("INSERT INTO users (username,email,password_hash) VALUES (?,?,?)",
            (req.username.strip(), req.email.lower().strip(), hash_password(req.password)))
        uid = c.lastrowid; conn.commit()
    except sqlite3.IntegrityError:
        conn.close(); raise HTTPException(400, "Korisničko ime ili email već postoji")
    conn.close()
    return {"token": create_token(uid, req.email), "user": {"id": uid, "username": req.username, "email": req.email}}

@router.post("/login")
async def login(req: LoginRequest):
    conn = get_db()
    u = conn.execute("SELECT * FROM users WHERE email=?", (req.email.lower().strip(),)).fetchone()
    conn.close()
    if not u or not verify_password(req.password, u["password_hash"]):
        raise HTTPException(401, "Pogrešan email ili lozinka")
    return {"token": create_token(u["id"], u["email"]),
            "user": {"id": u["id"], "username": u["username"], "email": u["email"], "created_at": u["created_at"]}}

@router.get("/me")
async def me(cu=Depends(get_current_user)): return cu


# ─── Tip historija ────────────────────────────────────────────────────────────

@router.post("/history/save")
async def save_tip(tip: dict, cu=Depends(get_current_user)):
    """INSERT OR IGNORE — ne pravi duplikat ako je isti igrač+prop+linija danas."""
    conn = get_db()
    try:
        conn.execute("""INSERT OR IGNORE INTO tip_history
            (user_id,player_name,prop_type,line,recommendation,confidence,
             reasoning,value_rating,key_factors,odds_data)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (cu["id"], tip.get("player_name"), tip.get("prop_type"), tip.get("line"),
             tip.get("recommendation"), tip.get("confidence"), tip.get("reasoning"),
             tip.get("value_rating"), json.dumps(tip.get("key_factors", [])),
             json.dumps(tip.get("odds", {}))))
        saved = conn.execute("SELECT changes()").fetchone()[0]
        conn.commit()
    finally:
        conn.close()
    return {"saved": saved > 0, "duplicate": saved == 0,
            "message": "Već sačuvano!" if saved == 0 else "Tip sačuvan!"}

@router.get("/history")
async def get_history(cu=Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute("""SELECT id,player_name,prop_type,line,recommendation,confidence,
        reasoning,value_rating,key_factors,odds_data,game_date,created_at,
        result,actual_value,result_checked_at
        FROM tip_history WHERE user_id=? ORDER BY created_at DESC LIMIT 300""",
        (cu["id"],)).fetchall()
    conn.close()
    return {"history": [{**dict(r),
        "key_factors": json.loads(r["key_factors"] or "[]"),
        "odds": json.loads(r["odds_data"] or "{}"),
        "result": r["result"],  # 1=hit, 0=miss, None=unchecked
        "actual_value": r["actual_value"],
        "result_checked_at": r["result_checked_at"],
    } for r in rows]}


@router.post("/history/result")
async def save_tip_result(payload: dict, cu=Depends(get_current_user)):
    """Sačuvaj rezultat tipa (hit/miss) u bazu da se ne proverava svaki put."""
    tip_id = payload.get("tip_id")
    hit = payload.get("hit")       # True/False
    actual = payload.get("actual") # stvarna vrednost stats
    if tip_id is None or hit is None:
        raise HTTPException(400, "tip_id i hit su obavezni")
    conn = get_db()
    from datetime import datetime
    conn.execute(
        """UPDATE tip_history SET result=?, actual_value=?, result_checked_at=?
           WHERE id=? AND user_id=?""",
        (1 if hit else 0, actual, datetime.now().isoformat(), tip_id, cu["id"])
    )
    conn.commit()
    conn.close()
    return {"saved": True}


# ─── Mečevi keš ───────────────────────────────────────────────────────────────

@router.post("/games/cache")
async def cache_games(payload: dict, cu=Depends(get_current_user)):
    from datetime import date
    today = str(date.today())
    conn = get_db(); saved = 0
    for g in payload.get("games", []):
        try:
            conn.execute("""INSERT OR IGNORE INTO daily_games
                (game_date,game_id,home_team,away_team,home_city,away_city,status,game_time)
                VALUES (?,?,?,?,?,?,?,?)""",
                (today, g.get("game_id"), g.get("home_team"), g.get("away_team"),
                 g.get("home_city"), g.get("away_city"), g.get("status"), g.get("game_time")))
            saved += conn.execute("SELECT changes()").fetchone()[0]
        except: pass
    conn.commit(); conn.close()
    return {"cached": saved, "date": today}

@router.get("/games/cached")
async def get_cached_games(cu=Depends(get_current_user)):
    from datetime import date
    today = str(date.today())
    conn = get_db()
    rows = conn.execute("SELECT * FROM daily_games WHERE game_date=? ORDER BY id", (today,)).fetchall()
    conn.close()
    return {"games": [dict(r) for r in rows], "date": today, "count": len(rows)}


# ─── AI Picks keš ─────────────────────────────────────────────────────────────

def save_picks_to_db(picks: list) -> int:
    """Direktno upisuje AI tipove u bazu — koristi scheduler (bez auth)."""
    from datetime import date
    today = str(date.today())
    conn = get_db()
    saved = 0
    for p in picks:
        try:
            conn.execute("""INSERT OR IGNORE INTO ai_picks
                (pick_date,player_name,team,opponent,prop_type,line,avg_last_10,
                 recommendation,confidence,reasoning,value_rating,key_factors,edge,odds_data,is_home)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (today, p.get("player_name"), p.get("team"), p.get("opponent"),
                 p.get("prop_type"), p.get("line"), p.get("avg_last_10"),
                 p.get("recommendation"), p.get("confidence"), p.get("reasoning"),
                 p.get("value_rating"), json.dumps(p.get("key_factors", [])),
                 p.get("edge"), json.dumps(p.get("odds", {})), 1 if p.get("is_home") else 0))
            saved += conn.execute("SELECT changes()").fetchone()[0]
        except Exception:
            pass
    conn.commit()
    conn.close()
    return saved


@router.post("/picks/cache")
async def cache_picks(payload: dict, cu=Depends(get_current_user)):
    from datetime import date
    today = str(date.today())
    conn = get_db(); saved = 0
    for p in payload.get("picks", []):
        try:
            conn.execute("""INSERT OR IGNORE INTO ai_picks
                (pick_date,player_name,team,opponent,prop_type,line,avg_last_10,
                 recommendation,confidence,reasoning,value_rating,key_factors,edge,odds_data,is_home)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (today, p.get("player_name"), p.get("team"), p.get("opponent"),
                 p.get("prop_type"), p.get("line"), p.get("avg_last_10"),
                 p.get("recommendation"), p.get("confidence"), p.get("reasoning"),
                 p.get("value_rating"), json.dumps(p.get("key_factors", [])),
                 p.get("edge"), json.dumps(p.get("odds", {})), 1 if p.get("is_home") else 0))
            saved += conn.execute("SELECT changes()").fetchone()[0]
        except: pass
    conn.commit(); conn.close()
    return {"cached": saved, "date": today}

@router.get("/picks/cached")
async def get_cached_picks(cu=Depends(get_current_user)):
    from datetime import date
    today = str(date.today())
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM ai_picks WHERE pick_date=? ORDER BY confidence DESC", (today,)
    ).fetchall()
    conn.close()
    return {"picks": [{**dict(r),
        "key_factors": json.loads(r["key_factors"] or "[]"),
        "odds": json.loads(r["odds_data"] or "{}"),
        "is_home": bool(r["is_home"])} for r in rows],
        "date": today, "count": len(rows)}