# Mini Mentimeter (Backend)

A lightweight live polling API designed for interactive presentations and voting sessions.

## Tech Stack
- **Language**: Python 3.12
- **Framework**: FastAPI
- **Database**: PostgreSQL
- **ORM / Migrations**: SQLAlchemy 2.0 & Alembic
- **Validation & Serialization**: Pydantic v2
- **Testing**: pytest & HTTPX
- **Containerization**: Docker Compose

---

## Getting Started

### Option 1: Running with Docker Compose (Recommended)

1. **Clone or navigate to the directory**:
   ```bash
   cd minimenti
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```

3. **Build and start services**:
   ```bash
   docker compose up --build
   ```
   This will:
   - Start the PostgreSQL database service.
   - Wait for the database to become healthy.
   - Run Alembic migrations automatically (`alembic upgrade head`).
   - Start the FastAPI application on `http://localhost:8000`.

4. **Access the React Web UI & API**:
   - **Poll Creator Page**: `http://localhost:8000/` (Create polls & launch presentations)
   - **Participant Voting Screen**: `http://localhost:8000/?view=vote&poll_id=<id>` (Mobile voting UI)
   - **Live Presenter Screen**: `http://localhost:8000/?view=present&poll_id=<id>` (Real-time SSE projector charts)
   - **Health check**: `http://localhost:8000/health`
   - **Interactive Swagger API docs**: `http://localhost:8000/docs`

5. **Frontend Development with Vite (Optional)**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Runs the React frontend at `http://localhost:3000` with instant HMR and automatic API proxying to `http://localhost:8000`.

---

### Option 2: Cloud Deployment (Render Blueprint - 1-Click)

This repository includes a declarative [`render.yaml`](file:///home/celeste/minimenti/render.yaml) Infrastructure-as-Code blueprint to deploy the PostgreSQL database and FastAPI + React Web Service together:

1. Push your repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** > **Blueprint**.
3. Select your GitHub repository.
4. Render will read [`render.yaml`](file:///home/celeste/minimenti/render.yaml) and automatically:
   - Provision a managed PostgreSQL instance (`minimenti-db`).
   - Build the multi-stage Docker container (React build + Python runtime).
   - Inject the PostgreSQL connection string as `DATABASE_URL`.
   - Run Alembic database migrations on startup.
   - Serve the React SPA and API with HTTPS and native SSE streaming.

---

### Option 3: Running Locally (Host Virtual Environment)

1. **Create and activate a Python 3.12 virtual environment**:
   ```bash
   python3.12 -m venv .venv
   source .venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Start PostgreSQL**:
   ```bash
   docker compose up -d db
   ```

4. **Apply database migrations**:
   ```bash
   alembic upgrade head
   ```

5. **Start the API server**:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

---

## Running Tests

Tests run against an isolated in-memory SQLite database via pytest:

```bash
pytest -v
```

---

## API Endpoints (Phase 1)

### `GET /health`
Returns service status.
- **Response**: `200 OK`
  ```json
  {
    "status": "ok"
  }
  ```

### `POST /polls`
Creates a new poll with 2 to 10 options.
- **Request Body**:
  ```json
  {
    "question": "What is your primary programming language?",
    "options": ["Python", "Rust", "Go"],
    "closes_at": null
  }
  ```
- **Response**: `201 Created` (includes secret `admin_key` only for the creator)
  ```json
  {
    "id": "c1f71dfc-76e3-4ae8-b0a5-296baefc0808",
    "question": "What is your primary programming language?",
    "created_at": "2026-11-15T06:18:22.123456Z",
    "closes_at": null,
    "is_closed": false,
    "admin_key": "9a12c412-f018-49f3-8b71-e8d781b0a881",
    "options": [
      {
        "id": 1,
        "text": "Python",
        "position": 0
      },
      {
        "id": 2,
        "text": "Rust",
        "position": 1
      },
      {
        "id": 3,
        "text": "Go",
        "position": 2
      }
    ]
  }
  ```

### `GET /polls/{id}`
Fetches an existing poll and its options sorted by position.
- **Response**: `200 OK` or `404 Not Found` if the poll does not exist.

### `POST /polls/{id}/votes`
Casts a single vote for an option using a client-generated browser token (`voter_token`).
- **Request Body**:
  ```json
  {
    "option_id": 1,
    "voter_token": "browser-session-uuid-1234"
  }
  ```
- **Responses**:
  - `201 Created`: Vote cast successfully.
  - `400 Bad Request`: Poll is closed/expired or option does not belong to poll.
  - `404 Not Found`: Poll does not exist.
  - `409 Conflict`: This browser/token has already voted in this poll.

### `GET /polls/{id}/results`
Fetches aggregate poll results calculated on-the-fly via SQL aggregation.
- **Response**: `200 OK`
  ```json
  {
    "poll_id": "c1f71dfc-76e3-4ae8-b0a5-296baefc0808",
    "question": "What is your primary programming language?",
    "is_closed": false,
    "total_votes": 3,
    "results": [
      {
        "id": 1,
        "text": "Python",
        "position": 0,
        "vote_count": 2
      },
      {
        "id": 2,
        "text": "Rust",
        "position": 1,
        "vote_count": 1
      },
      {
        "id": 3,
        "text": "Go",
        "position": 2,
        "vote_count": 0
      }
    ]
  }
### `GET /polls/{id}/stream`
Server-Sent Events (SSE) endpoint for live presenter screens. Pushes instant update events whenever a vote is cast.
- **Protocol**: HTTP SSE (`Content-Type: text/event-stream`)
- **Initial Connection**: Immediately pushes current results as the first event.
- **Heartbeat**: Pushes `: ping` comments every 15s to keep connections alive through proxies and firewalls.
### `POST /polls/{id}/close`
Closes a poll to prevent any further voting.
- **Authorization**: Requires `X-Admin-Key: <admin_key>` header (returned upon creation).
- **Responses**:
  - `200 OK`: Poll successfully closed.
  - `403 Forbidden`: Missing or incorrect admin key.
  - `404 Not Found`: Poll does not exist.
- **Broadcast**: Automatically pushes an updated event to any connected SSE viewers reflecting `is_closed: true`.



# minimenti
