FROM node:22-slim

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application files, prompts, and rubrics
COPY server.ts tsconfig.json ./
COPY app ./app
COPY prompts ./prompts
COPY rubrics ./rubrics

# Build TypeScript server
RUN npm install -D typescript @types/node @types/express @types/cors tsx && \
    npm run build && \
    npm prune --omit=dev

# Run as non-root user for security
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
