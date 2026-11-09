# Assumptions

- The default installation runs on one computer. The browser uses localhost:8080, while the backend uses the Docker service name db.
- The UI uses port 3000. The assignment fixes the backend port and leaves the frontend port open.
- GET /health is an operational endpoint for verifying startup and database connectivity. Future assignment endpoints retain their specified paths and response shapes.
- The local database account owns the admission schema so startup can initialize it automatically.

- Allocation order follows successful acquisition of the PostgreSQL class-row lock. Simultaneous arrivals have no externally observable strict arrival order.
- All application seat writes go through reserve, transition or expire_due using PostgreSQL's default READ COMMITTED isolation. Separate API processes use the same class locks. The partial unique index also excludes duplicate active or confirmed admissions for a student/class pair.
- Confirmation and cancellation are repeatable for the same owner and same terminal state. Other transitions from terminal states fail with a conflict.
- At the exact database deadline the hold is expired. A cancelled or expired application remains in history and the student may apply again. Confirmation permanently consumes the seat.

- The single-hold status endpoint uses the hold UUID as specified in the assignment and omits the student number. Student history and all hold mutations require exactly one X-Student-Id header with 17 ASCII digits.
- Class names are trimmed and may repeat. UUIDs distinguish classes. Student history includes terminal records, ordered by descending expiry time with UUID as a stable tie-breaker.

## Two API processes

The contract stack runs backend on port 8080 and replica on 8081, both against the same PostgreSQL database. The class row is the serialization point. After the transaction acquires its lock, a fresh read sees committed changes from the preceding request. Expiry comparisons use database time after the lock is acquired. Confirmation changes the existing hold; retries find the same terminal record. The expiry sweep uses the same lock order and skips busy classes. These rules apply regardless of which process handled the request.
