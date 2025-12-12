FROM node:20-slim

# FORCE CACHE BUST — DO NOT REMOVE
ARG CACHE_BUST=2025-12-12-18-55
RUN echo "Cache bust: $CACHE_BUST"

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
