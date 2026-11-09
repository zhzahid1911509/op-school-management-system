FROM node:22-bookworm-slim AS driver
WORKDIR /suite
COPY browser/package*.json ./
RUN npm ci --no-audit --no-fund --fetch-retries=2 --fetch-timeout=60000 --loglevel=http

# Reuse the Chromium image already fetched by the v0.5.0 acceptance runner.
FROM mcr.microsoft.com/playwright/python:v1.55.0-noble
WORKDIR /suite
COPY --from=driver /usr/local/bin/node /usr/local/bin/node
COPY --from=driver /suite/node_modules ./node_modules
COPY browser/flow.mjs ./
CMD ["node", "flow.mjs"]
