# NBA Tips AI 🏀

AI-powered NBA player prop analyzer. Analizira statistiku igrača i daje OVER/UNDER preporuke sa poređenjem kvota srpskih kladionica.

## Stack

- **Backend**: Python 3.11+ / FastAPI / nba_api / Playwright
- **Frontend**: React 18 / Vite / Recharts
- **AI**: Claude API (claude-sonnet-4-20250514)
- **Scraping**: httpx + Playwright (fallback)

---

## Pokretanje (Development)

### 1. Backend

```bash
cd backend

# Kreiraj virtualenv
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instaliraj dependencies
pip install -r requirements.txt

# Instaliraj Playwright browser (za kladionice koje blokiraju httpx)
playwright install chromium

# Kopiraj .env i dodaj API key
cp .env.example .env
# Otvori .env i upiši ANTHROPIC_API_KEY=sk-ant-...

# Pokreni server
uvicorn main:app --reload --port 8000
```

Backend radi na: http://localhost:8000  
Swagger docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend

npm install
npm run dev
```

Frontend radi na: http://localhost:5173

---

## API Endpoints

### `POST /api/tips/analyze`
Analizira jedan prop bet.

```json
{
  "player_name": "LeBron James",
  "prop_type": "points",
  "line": 26.5,
  "opponent": "Boston Celtics",
  "last_n_games": 10
}
```

**Response:**
```json
{
  "player_name": "LeBron James",
  "prop_type": "points",
  "line": 26.5,
  "recommendation": "OVER",
  "confidence": 74,
  "reasoning": "LeBron prosečno beleži 29.4 poena u poslednjih 10 utakmica...",
  "value_rating": "good",
  "key_factors": ["Avg 29.4 > linija 26.5", "Vrela forma", "Dobri H2H rezultati"],
  "odds": {
    "meridian": {"over": 1.87, "under": 1.93},
    "mozzart":  {"over": 1.92, "under": 1.88},
    "maxbet":   {"over": 1.85, "under": 1.95}
  },
  "best_bookmaker": "mozzart",
  "best_odd": 1.92
}
```

### `GET /api/tips/quick/{player_name}`
Auto-analizira sve relevantne propove za igrača.

### `GET /api/player/{player_name}/stats?last_n_games=10`
Vraća detaljnu statistiku igrača.

### `GET /api/games/today`
Današnje NBA utakmice.

---

## Tipovi propova

| Vrednost     | Opis                    |
|--------------|-------------------------|
| `points`     | Poeni                   |
| `rebounds`   | Skokovi                 |
| `assists`    | Asistencije             |
| `pra`        | Poeni + Skokovi + Asist |
| `pts_rebs`   | Poeni + Skokovi         |
| `pts_asts`   | Poeni + Asistencije     |

---

## Scraping kladionica

### Trenutni status

| Kladionica | Metoda    | Status      |
|------------|-----------|-------------|
| Meridian   | REST API  | Implementirano |
| Mozzart    | REST API  | Implementirano |
| MaxBet     | REST API  | Implementirano |

> **Napomena**: Srpske kladionice povremeno menjaju API endpoint-e i ne nude player props za sve mečeve. Kada scraper ne nađe podatke, aplikacija generiše realistične demo kvote za prikaz (označene u konzoli kao `[DEMO]`).

### Playwright fallback
Ako httpx scraper ne uspe, sistem automatski koristi Playwright (headless browser) koji presreće API pozive koje bookmaker sajt sam pravi. Sporije (~5s) ali pouzdanije.

---

## Arhitektura

```
User
 │
 ▼
React Frontend (Vite)
 │  POST /api/tips/analyze
 ▼
FastAPI Backend
 ├── NBAStatsService      ← nba_api (stats.nba.com, besplatno)
 ├── OddsScraper          ← httpx → Meridian/Mozzart/MaxBet API
 │    └── PlaywrightScraper  ← fallback za JS-heavy sajtove
 └── AIAnalyzer           ← Claude API → strukturiran JSON tip
```

---

## Razvoj — sledeći koraci

- [ ] Dodati Admiral i SBbet scraper
- [ ] Cron job za automatsko osvežavanje kvota svakih 30min
- [ ] Istorija tipova u SQLite (praćenje tačnosti)
- [ ] Notifikacije kada se pojavi value bet
- [ ] Podrška za fudbal (1X2, BTTS, over/under golova)
- [ ] Lineup checker (NBA starter status pre utakmice)

---

## Environment varijable

| Varijabla          | Opis                              | Obavezna |
|--------------------|-----------------------------------|----------|
| `ANTHROPIC_API_KEY`| Claude API ključ                  | Da       |
| `REDIS_URL`        | Redis URL (opcioni cache)         | Ne       |
| `PORT`             | Port za backend (default: 8000)   | Ne       |
