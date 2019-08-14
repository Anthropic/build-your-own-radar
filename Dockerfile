FROM node:10.15.3 as source
WORKDIR /src/build-your-own-radar
COPY package.json ./
RUN npm install
COPY . ./
ARG CLIENT_ID
ARG API_KEY
ARG USE_AUTHENTICATION
ARG ENV_FILE
RUN npm run build -- --env-file $ENV_FILE

FROM nginx:1.15.9
WORKDIR /opt/build-your-own-radar
COPY --from=source /src/build-your-own-radar/dist .
COPY default.template /etc/nginx/conf.d/default.conf
CMD ["nginx", "-g", "daemon off;"]
