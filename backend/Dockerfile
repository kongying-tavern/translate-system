FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN chmod +x startup.sh
RUN npx prisma generate
EXPOSE 8080
CMD ["npx", "tsx", "src/index.ts"]
