FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o reverse-proxy ./cmd/main.go

FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/reverse-proxy .
COPY config.yaml .

EXPOSE 8021

CMD ["./reverse-proxy", "-port", "8021"]