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


