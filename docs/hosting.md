# Hosting

Rhyzo is designed to run on [Fly.io](https://fly.io) with SQLite on persistent volumes — not managed Postgres.

## Architecture

```
Fly Machine (shared-cpu-1x, 256MB RAM)
├── Next.js app (Node.js)
├── SQLite database (WAL mode)
└── Fly Volume (persistent NVMe storage)
```

## Why Fly.io + SQLite

- **Cost**: ~$2/month (vs $15-30/month for managed Postgres)
  - `shared-cpu-1x` 256MB: $1.94/mo
  - 1GB Fly Volume: $0.15/mo
- **Simplicity**: No connection pooling, no ORM translation layer, no separate DB process
- **Performance**: SQLite on NVMe is extremely fast for read-heavy workloads
- **WAL mode**: Concurrent reads during writes (already enabled in our config)
- **Zero config**: The same `./data/rhyzo.db` path works in Docker and Fly

## Fly.io Setup

### fly.toml

```toml
app = "rhyzo"
primary_region = "sjc"  # San Francisco

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  DATABASE_URL = "file:/app/data/rhyzo.db"
  NEXT_PUBLIC_BASE_URL = "https://rhyzo.com"

[mounts]
  source = "rhyzo_data"
  destination = "/app/data"

[http_service]
  internal_port = 3000
  force_https = true

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

### Deploy

```bash
# Create the app
fly launch --name rhyzo --region sjc

# Create persistent volume (1GB is plenty to start)
fly volumes create rhyzo_data --region sjc --size 1

# Deploy
fly deploy

# Set secrets
fly secrets set SESSION_SECRET=$(openssl rand -hex 32)
```

### Backups

Fly Volumes are not replicated. Set up periodic backups:

```bash
# Manual backup
fly ssh console -C "sqlite3 /app/data/rhyzo.db '.backup /app/data/backup.db'"
fly sftp get /app/data/backup.db ./backups/rhyzo-$(date +%Y%m%d).db

# Or use Litestream for continuous replication to S3/Tigris
```

## Why Not Managed Postgres

Fly offers managed Postgres (Fly Postgres), but it's overkill for Rhyzo:

- Minimum ~$15-30/month for HA setup
- Adds operational complexity (connection strings, pooling, migrations)
- Rhyzo's data model is simple — single-writer, read-heavy lookups
- Most read-heavy queries (AT Protocol profiles, identity resolution) hit Slingshot's edge cache, not our DB

## Scaling Path

If Rhyzo outgrows a single SQLite instance:

1. **Read replicas**: Use [LiteFS](https://fly.io/docs/litefs/) for read replicas across regions
2. **Managed distributed SQLite**: Migrate to [Turso](https://turso.tech/) (libSQL)
3. **Edge reads**: Already handled by Slingshot (AT Protocol edge cache) — most lookups never touch our DB
4. **Postgres migration**: Only if write throughput exceeds SQLite's limits (~50K writes/sec on NVMe)

## Local Development

Docker Compose mirrors the Fly setup:

```yaml
volumes:
  - ./data:/app/data  # Same mount path as Fly Volume
```

The app code is identical in both environments — only the volume provider changes.
