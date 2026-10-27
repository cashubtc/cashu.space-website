# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.22.1

FROM node:${NODE_VERSION}-slim AS build

WORKDIR /app

ARG NEXT_PUBLIC_SITE_URL=https://cashu.space
ARG VERCEL_ENV=production
ENV NODE_ENV=production \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    VERCEL_ENV=${VERCEL_ENV}

COPY .npmrc package-lock.json package.json ./
RUN --mount=type=secret,id=MOTION_TOKEN,required=true \
    MOTION_TOKEN="$(cat /run/secrets/MOTION_TOKEN)" npm ci --include=dev

COPY . .
RUN npm run build


FROM node:${NODE_VERSION}-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node

EXPOSE 3000

CMD ["node", "server.js"]
