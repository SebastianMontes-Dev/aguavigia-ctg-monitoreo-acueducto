# Imagen del frontend: compila la SPA (React + Vite) y la sirve con nginx. Se construye desde frontend/ (ver docker-compose.yml).
# nginx hace lo que en desarrollo hace el proxy de Vite: la SPA y la API comparten origen (/api) y /acuacar-media trae portadas.
FROM node:22-alpine AS compilar

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=compilar /app/dist /usr/share/nginx/html

EXPOSE 80
