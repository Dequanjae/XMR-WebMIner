FROM node:18-alpine
RUN mkdir -p /app
WORKDIR /app
RUN npm init -y && npm install ws
COPY proxy.js /app/proxy.js
EXPOSE 8081 8082
CMD ["node", "proxy.js"]