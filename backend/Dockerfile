FROM node:20-slim AS builder
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV COREPACK_NPM_REGISTRY=$NPM_REGISTRY
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY
RUN apt-get update -qq && apt-get install -y -qq openssl && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml .npmrc .
RUN corepack enable && pnpm install
COPY . .
RUN chmod +x startup.sh
RUN npx prisma generate
EXPOSE 8080
CMD ["npx", "tsx", "src/index.ts"]
