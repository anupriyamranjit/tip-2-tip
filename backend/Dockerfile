# ---- Stage 1: Build ----
FROM rust:1.82-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Cache dependencies
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo "fn main(){}" > src/main.rs && cargo build --release 2>/dev/null || true
RUN rm -rf src

# Build the real app
COPY . .
RUN touch src/main.rs && cargo build --release

# ---- Stage 2: Runtime ----
FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/tip2tip-backend /usr/local/bin/
COPY --from=builder /app/migrations ./migrations

RUN mkdir -p /data/uploads

EXPOSE 8080

CMD ["tip2tip-backend"]
