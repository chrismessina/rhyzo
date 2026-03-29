# Base image
FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Development target
FROM base AS dev
COPY package*.json ./
RUN npm ci
COPY . .
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production build
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
# Accept base URL at build time so Next.js can inline it into client bundles
ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
RUN mkdir -p /app/data && npm run build

# Production target
FROM node:20-alpine AS production
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/db/migrate.ts ./src/db/migrate.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
RUN mkdir -p /app/data
EXPOSE 3000
ENV NODE_ENV=production
# Run DB migrations then start the server
CMD ["sh", "-c", "./node_modules/.bin/tsx src/db/migrate.ts && node server.js"]
