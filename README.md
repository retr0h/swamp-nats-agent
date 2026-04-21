[![build](https://img.shields.io/github/actions/workflow/status/retr0h/swamp-nats-agent/ci.yml?style=for-the-badge)](https://github.com/retr0h/swamp-nats-agent/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=for-the-badge)](LICENSE)
[![release](https://img.shields.io/github/release/retr0h/swamp-nats-agent.svg?style=for-the-badge)](https://github.com/retr0h/swamp-nats-agent/releases/latest)
[![paired with](https://img.shields.io/badge/paired%20with-%40retr0h%2Fnats-ff69b4?style=for-the-badge)](https://github.com/retr0h/swamp-nats)
[![deno](https://img.shields.io/badge/deno-2.x-000000?style=for-the-badge&logo=deno&logoColor=white)](https://deno.com)
[![conventional commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg?style=for-the-badge)](https://conventionalcommits.org)
![commit activity](https://img.shields.io/github/commit-activity/m/retr0h/swamp-nats-agent?style=for-the-badge)

# swamp-nats-agent

🐊 Thin NATS (JetStream) agent that runs on every target host and exposes three domain-agnostic
primitives — `exec`, `writeFile`, `readFile` — for
[@retr0h/nats](https://github.com/retr0h/swamp-nats) to drive.

No per-domain logic lives here. Adding a new `@adam/cfgmgmt` model requires zero changes to the
agent.

See [@retr0h/nats](https://github.com/retr0h/swamp-nats) for the paired transport extension, the
wire protocol, and the architecture overview.

## 📥 Install

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

## ⚙️ systemd unit (sketch)

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

## 💻 CLI

```
swamp-nats-agent [options]

  --nats-url       NATS server URL          [default: nats://localhost:4222]
  --subject-prefix Subject prefix           [default: swamp.agent]
  --hostname       Agent hostname           [default: system hostname]
  --labels         key=value CSV (reserved for future label routing)
  --output         "log" or "json"          [default: log]
```

Env equivalents: `SWAMP_AGENT_NATS_URL`, `SWAMP_AGENT_SUBJECT_PREFIX`, `SWAMP_AGENT_HOSTNAME`,
`SWAMP_AGENT_LABELS`. CLI flags win over env.

## 🏗️ Architecture (one-line)

```
operator → nc.request → subscribed agent → primitive handler → msg.respond
```

Phase 1 uses core NATS req-reply — simple, proven, immediate value. Phase 2 layers in JetStream
durable consumers for offline-host catchup and audit durability.

## 🎯 Scope

- **Wire**: core NATS `nc.subscribe` per primitive (synchronous replies to the operator's inbox);
  JetStream streams capture every request in parallel with `no_ack: true` for audit without racing
  the reply path.
- **File transfers**: JetStream Object Store (`swamp-agent-files` bucket) for every writeFile and
  readFile — no inline/Object-Store split by size, no 1 MiB message ceiling.
- **DLQ**: `SWAMP_AGENT_DLQ` stream captures envelopes for permanent failures (Zod validation fail,
  unknown primitive, max-deliver exhaustion).
- **Future**: fleet routing (`_all` / `_any` / label selectors), durable consumers for offline host
  catchup.

## 📄 License

The [MIT][MIT] License.

[MIT]: LICENSE
