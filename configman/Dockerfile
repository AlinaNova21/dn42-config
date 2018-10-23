FROM node:8-alpine
WORKDIR /app
RUN apk add --no-cache --repository http://dl-3.alpinelinux.org/alpine/edge/testing/ wireguard-tools
RUN apk add --no-cache git
ADD package.json .
RUN yarn install
ADD . .
CMD ["yarn", "start"]