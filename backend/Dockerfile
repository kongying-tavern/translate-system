FROM node:20-alpine
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV COREPACK_NPM_REGISTRY=$NPM_REGISTRY
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install
COPY . .
RUN chmod +x startup.sh
RUN npx prisma generate
EXPOSE 8080
CMD ["npx", "tsx", "src/index.ts"]
