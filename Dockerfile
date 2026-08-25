# FleetOps — app (TanStack Start + Hono API) + built for Node
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NITRO_PRESET=node-server
RUN npm run build

# ——— Runtime ———
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache bash postgresql-client

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/database ./database
COPY --from=builder /app/supabase/migrations ./supabase/migrations
COPY scripts/docker-entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh /app/scripts/db-init.sh

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
