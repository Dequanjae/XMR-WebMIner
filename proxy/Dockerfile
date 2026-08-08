FROM node:18-alpine

RUN apk add --no-cache git curl

WORKDIR /app

COPY config.js /app/config.js
COPY vendor/ /app/vendor/
COPY proxy/index.js /app/proxy/index.js
COPY public/ /app/public/

EXPOSE 8080 8081

CMD ["node", "proxy/index.js"]
