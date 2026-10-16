FROM node:20-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY worker.mjs ./
# o volume de mídia herda esse dono na primeira montagem
RUN mkdir -p /data/media/hls && chown -R node:node /data/media
USER node
CMD ["node", "worker.mjs"]
