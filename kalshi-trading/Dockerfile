FROM debian:12-slim

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV MISE_DATA_DIR=/mise
ENV MISE_CACHE_DIR=/mise/cache
ENV MISE_INSTALL_PATH=/usr/local/bin/mise
ENV PATH=/mise/shims:/mise/bin:${PATH}

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git xz-utils coreutils \
  && rm -rf /var/lib/apt/lists/*

RUN curl https://mise.run | sh

COPY kalshi-trading/mise.toml ./

RUN mise trust \
  && mise install

# Copy manifests only — this layer is cached as long as deps don't change
COPY kalshi-trading/pyproject.toml kalshi-trading/uv.lock ./

# Install third-party deps
RUN uv sync --frozen --no-dev

# Copy source
COPY kalshi-trading/src ./src
RUN uv sync --frozen --no-dev

CMD ["uv", "run", "--frozen", "--no-dev", "python", "src/main.py"]
