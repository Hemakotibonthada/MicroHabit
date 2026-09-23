FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY client ./client
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production PORT=4003
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && mkdir -p /app/data && chown -R node:node /app/data
COPY --from=build /app/client/dist ./client/dist
COPY server ./server
COPY shared ./shared
USER node
EXPOSE 4003
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:4003/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
