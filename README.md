# ✅ To-Do – Availability PoC

## Backend (Primary + Backup Services)
- [ ] Setup repository (`mgl7361-availability-poc`)
- [ ] Initialize backend (Node.js/Express, Python/Flask, or Java/SpringBoot)
- [ ] Implement service endpoints:
  - [ ] `GET /health` → check if service is alive
  - [ ] `GET /data` → return sample payload
  - [ ] `POST /fail` → simulate failure (set status = down)
  - [ ] `POST /recover` → recover service (set status = up)
- [ ] Dockerfile

## Reverse Proxy (Failover Manager)
- [x] Initialize reverse-proxy (Node.js/Express, Python/Flask, or Java/SpringBoot)
- [x] Implement proxy endpoints:
  - [x] `GET /proxy/health` → check active service
  - [x] `GET /proxy/data` → forward request to active service
  - [x] `POST /proxy/fail` → forward fail trigger to primary
  - [x] `POST /proxy/recover` → forward recover trigger to primary
- [x] Background job:
    - [x] Monitor `/health` of primary → auto-switch to backup if down (`setInterval`)
  - [ ] Log downtime + recovery events
  - [ ] Optionally collect metrics (failover time + error rate)
- [x] Dockerfile

## Front-End (Monitoring UI)
- [ ] Initialize front-end (any stack: React, Vue, or simple HTML/JS)
- [ ] Features:
  - [ ] Logs section (show requests + failures)
  - [ ] Schema of the architecture (visual diagram)
  - [ ] Animation when connection switches from primary → backup
  - [ ] Display metrics (failover time + error rate) (optional)
- [ ] Dockerfile

## Deployment
- [ ] Docker Compose:
  - [ ] 2 backends (primary + backup)
  - [ ] 1 reverse proxy
  - [ ] 1 frontend

## Deliverables
- [ ] Architecture document (2–3 pages)
- [ ] Demo video (3–5 minutes):
  - [ ] Normal operation
  - [ ] Trigger failure
  - [ ] Show detection + failover
  - [ ] Recovery
  - [ ] Metrics (if bonus)

## Bonus
- [ ] Collect metrics:
  - [ ] Failover time (`T_bascule`)
  - [ ] Error rate during failover (`E_bascule`)
