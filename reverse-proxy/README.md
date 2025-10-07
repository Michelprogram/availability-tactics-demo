# Reverse Proxy Demo

This project is a simple reverse proxy written in Go, supporting health checks and automatic failover between multiple backend targets. It is container-ready and can be run locally or with Docker.

## Features

- Forwards HTTP requests to healthy backend services
- Health checks and automatic failover
- Configurable via YAML
- Docker support

## Getting Started

### 1. Build and Run Locally

#### Prerequisites

- Go 1.22+
- (Optional) Docker

#### Build

```sh
go build -o reverse-proxy ./cmd/main.go
```

#### Prepare Backends

Start one or more backend servers (see `backend` for a sample)

#### Run the Proxy

```sh
./reverse-proxy -port 8021
```

### 2. Using Docker

#### Build the Image

```sh
docker build -t reverse-proxy .
```

#### Run the Proxy Container

```sh
docker run -p 8021:8021 -v $(pwd)/config.yaml:/app/config.yaml reverse-proxy
```

> **Note:** Make sure your backend services are accessible from the container (e.g., run them with `--network host` or in the same Docker network).

### 3. Configuration

Edit `config.yaml` to set your backend targets, health check interval, and routes:

```yaml
targets: [http://localhost:8022, http://localhost:8023]
interval: 2

routes:
  - path: /health/
    methods: [GET]
  - path: /data/
    methods: [GET]
  - path: /fail/
    methods: [POST]
  - path: /recover/
    methods: [POST]
```

### 4. Test the Proxy

Send requests to the proxy:

```sh
curl http://localhost:8021/health/
curl http://localhost:8021/data/
```

The proxy will forward requests to a healthy backend and automatically fail over if one goes down.

## 5. WebSocket Support

The reverse proxy also supports WebSocket connections. Any incoming WebSocket request will be proxied to the active backend target transparently.

### Example

```javascript

const socket = new WebSocket('ws://localhost:8021/log');

socket.addEventListener("message", function (event) {
  console.log("Message reçu du serveur ", event.data);
});
```