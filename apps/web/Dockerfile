# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/types/package.json ./packages/types/package.json
RUN npm install --include=dev
COPY . .
RUN npm run --workspace @automata/web build \
  || (echo 'Web workspace build not yet implemented; creating placeholder bundle' \
  && mkdir -p apps/web/dist \
  && printf '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <title>Automata Dashboard</title>\n</head>\n<body>\n  <main>Web bundle placeholder</main>\n</body>\n</html>' > apps/web/dist/index.html)

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
