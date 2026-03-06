FROM debian:12-slim

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
WORKDIR /app

ENV NODE_ENV=production
ENV MISE_DATA_DIR=/mise
ENV MISE_CACHE_DIR=/mise/cache
ENV MISE_INSTALL_PATH=/usr/local/bin/mise
ENV PATH=/mise/shims:/mise/bin:${PATH}

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git xz-utils coreutils libatomic1 \
  && rm -rf /var/lib/apt/lists/*

RUN curl https://mise.run | sh

COPY ingest/mise.toml ./mise.toml

RUN mise trust \
  && mise install

# Copy workspace manifests — this layer is cached as long as deps don't change
COPY ingest/pnpm-workspace.yaml ingest/package.json ingest/pnpm-lock.yaml ingest/tsconfig.base.json ./
COPY ingest/common/package.json ingest/common/tsconfig.json ./common/
COPY ingest/kalshi/orderbooks/package.json ingest/kalshi/orderbooks/tsconfig.json ./kalshi/orderbooks/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY ingest/common/src ./common/src
COPY ingest/kalshi/orderbooks/src ./kalshi/orderbooks/src
RUN pnpm --filter @firm/common build
RUN pnpm --filter @firm/kalshi-orderbooks build

CMD ["node", "kalshi/orderbooks/dist/main.js"]
