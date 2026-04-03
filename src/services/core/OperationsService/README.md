# OperationsService

Manages idempotency and transactional consistency for the platform.

## Features

- **`stepper(idx, cmd, id, steps)`** — Multi-step transactional pipeline with resume support. Tracks completed steps in MongoDB (TTL 48h). Supports saga steps with compensating revert methods.
- **`httpCheck(cmd, id, method)`** — Idempotency guard for HTTP operations. Prevents duplicate execution within a 2-minute window using Redis. Used automatically by EndpointManagerService for POST/PUT/PATCH/DELETE endpoints.

## Dependencies

- `queue/redis` — Idempotency keys (2min TTL)
- `object/mongo` — Stepper state persistence (48h TTL index)
