FROM node:14-alpine
RUN apk update
RUN apk add git
USER node
RUN mkdir /home/node/app
WORKDIR /home/node/app
COPY --chown=node:node ./ ./
ENV NODE_ENV=production
RUN npm install
CMD [ "node", "./src/app.js" ]
