# Local dev harness

Starts NATS (with JetStream) in docker and leaves you ready to run the agent locally via
`deno task dev`. Once both are up, install the [@retr0h/nats](../../swamp-nats) extension into a
scratch swamp repo and exercise the transport via `swamp model method run`.

## Prereqs

- Docker running
- `mise install` (picks up the pinned deno)

## Start NATS

```bash
cd ~/git/swamp.club/swamp-nats-agent/testing
docker compose up -d

# sanity check
docker compose logs nats | grep -i "server is ready"
nc -zv localhost 4222
```

Monitoring UI: http://localhost:8222

## Start the agent (separate terminal)

```bash
cd ~/git/swamp.club/swamp-nats-agent
deno task dev --hostname=localmac --nats-url=nats://localhost:4222
```

Expected startup log (order matters — the agent creates topology on first connect, so fresh runs
create, subsequent runs report "exists"):

```
INF connecting to NATS
INF stream created       stream=SWAMP_AGENT
INF stream created       stream=SWAMP_AGENT_DLQ
INF object bucket created  bucket=swamp-agent-files
INF consumer created     name=agent-localmac  filter=swamp.agent.localmac.>
INF ready
```

Flags you might tweak:

| Flag               | Default                 | Notes                               |
| ------------------ | ----------------------- | ----------------------------------- |
| `--hostname`       | system hostname         | Maps to the NATS subject suffix     |
| `--nats-url`       | `nats://localhost:4222` | Can be a comma-separated list       |
| `--subject-prefix` | `swamp.agent`           | Override for multi-tenant isolation |
| `--output`         | `log`                   | Set to `json` for JSON line logs    |

## Kick the tires

From a third terminal, use the included smoke script:

```bash
cd ~/git/swamp.club/swamp-nats-agent/testing
./smoke.sh localmac
```

This uses `nats` CLI (if installed) to publish raw requests. If you don't have it:
`brew install nats-io/nats-tools/nats`.

Or skip the smoke script and go straight to exercising via swamp CLI — see the walkthrough in the
[top-level README](../README.md#run-via-swamp).

## Tear down

```bash
cd ~/git/swamp.club/swamp-nats-agent/testing
docker compose down -v     # -v wipes JetStream volume too
```

## Troubleshooting

| Symptom                                    | Cause                             | Fix                                                                |
| ------------------------------------------ | --------------------------------- | ------------------------------------------------------------------ |
| Agent logs `NatsError: no responders`      | NATS not running                  | `docker compose ps`                                                |
| Agent logs `stream error: ...not a stream` | Stale volume from a schema change | `docker compose down -v` and restart                               |
| Swamp says `model type not found`          | Source dir not linked             | `swamp extension source add ~/git/swamp.club/swamp-nats`           |
| Writes hang forever                        | Object bucket missing             | Agent logs should show auto-create; else inspect via `nats obj ls` |
