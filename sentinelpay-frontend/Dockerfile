# Step 1: Build React app
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# REACT_APP_* vars are baked into the JS bundle at build time by CRA.
# .env.production (checked into the repo) contains a real production URL and
# takes priority over .env for `npm run build` builds. Explicitly set the var
# here so it wins over any .env file — the browser will call localhost:3001
# (Nginx), which proxies internally to fraud-api-gateway:8085.
ARG  REACT_APP_API_BASE_URL=http://localhost:3001
ENV  REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL

RUN npm run build

# Step 2: Serve with nginx
FROM nginx:alpine

# Replace the default nginx config with one that:
#  1. Serves the React SPA with try_files fallback (client-side routing)
#  2. Proxies /api/* to fraud-api-gateway:8085 over the internal Docker network
#     so the browser never needs to resolve a Docker-internal hostname.
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]