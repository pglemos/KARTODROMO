# Site Next (app/) rodando em Node na VPS, fora da Cloudflare. Build: docker build -f services/next/Dockerfile .
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts
COPY . .
ARG NEXT_PUBLIC_DEFAULT_UID=""
ENV NEXT_PUBLIC_DEFAULT_UID=$NEXT_PUBLIC_DEFAULT_UID NEXT_STANDALONE=1
RUN npx next build --webpack

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 TZ=America/Sao_Paulo
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/migrations ./migrations
USER node
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
