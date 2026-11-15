# Architecture & Design Decisions Log

This document records key design decisions made during the development of Mini Mentimeter.
Each entry documents the core question, alternatives considered with trade-offs, the selected decision, and the rationale.

---

## Log

### Decision 1: Duplicate Vote Prevention Mechanism
- **Date**: 2026-11-15
- **Question**: How do we prevent a single participant from voting multiple times in the same poll?
- **Options Considered**:
  1. *Option A (Client-Generated Browser Token)*: Client generates and sends a UUID/token (persisted in LocalStorage/cookies). Backend enforces unique `(poll_id, voter_token)`.
     - *Pros*: Zero friction (no login/passwords); works seamlessly across shared conference/campus Wi-Fi (NAT).
     - *Cons*: Easily bypassed by clearing browser storage or using incognito mode.
  2. *Option B (IP Address Tracking/Rate Limiting)*: Enforce unique `(poll_id, voter_ip)`.
     - *Pros*: No client-side storage dependency.
     - *Cons*: Fails completely in live presentation/classroom environments where hundreds of attendees share the same public NAT IP address.
  3. *Option C (Mandatory User Accounts / Authentication)*: Require users to sign up and authenticate before voting.
     - *Pros*: Highly robust fraud prevention.
     - *Cons*: Extreme friction for live audience participation (people won't sign up during a 5-minute presentation).
  4. *Option D (Pre-Generated Single-Use Tokens)*: Poll creator generates unique single-use voting links.
     - *Pros*: Secure without user accounts.
     - *Cons*: Cannot be displayed on a public slide/screen for an entire room to join simultaneously via one code/link.
- **Chosen Option**: Option A (Client-Generated Browser Token).
- **Rationale**: Live presentation polling prioritizes frictionless, immediate participation and reliability over shared Wi-Fi networks (avoiding NAT collision) over strict fraud protection against malicious participants.

### Decision 2: Vote Mutability
- **Date**: 2026-11-15
- **Question**: Can a participant change their vote, or is a vote final (immutable)?
- **Options Considered**:
  1. *Option 1 (Final / Immutable Votes)*: Unique constraint on `(poll_id, voter_token)`. Subsequent votes return `409 Conflict`.
     - *Pros*: Simple, atomic writes; clear interview narrative around relational uniqueness constraints; prevents chart-flickering during live presentations.
     - *Cons*: Participant cannot correct a misclick.
  2. *Option 2 (Mutable / Updatable Votes)*: Update existing vote if `(poll_id, voter_token)` exists.
     - *Pros*: Forgiving user experience for misclicks.
     - *Cons*: More complex UPSERT logic; live tally fluctuations.
- **Chosen Option**: Option 1 (Final / Immutable Votes).
- **Rationale**: Keeps database transactions predictable and atomic, prevents live chart gaming, and provides a clean demonstration of database-enforced uniqueness constraints.

### Decision 3: Vote Tally Storage & Computation
- **Date**: 2026-11-15
- **Question**: How should vote counts per option be stored and calculated?
- **Options Considered**:
  1. *Option 1 (On-the-Fly SQL Aggregation)*: Compute `COUNT` grouped by `option_id` when results are requested.
     - *Pros*: Single source of truth, eliminates risk of counter drift, eliminates row-level write lock contention when many participants vote for the same option simultaneously.
     - *Cons*: Slightly higher read computational overhead compared to reading a static integer column.
  2. *Option 2 (Denormalized Running Counter on Options Table)*: Increment a `vote_count` column on the option row for each vote.
     - *Pros*: O(1) read time.
     - *Cons*: Write bottlenecks due to row-level locks on popular options; desynchronization risks on rollback/deletion.
- **Chosen Option**: Option 1 (On-the-Fly SQL Aggregation).
- **Rationale**: Prioritizes write concurrency and data integrity during simultaneous voting spikes; provides a clean single source of truth without lock contention.

### Decision 4: Real-Time Live Results Streaming Protocol
- **Date**: 2026-11-15
- **Question**: How should live vote updates be broadcast to presenter screens and participants in real time?
- **Options Considered**:
  1. *Option A (Server-Sent Events / SSE)*: Use a persistent HTTP connection (`GET /polls/{id}/stream`) sending text/event-stream payloads when votes are cast.
     - *Pros*: Native HTTP protocol, built-in browser `EventSource` with auto-reconnection, minimal overhead, perfect fit for unidirectional server-to-client updates.
     - *Cons*: Unidirectional only (clients submit votes via regular HTTP POST).
  2. *Option B (WebSockets)*: Establish full-duplex bi-directional TCP socket connections (`ws://`).
     - *Pros*: Bi-directional communication.
     - *Cons*: Additional stateful connection lifecycle overhead, ping/pong management, and framing complexity when only push updates are needed.
  3. *Option C (Short Polling)*: Client polls `GET /polls/{id}/results` on a 1–2s interval.
     - *Pros*: Simple, no persistent streaming connections.
     - *Cons*: High redundant network and database overhead; noticeable latency lag.
- **Chosen Option**: Option A (Server-Sent Events / SSE).
- **Rationale**: Results broadcasting is inherently unidirectional; SSE uses standard HTTP, integrates natively with browser `EventSource`, and provides real-time updates with minimal architectural complexity.

### Decision 5: Real-Time Event Fanout Architecture
- **Date**: 2026-11-15
- **Question**: How should real-time vote events be broadcast from the HTTP vote handler to active SSE subscriber connections?
- **Options Considered**:
  1. *Option 1 (In-Memory `asyncio.Queue` Broadcaster)*: Maintain in-process subscriber queues mapped to `poll_id`.
     - *Pros*: Zero external dependencies (uses standard library `asyncio`), clean and readable, ultra-low latency, easy to explain in an interview.
     - *Cons*: Single-process only; multi-worker scaling requires a distributed message broker.
  2. *Option 2 (PostgreSQL Native `LISTEN` / `NOTIFY`)*: Publish updates using Postgres notification channels.
     - *Pros*: Works across workers without adding new infrastructure services.
     - *Cons*: Requires an asynchronous long-running connection pool listener; added lifecycle complexity.
  3. *Option 3 (Redis Pub/Sub)*: Use external Redis service to broadcast messages.
     - *Pros*: Standard horizontal scaling pattern.
     - *Cons*: Adds infrastructure overhead (Redis service container, connection management) unnecessary for single-instance learning scope.
- **Chosen Option**: Option 1 (In-Memory `asyncio.Queue` Broadcaster).
- **Rationale**: Minimal moving parts, highly educational and readable, and directly demonstrates Python asynchronous programming patterns without external operational overhead.

### Decision 6: Poll Administration & Creator Authorization
- **Date**: 2026-11-15
- **Question**: How do we authorize the creator to close a poll or manage voting without full user accounts?
- **Options Considered**:
  1. *Option 1 (Creator Secret Key / `admin_key`)*: Generate an `admin_key` (UUID) returned only to the creator upon creation. Require `X-Admin-Key` header (or request body) to close the poll.
     - *Pros*: Zero friction (no accounts/passwords), minimal boilerplate, cleanly separates public shareable voter links from creator control links.
     - *Cons*: If the creator loses their admin key, they cannot recover administrative access.
  2. *Option 2 (Full User Authentication / JWT)*: Require account creation with email/password or OAuth.
     - *Pros*: Central dashboard of polls created across sessions.
     - *Cons*: High friction and extensive boilerplate (users table, password hashing, JWTs) distracting from core live polling mechanics.
  3. *Option 3 (Time-Based Expiration Only)*: Polls close strictly based on `closes_at` timer.
     - *Pros*: No authorization needed.
     - *Cons*: Inflexible for live presenters who need to manually close voting on demand.
- **Chosen Option**: Option 1 (Creator Secret Key / `admin_key`).
- **Rationale**: Provides secure administrative protection for poll lifecycle actions while preserving zero-friction guest poll creation and keeping the codebase small and readable.

### Decision 7: Cross-Origin Resource Sharing (CORS) Policy
- **Date**: 2026-11-15
- **Question**: How should CORS be configured on the FastAPI backend for frontend integration?
- **Options Considered**:
  1. *Option 1 (Configurable Whitelist via Environment Variable with Local Dev Defaults)*: Use `CORSMiddleware` with `settings.CORS_ORIGINS`, defaulting to `["http://localhost:3000", "http://localhost:5173"]`.
     - *Pros*: Follows security best practices by preventing uncontrolled wildcard access; fully configurable via `.env` in production without code changes; works out of the box with standard dev servers (Next.js, Vite).
     - *Cons*: Requires updating `.env` if using a non-standard local frontend port.
  2. *Option 2 (Permissive Wildcard `allow_origins=["*"]`)*: Allow any origin unconditionally.
     - *Pros*: Never blocks any frontend during prototyping.
     - *Cons*: Dangerous in production; bad interview practice.
  3. *Option 3 (Reverse Proxy Pattern without CORS)*: Use Nginx to serve frontend and backend from the same origin.
     - *Pros*: No CORS needed.
     - *Cons*: Overcomplicates local development before a frontend is even built.
- **Chosen Option**: Option 1 (Configurable Whitelist via Environment Variable with Local Dev Defaults).
- **Rationale**: Aligns with production security standards while providing zero-friction integration with standard local frontend tooling (Vite and Next.js).






