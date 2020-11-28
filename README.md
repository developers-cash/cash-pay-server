# Cash Payment Service

A self-hostable Bitcoin Cash BIP70 and JSON Payment Protocol service.

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

Any requests to the create invoice endpoint will be rejected if they are not in this list.

## Roadmap

### High Priority

- Create error endpoint that can retrieve based on InvoiceID
  We need this because Webhooks might fail. And if a Webhook fails, generally, it means that the
  payment has succeeded (user has paid), but the service has not marked that transaction as such.
  Perhaps a better idea is a Webhook resend queue that attempts resend at incrementing intervals?
  
### Medium Priority

- Properly support JSON Payment Protocol
  JSON Payment Protocol currently works on all wallets tested - however, this is still not to spec.
  The only wallet tested that uses JSON Payment Protocol is Edge Wallet which does not yet validate
  signatures.
  
### Low Priority

- Abstract the Engine to an interface (so we can support Flowee, etc)
