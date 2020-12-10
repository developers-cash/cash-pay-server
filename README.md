# Cash Payment Service

A self-hostable Bitcoin Cash BIP70 and JSON Payment Protocol service.

A public instance is available at:
[https://v1.pay.infra.cash]

Administrative Interface for debugging is available at:
[https://admin.v1.pay.infra.cash]

Documentation:
[REST-API Documentation](https://developers-cash.github.io/cash-pay-server/tutorial-Webhooks.html)
[Webhooks Documentation](https://developers-cash.github.io/cash-pay-server/tutorial-Webhooks.html)
[Internal API](https://developers-cash.github.io/cash-pay-server/)

## Setup Example

The following is an example Docker-Compose file and assumes that Traefik is being used as a Reverse-Proxy.

Create a `docker-compose.yml` file and adjust according to your needs:

```yaml
version: "3.1"

networks:
  traefik:
    external: true
  internal:
    external: false
  external:
    external: true

services:
    
  mongo:
    image: mongo
    restart: always
    networks:
      - internal
    volumes:
      - ./.docker-storage/.mongo:/data/db
    environment:
      MONGO_INITDB_DATABASE: app
      
  pay:
    image: "node"
    user: "node"
    working_dir: /home/node/app
    restart: always
    tty: true
    stdin_open: true
    volumes:
      - ./pay.bip70.cash:/home/node/app
    command: "npm run dev"
    depends_on:
      - mongo
    labels:
        - traefik.frontend.rule=Host:pay.${DOMAIN}
        - traefik.docker.network=traefik
        - traefik.port=8080
        - traefik.frontend.passHostHeader=true
        - traefik.enable=true
    networks:
      - traefik
      - internal
      - external
    environment:
      - DOMAIN=pay.${DOMAIN}
      - NODE_ENV=production
```

Create a `.env` file in the same directory as your `docker-compose.yml`.
(Alternatively, the values can be hard-coded in your `docker-compose.yml` above.)

```
# Domain of your Cash Payment Server
DOMAIN=bip70.cash 
```

Run `docker-compose up` to start the Cash Payment Service.

# API Key Whitelisting

If the service is not intended to be open to the public, API Keys can be whitelisted by using a
comma-separated environment variable.

```sh
API_KEYS=someAPIKeyHere,someOtherAPIKeyHere
```
