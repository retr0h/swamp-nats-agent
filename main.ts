import { Command } from "@cliffy/command";
import { startAgent } from "./src/agent.ts";
import { buildConfig } from "./src/config.ts";
import { initLogging, log } from "./src/logging.ts";

await new Command()
  .name("swamp-nats-agent")
  .description("NATS (JetStream) agent for swamp-nats-transport")
  .version("0.1.0")
  // ── NATS connection ────────────────────────────────────────────────
  .option("--nats-url <url:string>", "NATS server URL (comma-separated list)")
  .option("--nats-subject-prefix <prefix:string>", "NATS subject prefix")
  // ── Auth ───────────────────────────────────────────────────────────
  .option("--nats-user <user:string>", "NATS user (user/pass auth)")
  .option("--nats-pass <pass:string>", "NATS password (sensitive)")
  .option("--nats-token <token:string>", "NATS token (sensitive)")
  .option("--nats-creds-path <path:string>", "Path to NATS creds file (JWT + nkey)")
  .option("--nats-nkey-seed <seed:string>", "NATS nkey seed (sensitive)")
  .option("--nats-tls-ca-file <path:string>", "mTLS CA certificate file")
  .option("--nats-tls-cert-file <path:string>", "mTLS client certificate file")
  .option("--nats-tls-key-file <path:string>", "mTLS client key file")
  // ── Agent identity ─────────────────────────────────────────────────
  .option("--hostname <name:string>", "Agent hostname")
  .option("--labels <csv:string>", "Comma-separated key=value labels")
  // ── JetStream topology (multi-tenant overrides) ────────────────────
  .option("--request-stream <name:string>", "Request stream name")
  .option("--dlq-stream <name:string>", "DLQ stream name")
  .option("--object-bucket <name:string>", "Object Store bucket name")
  // ── Retention tuning ───────────────────────────────────────────────
  .option(
    "--request-stream-max-age-sec <sec:number>",
    "Request stream max message age (seconds)",
  )
  .option(
    "--dlq-stream-max-age-sec <sec:number>",
    "DLQ stream max message age (seconds)",
  )
  .option(
    "--object-bucket-max-age-sec <sec:number>",
    "Object Store bucket max object age (seconds)",
  )
  // ── Consumer tuning ────────────────────────────────────────────────
  .option("--max-deliver <n:number>", "Max delivery attempts before DLQ")
  .option("--ack-wait-sec <sec:number>", "Seconds to wait for handler ack")
  // ── Output ─────────────────────────────────────────────────────────
  .option("--output-mode <mode:string>", 'Output: "log" or "json"')
  .action(async (opts) => {
    const cfg = buildConfig({
      natsUrl: opts.natsUrl,
      natsSubjectPrefix: opts.natsSubjectPrefix,
      natsUser: opts.natsUser,
      natsPass: opts.natsPass,
      natsToken: opts.natsToken,
      natsCredsPath: opts.natsCredsPath,
      natsNKeySeed: opts.natsNkeySeed,
      natsTlsCaFile: opts.natsTlsCaFile,
      natsTlsCertFile: opts.natsTlsCertFile,
      natsTlsKeyFile: opts.natsTlsKeyFile,
      hostname: opts.hostname,
      labels: opts.labels,
      requestStream: opts.requestStream,
      dlqStream: opts.dlqStream,
      objectBucket: opts.objectBucket,
      requestStreamMaxAgeSec: opts.requestStreamMaxAgeSec,
      dlqStreamMaxAgeSec: opts.dlqStreamMaxAgeSec,
      objectBucketMaxAgeSec: opts.objectBucketMaxAgeSec,
      maxDeliver: opts.maxDeliver,
      ackWaitSec: opts.ackWaitSec,
      outputMode: opts.outputMode,
    });

    await initLogging(cfg.outputMode);

    const l = log("main");
    l.info("starting", {
      hostname: cfg.hostname,
      natsUrl: cfg.natsUrl,
      natsSubjectPrefix: cfg.natsSubjectPrefix,
      requestStream: cfg.requestStream,
      dlqStream: cfg.dlqStream,
      objectBucket: cfg.objectBucket,
      maxDeliver: cfg.maxDeliver,
      ackWaitSec: cfg.ackWaitSec,
    });

    const stop = await startAgent(cfg);

    const shutdown = async () => {
      l.info("signal received, shutting down");
      await stop();
      Deno.exit(0);
    };
    Deno.addSignalListener("SIGINT", shutdown);
    Deno.addSignalListener("SIGTERM", shutdown);
  })
  .parse(Deno.args);
