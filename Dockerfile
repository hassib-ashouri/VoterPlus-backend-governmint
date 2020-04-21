FROM node:10

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --save-prod

COPY . .

EXPOSE 4000
ENV DB_URL=mongodb+srv://Voterplus:Voterplus@cluster0-4bltz.mongodb.net/test?ENV retryWrites=true&w=majority
ENV MYSQL_URL=voterplus-staging.couzwmcdmdzc.us-east-2.rds.amazonaws.com
ENV MYSQL_DB=governmint
ENV MYSQL_USER=voterplus
ENV MYSQL_PASS=voterplus
ENV NODE_ENV=production
ENV ON=0.0.0.0