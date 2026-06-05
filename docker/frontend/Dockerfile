FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/mobile /usr/share/nginx/html/mobile
COPY --from=build /app/dist/admin  /usr/share/nginx/html/admin
COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
