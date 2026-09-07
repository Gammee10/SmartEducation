# Backend production image (M14): install + Prisma client + compiled dist.
# Runtime applies pending migrations, then boots the API.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --no-audit --no-fund
COPY backend ./backend
# Prisma CLI is a runtime dependency (migrations run on boot), so it
# survives `npm prune`. Client generation must precede the tsc build.
RUN npm run prisma:generate --workspace backend \
  && npm run build --workspace backend \
  && npm prune --omit=dev

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
EXPOSE 5000
CMD ["sh", "-c", "npm run prisma:deploy --workspace backend && node backend/dist/index.js"]
