FROM node:12-alpine

RUN apk add --no-cache git python3 make g++

WORKDIR /app

RUN git clone https://github.com/jtgrassie/xmr-node-proxy.git /tmp/xmr-node-proxy && \
    cp -r /tmp/xmr-node-proxy/* /app/ && \
    rm -rf /tmp/xmr-node-proxy

RUN npm install

COPY config.json /app/config.json

EXPOSE 8081

CMD ["node", "proxy.js"]
