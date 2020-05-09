# Cash Payment Service

A Bitcoin Cash BIP70 and JSON Payment Protocol microservice.

This can be configured as a microservice used to mediate BIP70 and JSON Payment Protocol requests.

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

## SSL Certificates

BIP70 depends upon SSL certs of the domain you are using.

The current library only supports DER format. Therefore, you must convert your cert and chain. Example commands given below:

```
openssl x509 -outform der -in cert.pem -out cert.der
openssl x509 -outform der -in chain.pem -out chain.der
```

## Roadmap

- Properly support JSON Payment Protocol
  JSON Payment Protocol currently works on all wallets tested - however, this is still not to spec.
  The only wallet tested that uses JSON Payment Protocol is Edge Wallet which does not yet validate
  signatures.
- Switch to FloweeJS and allow for Confirmed and Double-Spend Webhooks.
- Switch from BitBox to LibCash-JS.
