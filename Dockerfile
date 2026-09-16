FROM ubuntu:24.04

WORKDIR /app

RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production

COPY . .
EXPOSE 3030

CMD ["node", "server.js"]
