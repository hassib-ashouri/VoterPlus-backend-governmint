FROM node:10

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --save-prod

COPY . .

EXPOSE 4000

ENV ON=0.0.0.0

CMD [ "node", "app/server.js" ]