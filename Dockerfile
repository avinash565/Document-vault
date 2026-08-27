# syntax=docker/dockerfile:1
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies first so this layer is cached when only source changes
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# Copy the rest of the source
COPY . .

# Generate the Prisma client against the schema baked into the image.
# Migrations are NOT run here — they're applied separately (via `bun run
# gendb` / `prisma migrate deploy`) against whatever database URL is passed
# at runtime, so the image doesn't need database access at build time.
RUN bunx prisma generate

ENV PORT=4000
EXPOSE 4000

CMD ["bun", "run", "src/index.ts"]
