# Assumptions

- The default installation runs on one computer. The browser uses localhost:8080, while the backend uses the Docker service name db.
- The UI uses port 3000. The assignment fixes the backend port and leaves the frontend port open.
- GET /health is an operational endpoint for verifying startup and database connectivity. Future assignment endpoints retain their specified paths and response shapes.
- The local database account owns the admission schema so startup can initialize it automatically.

- Allocation order follows successful acquisition of the PostgreSQL class-row lock. Simultaneous arrivals have no externally observable strict arrival order.
- All application seat writes go through reserve, transition or expire_due using PostgreSQL's default READ COMMITTED isolation. Separate API processes use the same class locks. The partial unique index also excludes duplicate active or confirmed admissions for a student/class pair.
- Confirmation and cancellation are repeatable for the same owner and same terminal state. Other transitions from terminal states fail with a conflict.
- At the exact database deadline the hold is expired. A cancelled or expired application remains in history and the student may apply again. Confirmation permanently consumes the seat.
