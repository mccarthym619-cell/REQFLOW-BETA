# --- Builder stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools required by better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

# Copy package files for dependency installation
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY shared/ shared/
COPY server/ server/
COPY client/ client/
COPY tsconfig.base.json .

# Build shared (needed at runtime by server) and client (static assets)
# Use npm exec for client to skip tsc type-check while keeping workspace resolution
RUN npm run build -w shared && \
    npm exec -w client -- vite build

# --- Production stage ---
FROM node:20-alpine

WORKDIR /app

# Install build tools required by better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy shared dist (compiled JS needed by server at runtime)
COPY --from=builder /app/shared/dist/ shared/dist/

# Copy server source (tsx runs TypeScript directly)
COPY --from=builder /app/server/src/ server/src/
COPY --from=builder /app/server/tsconfig.json server/

# Copy client dist (static assets served by Express)
COPY --from=builder /app/client/dist/ client/dist/

# Copy base tsconfig (needed by server tsconfig extends)
COPY --from=builder /app/tsconfig.base.json .

# Create data directories for SQLite + uploads (mount as volume in Railway)
RUN mkdir -p /app/data/uploads

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["npx", "tsx", "server/src/index.ts"]
