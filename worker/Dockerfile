FROM node:22-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY worker.mjs ./
# roda como root: o volume de mídia é compartilhado com o nginx e pode nascer com dono root
RUN mkdir -p /data/media/hls
CMD ["node", "worker.mjs"]
