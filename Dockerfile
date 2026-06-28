FROM node:22-alpine AS builder

WORKDIR /app

# Install root dependencies
COPY package*.json ./
RUN npm ci

# Install frontend dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Copy source
COPY . .

# Build TypeScript backend and frontend
RUN npm run build && npm run build:frontend

# Prune dev dependencies
RUN npm ci --omit=dev


FROM node:22-alpine AS runtime

WORKDIR /app

# Copy compiled output and runtime dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/overlay ./dist/overlay
COPY --from=builder /app/dashboard.html ./dist/dashboard.html

# Assets are mounted at runtime via volume
VOLUME ["/app/assets"]

CMD ["node", "dist/backend/index.js"]
