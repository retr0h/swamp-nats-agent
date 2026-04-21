import {
  connect,
  type ConnectionOptions,
  credsAuthenticator,
  type Msg,
  type NatsConnection,
  nkeyAuthenticator,
  type Subscription,
} from "@nats-io/transport-deno";
import { jetstreamManager } from "@nats-io/jetstream";
import { ZodError } from "zod";
import type { Config } from "./config.ts";
import { publishDlq } from "./dlq.ts";
import { ensureObjectBucket, ensureStreams } from "./jetstream.ts";
import { log } from "./logging.ts";
import {
  ExecRequestSchema,
  type Primitive,
  ReadFileRequestSchema,
  WriteFileRequestSchema,
} from "./protocol.ts";
import { runExec } from "./primitives/exec.ts";
import { runReadFile } from "./primitives/read_file.ts";
import { runWriteFile } from "./primitives/write_file.ts";

/**
 * startAgent connects to NATS, ensures the streams + object bucket exist,
 * and subscribes (core NATS) to this host's primitive subjects. Replies
 * travel over the standard core-NATS inbox pattern; the request stream
 * captures every inbound message in parallel for audit/durability.
 *
 * Error handling:
 *   - Schema validation failure (ZodError) → reply with error, publish DLQ
 *   - Malformed JSON                         → reply with error, publish DLQ
 *   - Handler threw                           → reply with error, log it
 */
export async function startAgent(cfg: Config): Promise<() => Promise<void>> {
  const l = log("agent");
  l.info("connecting to NATS", {
    url: cfg.natsUrl,
    hostname: cfg.hostname,
    prefix: cfg.natsSubjectPrefix,
  });

  const nc: NatsConnection = await connect({
    servers: cfg.natsUrl,
    name: `swamp-nats-agent:${cfg.hostname}`,
    reconnect: true,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 2_000,
    ...(await authOptions(cfg)),
  });

  // JetStream topology for audit/durability — stream captures every
  // request published to our subjects; Object Store carries file content.
  const jsm = await jetstreamManager(nc);
  await ensureStreams(jsm, cfg);
  await ensureObjectBucket(nc, cfg);

  // Core NATS subscriptions — one per primitive. Replying here hits the
  // operator's inbox synchronously via nc.request(). JetStream capture
  // happens in parallel on the same subject, transparent to req-reply.
  const primitives: Primitive[] = ["exec", "writeFile", "readFile"];
  const subs: Subscription[] = [];
  for (const primitive of primitives) {
    const subject = `${cfg.natsSubjectPrefix}.${cfg.hostname}.${primitive}`;
    const sub = nc.subscribe(subject, {
      callback: (err, msg) => {
        if (err) {
          l.error("subscription error", { subject, error: err.message });
          return;
        }
        void handleMessage(nc, cfg, primitive, msg);
      },
    });
    subs.push(sub);
    l.info("subscribed", { subject });
  }
  l.info("ready", { hostname: cfg.hostname });

  return async () => {
    l.info("draining");
    for (const s of subs) s.unsubscribe();
    await nc.drain();
  };
}

async function handleMessage(
  nc: NatsConnection,
  cfg: Config,
  primitive: Primitive,
  msg: Msg,
): Promise<void> {
  const l = log("agent");
  const bytes = msg.data.length;

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(msg.data));
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    l.warn("malformed JSON", { subject: msg.subject, bytes, error });
    publishDlq(nc, cfg.hostname, {
      originalSubject: msg.subject,
      primitive,
      reason: "schema_validation",
      error: `malformed JSON: ${error}`,
      originalPayload: msg.data,
    });
    msg.respond(encode({ error: `malformed JSON: ${error}` }));
    return;
  }

  l.info(`${primitive} received`, { subject: msg.subject, bytes });

  let response: unknown;
  try {
    response = await dispatch(nc, cfg, primitive, payload);
  } catch (err) {
    if (err instanceof ZodError) {
      const error = err.message;
      l.warn("schema validation failed", { subject: msg.subject, error });
      publishDlq(nc, cfg.hostname, {
        originalSubject: msg.subject,
        primitive,
        reason: "schema_validation",
        error,
        originalPayload: msg.data,
      });
      msg.respond(encode({ error }));
      return;
    }
    const error = err instanceof Error ? err.message : String(err);
    l.error("handler threw", { subject: msg.subject, primitive, error });
    msg.respond(encode({ error }));
    return;
  }

  const replyBytes = encode(response);
  msg.respond(replyBytes);
  l.info(`${primitive} replied`, {
    subject: msg.subject,
    bytes_in: bytes,
    bytes_out: replyBytes.length,
    summary: summarize(primitive, response),
  });
}

/** summarize extracts a useful log hint from each primitive's response. */
function summarize(primitive: Primitive, response: unknown): string {
  if (typeof response !== "object" || response === null) return "";
  const r = response as Record<string, unknown>;
  switch (primitive) {
    case "exec":
      return `exitCode=${r.exitCode} stdout=${(r.stdout as string | undefined)?.length ?? 0}B`;
    case "writeFile":
      return `ok=${r.ok} bytes=${r.bytesWritten ?? 0}`;
    case "readFile":
      return r.sourceObject ? `object=${(r.sourceObject as { name?: string }).name}` : "error";
  }
}

function encode(v: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(v));
}

async function dispatch(
  nc: NatsConnection,
  cfg: Config,
  primitive: Primitive,
  payload: unknown,
): Promise<unknown> {
  switch (primitive) {
    case "exec":
      return await runExec(ExecRequestSchema.parse(payload));
    case "writeFile":
      return await runWriteFile(nc, WriteFileRequestSchema.parse(payload));
    case "readFile":
      return await runReadFile(
        nc,
        cfg.objectBucket,
        cfg.hostname,
        ReadFileRequestSchema.parse(payload),
      );
  }
}

/** Build NATS connection auth options from Config. Applies whichever
 *  credentials are set; omit all for anonymous (local dev only). */
async function authOptions(cfg: Config): Promise<Partial<ConnectionOptions>> {
  const out: Partial<ConnectionOptions> = {};

  if (cfg.natsCredsPath) {
    const creds = await Deno.readFile(cfg.natsCredsPath);
    out.authenticator = credsAuthenticator(creds);
  } else if (cfg.natsNKeySeed) {
    out.authenticator = nkeyAuthenticator(new TextEncoder().encode(cfg.natsNKeySeed));
  } else if (cfg.natsToken !== undefined) {
    out.token = cfg.natsToken;
  } else if (cfg.natsUser !== undefined) {
    out.user = cfg.natsUser;
    if (cfg.natsPass !== undefined) out.pass = cfg.natsPass;
  }

  if (cfg.natsTlsCaFile || cfg.natsTlsCertFile || cfg.natsTlsKeyFile) {
    out.tls = {
      caFile: cfg.natsTlsCaFile,
      certFile: cfg.natsTlsCertFile,
      keyFile: cfg.natsTlsKeyFile,
    };
  }

  return out;
}
