# syntax=docker/dockerfile:1

# ---- deps: install once, cached across builds unless package.json/lockfile change ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/package.json
COPY packages/llm-synthesis/package.json packages/llm-synthesis/package.json
COPY packages/web/package.json packages/web/package.json
RUN npm ci

# ---- build: full monorepo source + node_modules, run the Next.js build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=@codeatlas/web

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# analyzeRepository shells out to `git` (churn parsing, reading the
# current commit/remote) — not present in the base node image by default.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# The whole built monorepo, including .git: self-analysis (demo beat 1,
# "run CodeAtlas on itself") needs real source files AND real git history
# on disk at runtime, not just the compiled Next.js server output.
COPY --from=build /app ./

EXPOSE 3000

CMD ["npm", "start", "--workspace=@codeatlas/web"]
