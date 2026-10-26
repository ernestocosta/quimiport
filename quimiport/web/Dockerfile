# ---------- build: gera o servidor Node autocontido em .output/ ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Endereço público da API, embutido no bundle do navegador.
ARG VITE_API_URL=http://localhost:3333
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---------- produção: só o .output (sem node_modules) ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0
COPY --from=build /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
