# Harness plan web app. No npm install step: the app uses only Node's built-in modules.
# Set APP_PASSWORD as an app setting on the host: the server refuses to start without it.
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/home/data \
    AUTH_MODE=none

COPY package.json server.js ./
COPY src ./src
COPY public ./public

# /home is the persistent share on Azure App Service (WEBSITES_ENABLE_APP_SERVICE_STORAGE=true).
RUN mkdir -p /home/data && chown -R node:node /home/data
USER node

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "server.js"]
