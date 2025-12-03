# source https://medium.com/@shakyShane/lets-talk-about-docker-artifacts-27454560384f
# Stage 1 - the build process
FROM node:24.11.1 AS build-deps
WORKDIR /usr/src/app
COPY package.json yarn.lock ./
RUN yarn install
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts biome.jsonc ./
COPY public/ ./public
COPY src/ ./src
RUN yarn lint
RUN yarn typecheck
RUN yarn test:once
COPY index.html ./
RUN yarn build

# Stage 2 - the production environment
FROM nginx:1.29.3-alpine
EXPOSE 80

RUN mkdir -p /myhome/nginx
RUN rm /etc/nginx/conf.d/default.conf

COPY --from=build-deps /usr/src/app/dist /myhome/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/

CMD ["nginx", "-g", "daemon off;"]
