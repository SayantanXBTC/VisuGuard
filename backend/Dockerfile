# Node >=20.11 required: screenshotter.js uses import.meta.dirname.
FROM node:22-slim

WORKDIR /app

# canvas (used by Resemble.js for diff drawing) compiles from source when no prebuilt
# binary matches the platform/Node ABI, so the build toolchain is installed up front.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Installs Chromium plus every OS library it needs (fonts, libnss, libatk, etc.),
# matching whatever "playwright" version is pinned in package.json.
RUN npx playwright install --with-deps chromium

COPY . .

# Overwritten by a mounted persistent disk in production; created here so local
# `docker run` without a volume still works.
RUN mkdir -p /app/storage

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server.js"]
