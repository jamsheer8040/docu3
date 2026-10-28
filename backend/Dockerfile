FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p uploads backups
EXPOSE 5000
CMD ["node", "app.js"]
