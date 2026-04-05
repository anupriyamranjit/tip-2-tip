FROM rust:1.88 AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
# Create a dummy main.rs to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true
# Now copy real source
COPY . .
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/tip2tip-backend /usr/local/bin/
COPY --from=builder /app/migrations /app/migrations
WORKDIR /app
EXPOSE 8080
CMD ["tip2tip-backend"]
