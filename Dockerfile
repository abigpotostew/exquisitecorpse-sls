# Frontend build stage
FROM node:25-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install npm dependencies
RUN npm ci

# Copy source files needed for webpack build
COPY src ./src
COPY tsconfig.json ./
COPY webpack.common.js webpack.prod.js ./
#COPY dist ./dist

# Build frontend assets
RUN npm run build

# Go build stage
FROM golang:1.25.4-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Copy built frontend assets from frontend-builder
COPY --from=frontend-builder /app/dist ./dist

# Build the application
# CGO_ENABLED=0 for static binary
# -ldflags="-s -w" to reduce binary size
# -trimpath to remove file system paths from binary for better reproducibility
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w" \
    -trimpath \
    -o /build/bin/api \
    ./cmd/api/main.go

# Runtime stage
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata curl

# Create a non-root user
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser

# Set working directory
WORKDIR /app

# Copy the binary from builder
COPY --from=builder --chown=appuser:appuser /build/bin/api /app/api

# Copy timezone data for consistent time operations
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Copy CA certificates
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Switch to non-root user
USER appuser

# Expose port (default 8080)
EXPOSE 8080

# Health check
# Adjust the endpoint if your app has a dedicated health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/ || exit 1

# Run the binary
ENTRYPOINT ["/app/api"]

