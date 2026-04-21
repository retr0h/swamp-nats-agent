# swamp-nats-agent

Thin NATS (JetStream) agent that runs on every target host and exposes three domain-agnostic
primitives — `exec`, `writeFile`, `readFile` — for [swamp-nats-transport](../swamp-nats-transport)
to drive.

No per-domain logic lives here. Adding a new `@adam/cfgmgmt` model requires zero changes to the
agent.

See [`../swamp-nats-transport/DESIGN.md`](../swamp-nats-transport/DESIGN.md) for the architecture,
wire protocol, and upstream plan.

## Install

Pick the deployment path that matches your fleet.

### Compiled binary (recommended for production)

```bash
deno task compile
scp bin/swamp-nats-agent-linux-x86_64 web01:/usr/local/bin/swamp-nats-agent
```

The compiled binary bundles the Deno runtime (~90 MB) — no `deno` install required on the target
host.

### Deno runtime

```bash
mise use deno@2    # or brew install deno
deno task dev --hostname=web01 --nats-url=nats://nats.internal:4222
```

## systemd unit (sketch)

```ini
[Unit]
Description=Swamp NATS Agent
After=network.target

[Service]
ExecStart=/usr/local/bin/swamp-nats-agent \
  --nats-url=nats://nats.internal:4222 \
  --hostname=%H
User=swamp-agent
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## CLI

```
swamp-nats-agent [options]

  --nats-url       NATS server URL          [default: nats://localhost:4222]
  --subject-prefix Subject prefix           [default: swamp.agent]
  --hostname       Agent hostname           [default: system hostname]
  --labels         key=value CSV for Phase 2 label routing
  --output         "log" or "json"          [default: log]
```

Env equivalents: `SWAMP_AGENT_NATS_URL`, `SWAMP_AGENT_SUBJECT_PREFIX`, `SWAMP_AGENT_HOSTNAME`,
`SWAMP_AGENT_LABELS`. CLI flags win over env.

## Architecture (one-line)

```
operator → nc.request → subscribed agent → primitive handler → msg.respond
```

Phase 1 uses core NATS req-reply — simple, proven, immediate value. Phase 2 layers in JetStream
durable consumers for offline-host catchup and audit durability.

## Scope

- **Phase 1 (current)**: direct-target core NATS subscription
  (`swamp.agent.{hostname}.{primitive}`), three primitives, inline content up to NATS's message
  limit (~1 MiB).
- **Phase 2**: JetStream durable consumers, `_all` / `_any` / label routing, Object Store variant of
  file primitives for large binary content.

## License

AGPL-3.0-only. See [`LICENSE`](./LICENSE) and [`COPYING`](./COPYING).
