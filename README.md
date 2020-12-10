
# Cash Pay Server

A self-hostable Bitcoin Cash BIP70 and JSON Payment Protocol Gateway.

A public instance is available at:
https://v1.pay.infra.cash

Administrative Interface for debugging is available at:
https://admin.v1.pay.infra.cash

Documentation:
[REST-API Documentation](https://developers-cash.github.io/cash-pay-server/tutorial-REST-API.html) | 
[Webhooks Documentation](https://developers-cash.github.io/cash-pay-server/tutorial-Webhooks.html) | 
[Internal API](https://developers-cash.github.io/cash-pay-server/) (UNSTABLE)

## Setup

### Production

When we reach V1, I'll make a Docker Machine. In the meantime, if you really want to run your own instance the below
is an example of how a `docker-compose.yml` file may look (using Traefik V2 as Reverse-proxy).

My recommendation is you wait until V1.

```yaml
version: "3.3"

networks:
  _traefik_default:
    external: true
  internal:
    external: false

services:

  mongo:
    image: mongo
    restart: always
    networks:
      - internal
    volumes:
      - ./mongo:/data/db
    environment:
      MONGO_INITDB_DATABASE: app
      
  cash-pay-server:
    image: "node:alpine"
    user: "node"
    working_dir: /home/node/app
    tty: true
    stdin_open: true
    restart: always
    volumes:
      - ./cash-pay-server:/home/node/app # Make sure you do a git clone https://github.com/developers-cash/cash-pay-server
    environment:
      - NODE_ENV=production
      - DOMAIN=v1.pay.infra.cash
      - WIF=GO_GENERATE_ME_SOMEWHERE
      - MONGODB=mongodb://mongo:27017/app
      # API_KEYS=someWhitelistedAPIKey,anotherWhitelistedAPIKey
    command: "sh -c 'npm install && npm run dev'"
    depends_on:
      - mongo
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.cash-pay-server.service=cash-pay-server"
      - "traefik.http.routers.cash-pay-server.rule=Host(`v1.pay.infra.cash`)"
      - "traefik.http.routers.cash-pay-server.entrypoints=websecure"
      - "traefik.http.routers.cash-pay-server.tls.certresolver=le"
      - "traefik.http.services.cash-pay-server.loadbalancer.server.port=8080"
    networks:
      - _traefik_default
      - internal
```

### Development

```sh
git clone https://github.com/developers-cash/cash-pay-server
cd cash-pay-server
npm install
export NODE_ENV=production
export DOMAIN=pay.public-url.com
export WIF=XXXX # Generate a WIF somewhere for signing Webhook and WebSocket payloads
export MONGODB=mongodb://mongo:27017/app
nodemon src/app.js # Development
# node src/app/js
```

# API Key Whitelisting

If you want to restrict the create endpoint to only certain API Keys, you can do so by passing the following
environment variable.

```sh
API_KEYS=someAPIKeyHere,someOtherAPIKeyHere
```
