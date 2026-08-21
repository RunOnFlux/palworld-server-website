# Stage 1: Build the Vite frontend
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
ENV VITE_APP_URL=https://palworld.runonflux.com
ENV VITE_ENABLE_ANALYTICS=true
ENV VITE_GA_MEASUREMENT_ID=G-MFX916BY5S

# Search-engine ownership verification. Read by scripts/prerender.mjs, which stamps the meta
# tags into every route shell. Empty by default: leave them unset if the property is verified
# by DNS instead. These are public tokens, not secrets.
ARG GOOGLE_SITE_VERIFICATION=
ARG BING_SITE_VERIFICATION=
ENV GOOGLE_SITE_VERIFICATION=$GOOGLE_SITE_VERIFICATION
ENV BING_SITE_VERIFICATION=$BING_SITE_VERIFICATION

RUN npm run build

# Stage 2: Production image
FROM node:22-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy the Express server
COPY server.js ./

# Copy the built frontend
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server.js"]
