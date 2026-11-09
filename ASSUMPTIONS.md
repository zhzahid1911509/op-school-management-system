# Assumptions

- The default installation runs on one computer. The browser uses localhost:8080, while the backend uses the Docker service name db.
- The UI uses port 3000. The assignment fixes the backend port and leaves the frontend port open.
- GET /health is an operational endpoint for verifying startup and database connectivity. Future assignment endpoints retain their specified paths and response shapes.
- The local database account owns the admission schema so startup can initialize it automatically.
