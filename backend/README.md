# Backend Service – Availability Tactics Demo

This folder contains the backend services for the availability/failover demonstration. Both the **primary** and **spare** (backup) services use the same codebase, with their role and port configured via environment variables.

## Features

- **Health check endpoint:** `GET /health`  
  Returns 200 OK if the service is running.

- **Data endpoint:** `GET /api/data`  
  Returns a JSON payload indicating if the service is primary or spare.

- **Simulated failure:** `POST /fail`  
  Simulates a real failure by stopping the process (`process.exit(1)`).

## Usage

### Run Locally

```bash
cd backend
npm install
npm run dev:primary
npm run dev:spare
```

### Endpoints

| Method | Path           | Description                                 |
|--------|----------------|---------------------------------------------|
| GET    | `/health`      | Health check (returns 200 if alive)         |
| GET    | `/api/data`    | Returns a message and timestamp             |
| POST   | `/fail`        | Simulates a failure (process exits)         |

#### Example Requests

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3001/api/data
curl -X POST http://localhost:3001/fail
```

## Configuration

- **ROLE:** Set to `primary` or `spare` to define the service role.
- **PORT:** Set the listening port (default: 3000).

These can be set via environment variables or in the Docker Compose file.

## Docker

A `Dockerfile` is provided for building a production-ready image:

## Notes

- The `/fail` endpoint is used to simulate a crash for failover testing.
- The service will automatically restart if run with Docker Compose due to the `restart` policy.
