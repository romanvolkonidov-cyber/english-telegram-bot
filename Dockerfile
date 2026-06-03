# Minimal image for the long-polling bot.
FROM node:22-slim

WORKDIR /app

# Install dependencies (tsx is needed at runtime to execute the TS entrypoint).
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV NODE_ENV=production

# Long polling needs no inbound port. Provide secrets via env (-e / --env-file).
CMD ["npm", "start"]
