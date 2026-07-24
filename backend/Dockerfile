FROM node:20-slim AS builder
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG APT_MIRROR=mirrors.tuna.tsinghua.edu.cn
ENV COREPACK_NPM_REGISTRY=$NPM_REGISTRY
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY
RUN if [ -n "$APT_MIRROR" ]; then \
      sed -i "s|deb.debian.org|$APT_MIRROR|g; s|security.debian.org|$APT_MIRROR|g" /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
      sed -i "s|deb.debian.org|$APT_MIRROR|g; s|security.debian.org|$APT_MIRROR|g" /etc/apt/sources.list; \
    fi && \
    apt-get update -qq && apt-get install -y -qq openssl && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml .npmrc .
RUN corepack enable && pnpm install
COPY . .
RUN chmod +x startup.sh
RUN npx prisma generate
EXPOSE 8080
CMD ["npx", "tsx", "src/index.ts"]
