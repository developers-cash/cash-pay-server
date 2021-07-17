# Cash Payment Service

A self-hostable Bitcoin Cash BIP70 and JSON Payment Protocol Gateway.

A public instance is available at:
https://v1.pay.infra.cash

Administrative Interface for debugging is available at:
https://admin.v1.pay.infra.cash

Documentation:
[REST-API Documentation](https://developers-cash.github.io/cash-pay-server/tutorial-REST-API.html) |
[Webhooks Documentation](https://developers-cash.github.io/cash-pay-server/tutorial-Webhooks.html) |
[Internal API](https://developers-cash.github.io/cash-pay-server/) (UNSTABLE)

## Quickstart

The following is an example Docker-Compose file and assumes that Traefik is being used as a Reverse-Proxy.

Otherwise if you are using a different reverse proxy (e.g. Nginx or Apache), remove the labels section and setup your Reverse Proxy to target port 8080.

Create a `docker-compose.yml` file and adjust according to your needs:

```yaml
version: "3.3"

networks:
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
    image: "developerscash/cash-pay-server:v1-latest"
    restart: always
    environment:
      - DOMAIN=v1.pay.infra.cash # (Required)
      - WIF=L3pajCnJrxicPsPQmV7KLkyeQ9q5vr1tygSK4LshQgUWALjJJ5T4 # (Required)
      - MONGODB=mongodb://mongo:27017/app # (Required)
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
      - internal
```

Run `docker-compose up` to start Cash Pay Server.

## Environment Variables

```sh
# (REQUIRED) The public facing domain of your service
DOMAIN=pay.your-service.com

# (REQUIRED) Private Key in WIF format (to sign webhooks)
WIF=L3pajCnJrxicPsPQmV7KLkyeQ9q5vr1tygSK4LshQgUWALjJJ5T4

# (REQUIRED) MongoDB connection URL
MONGODB=mongodb://mongo:27017/app

# Port to run CashPayServer on
PORT=8080 # (default: 8080)

# Currency Exchange Rates refresh interval (in seconds)
RATES_REFRESH=300 # (default: 300)

# Base Currency that Cash Pay Server should store conversions in
BASE_CURRENCY=USD # (default: USD)

# A comma-separated list of whitelisted API Keys if this Cash Pay Server is private
API_KEYS=RandomAPIKey123,RandomAPIKey456 # (default: null)

```
