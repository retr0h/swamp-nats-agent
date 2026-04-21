# Project: swamp-nats-agent

Deno-based thin agent for [swamp-nats-transport](../swamp-nats-transport). Runs on every target host
as a NATS (JetStream) subscriber and exposes three domain-agnostic primitives (`exec`, `writeFile`,
`readFile`) that swamp-nats-transport drives.

Architecture and wire protocol live in
[`../swamp-nats-transport/DESIGN.md`](../swamp-nats-transport/DESIGN.md). This CLAUDE.md only covers
conventions for working in this repo.

## Code Style

- TypeScript strict mode, no `any` types
- Use named exports, not default exports
- Comprehensive unit test coverage
- All code must pass type checking with `deno check`
- All code must pass `deno lint`
- Format all code with `deno fmt`
- All `.ts` files must include the AGPLv3 copyright header from `FILE-LICENSE-TEMPLATE.md` at the
  top of the file (as `//` comments). Run `deno task license-headers` to add headers to any new
  files.
- No fire-and-forget promises. Every promise must be awaited or explicitly handled — unhandled
  promises race with `Deno.exit` and silently lose data. For outbound network calls, pass an
  `AbortSignal` with a timeout so the caller controls cancellation.

Changes should only touch what's necessary — don't refactor adjacent code that isn't part of the
task. Keep the blast radius small.

## Commands

Use `deno task` to see the full list. Common ones:

- `deno task dev` — run the agent against `nats://localhost:4222`
- `deno task test` — run the test suite
- `deno task check` — type-check
- `deno task lint` — lint
- `deno task fmt` — format
- `deno task fmt:check` — check formatting (must pass before committing)
- `deno task compile` — cross-compile binaries into `./bin/` for linux/darwin × x86_64/aarch64
- `deno task license-headers` — add AGPL headers to any new `.ts` files

## Architecture

- **`main.ts`** — Cliffy-based CLI entrypoint. Parses flags, wires logging, hands off to
  `startAgent()`.
- **`src/agent.ts`** — connects to NATS, subscribes to the three per-host primitive subjects, and
  dispatches incoming messages into the primitive handlers. Phase 1 uses core NATS req-reply; Phase
  2 will layer in JetStream durable consumers + reply-via-inbox.
- **`src/protocol.ts`** — Zod schemas for every wire message. **This is the source of truth** for
  the wire format; swamp-nats-transport imports from here so both sides stay in lockstep.
- **`src/primitives/`** — one file per primitive (`exec.ts`, `write_file.ts`, `read_file.ts`). Each
  exports a single `run*` function that takes the parsed request and returns the response. No NATS
  knowledge in these files — they're pure command/file-system handlers and are trivially unit-
  testable.
- **`src/subjects.ts`** — subject-builder helpers shared with the transport (via relative import) so
  both sides agree on the subject scheme.
- **`src/config.ts`** — CLI-flag + env + default resolution, Zod-validated.
- **`src/logging.ts`** — LogTape configuration (LogTape for logs, Cliffy for CLI output — matches
  the upstream swamp project).

### Phase boundaries

- **Phase 1 (current)**: single-target transport via core NATS req-reply, one subscription per
  hostname (`swamp.agent.{hostname}.{primitive}`), three primitives, inline content only.
- **Phase 2**: JetStream durable consumers for offline-host catchup + audit durability, `_all` /
  `_any` / label consumers, Object Store variant of file primitives for content larger than ~1 MiB.

IMPORTANT: Do not widen the primitive surface beyond `exec`, `writeFile`, `readFile`. Every cfgmgmt
operation reduces to these three. Adding more couples the agent to per-domain behavior and defeats
the "dumb agent" design.

## Testing

- Unit tests live next to source files: `foo.ts` → `foo_test.ts`
- Use `@std/assert` for assertions (`assertEquals`, `assertStringIncludes`, `assertThrows`, etc.)
- Test private functions indirectly through public APIs
- Name tests as `Deno.test("functionName: describes behavior", ...)` — see
  `src/primitives/exec_test.ts` for the canonical shape
- Run all tests with `deno task test`
- Run a single test file: `deno task test src/primitives/exec_test.ts` (no `--` prefix)

## Source Control & Pull Requests

- Conventional commits with the 50/72 rule (matches the swamp and osapi project conventions).
- Every commit by Claude Code ends with:
  ```
  🤖 Generated with [Claude Code](https://claude.ai/code)

  Co-Authored-By: Claude <noreply@anthropic.com>
  ```

## Verification

After completing work, run:

1. `deno task check` — type checking
2. `deno task lint` — linting
3. `deno task fmt:check` — formatting
4. `deno task test` — tests
5. `deno task compile` — cross-compile release binaries (only when cutting a release)

## Session Learnings

If you hit a non-obvious problem during a session — something that wasted time, caused a wrong
approach, or revealed a convention not documented here — propose an update to `CLAUDE.md` before
finishing. Only capture things that would trip up future sessions, not one-off issues. Frame
learnings as positive conventions (what to do) rather than reactive rules.
