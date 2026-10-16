# Multi-stage production build for Aegentix Sovereign OS
# Stage 1: Build & Bundle
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source tree and compile assets
COPY . .
RUN npm run build

# Stage 2: Minimal hardened runtime (NIST SP 800-190 container compliance)
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Security hardening: run as non-root node user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=builder /app/package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src/data ./src/data

# Give non-root user permissions
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000 7777

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/mcp/info || exit 1

CMD ["node", "dist/server.js"]
