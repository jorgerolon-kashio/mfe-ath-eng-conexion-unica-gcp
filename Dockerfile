FROM node:18-alpine AS build-step
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

RUN npm run build

# Stage 2: Servidor Nginx
FROM nginx:alpine

COPY --from=build-step /app/dist /usr/share/nginx/html

RUN printf "server { \n\
    listen 8080; \n\
    location / { \n\
    root /usr/share/nginx/html; \n\
    index index.html index.htm; \n\
    try_files \$uri \$uri/ /index.html; \n\
    } \n\
    }" > /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]