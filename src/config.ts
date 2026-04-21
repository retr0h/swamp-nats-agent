// Swamp NATS Agent
// Copyright (C) 2026 John Dewey
//
// This file is part of Swamp NATS Agent.
//
// Swamp NATS Agent is free software: you can redistribute it and/or modify it
// under the terms of the GNU Affero General Public License version 3 as
// published by the Free Software Foundation.
//
// Swamp NATS Agent is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public
// License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with Swamp NATS Agent. If not, see <https://www.gnu.org/licenses/>.

import { z } from "zod";
import { DLQ_STREAM, OBJECT_BUCKET, REQUEST_STREAM } from "./protocol.ts";

// ── Defaults ─────────────────────────────────────────────────────────────

export const DEFAULT_NATS_URL = "nats://localhost:4222";
export const DEFAULT_SUBJECT_PREFIX = "swamp.agent";
export const DEFAULT_MAX_DELIVER = 5;
export const DEFAULT_ACK_WAIT_SEC = 60;
export const DEFAULT_REQUEST_MAX_AGE_SEC = 24 * 3600; // 24h
export const DEFAULT_DLQ_MAX_AGE_SEC = 7 * 24 * 3600; // 7d
export const DEFAULT_OBJECT_MAX_AGE_SEC = 24 * 3600; // 24h

// ── Config schema ────────────────────────────────────────────────────────
//
// Field names that overlap with the transport's ConnectOpts use IDENTICAL
// names so operators see one consistent vocabulary across both sides.

export const ConfigSchema = z.object({
  // ── NATS connection ────────────────────────────────────────────────
  natsUrl: z.string().url(),
  natsSubjectPrefix: z.string().min(1).default(DEFAULT_SUBJECT_PREFIX),

  // ── Auth (supply whichever matches your NATS cluster) ──────────────
  natsUser: z.string().optional(),
  natsPass: z.string().optional().meta({ sensitive: true }),
  natsToken: z.string().optional().meta({ sensitive: true }),
  natsCredsPath: z.string().optional(),
  natsNKeySeed: z.string().optional().meta({ sensitive: true }),
  natsTlsCaFile: z.string().optional(),
  natsTlsCertFile: z.string().optional(),
  natsTlsKeyFile: z.string().optional(),

  // ── Agent identity ─────────────────────────────────────────────────
  hostname: z.string().min(1),
  labels: z.record(z.string(), z.string()).default({}),

  // ── JetStream topology (override defaults for multi-tenant isolation) ─
  requestStream: z.string().min(1).default(REQUEST_STREAM),
  dlqStream: z.string().min(1).default(DLQ_STREAM),
  objectBucket: z.string().min(1).default(OBJECT_BUCKET),

  // ── Retention tuning (seconds) ─────────────────────────────────────
  requestStreamMaxAgeSec: z.number().int().positive().default(DEFAULT_REQUEST_MAX_AGE_SEC),
  dlqStreamMaxAgeSec: z.number().int().positive().default(DEFAULT_DLQ_MAX_AGE_SEC),
  objectBucketMaxAgeSec: z.number().int().positive().default(DEFAULT_OBJECT_MAX_AGE_SEC),

  // ── Consumer tuning (mirrors OSAPI's agent.consumer.* in osapi.yaml) ─
  maxDeliver: z.number().int().positive().default(DEFAULT_MAX_DELIVER),
  ackWaitSec: z.number().int().positive().default(DEFAULT_ACK_WAIT_SEC),

  // ── Output mode ────────────────────────────────────────────────────
  outputMode: z.enum(["log", "json"]).default("log"),
});
export type Config = z.infer<typeof ConfigSchema>;

// ── Flag → env → default resolution ──────────────────────────────────────

export interface RawFlags {
  natsUrl?: string;
  natsSubjectPrefix?: string;
  natsUser?: string;
  natsPass?: string;
  natsToken?: string;
  natsCredsPath?: string;
  natsNKeySeed?: string;
  natsTlsCaFile?: string;
  natsTlsCertFile?: string;
  natsTlsKeyFile?: string;
  hostname?: string;
  labels?: string; // CSV "k=v,k=v"
  requestStream?: string;
  dlqStream?: string;
  objectBucket?: string;
  requestStreamMaxAgeSec?: number;
  dlqStreamMaxAgeSec?: number;
  objectBucketMaxAgeSec?: number;
  maxDeliver?: number;
  ackWaitSec?: number;
  outputMode?: string;
}

export function parseLabels(s: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!s) return out;
  for (const pair of s.split(",")) {
    const [k, v] = pair.trim().split("=", 2);
    if (k && v !== undefined) out[k.trim()] = v.trim();
  }
  return out;
}

/**
 * buildConfig resolves the final Config by merging CLI flags > env >
 * defaults. Returns a validated Config; throws on invalid input.
 *
 * Env var naming convention mirrors OSAPI's: SWAMP_AGENT_<UPPER_SNAKE>.
 */
export function buildConfig(flags: RawFlags): Config {
  const env = (name: string) => Deno.env.get(`SWAMP_AGENT_${name}`);
  const envNum = (name: string): number | undefined => {
    const v = env(name);
    if (v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const raw = {
    natsUrl: flags.natsUrl ?? env("NATS_URL") ?? DEFAULT_NATS_URL,
    natsSubjectPrefix: flags.natsSubjectPrefix ?? env("NATS_SUBJECT_PREFIX"),
    natsUser: flags.natsUser ?? env("NATS_USER"),
    natsPass: flags.natsPass ?? env("NATS_PASS"),
    natsToken: flags.natsToken ?? env("NATS_TOKEN"),
    natsCredsPath: flags.natsCredsPath ?? env("NATS_CREDS_PATH"),
    natsNKeySeed: flags.natsNKeySeed ?? env("NATS_NKEY_SEED"),
    natsTlsCaFile: flags.natsTlsCaFile ?? env("NATS_TLS_CA_FILE"),
    natsTlsCertFile: flags.natsTlsCertFile ?? env("NATS_TLS_CERT_FILE"),
    natsTlsKeyFile: flags.natsTlsKeyFile ?? env("NATS_TLS_KEY_FILE"),
    hostname: flags.hostname ?? env("HOSTNAME") ?? Deno.hostname(),
    labels: parseLabels(flags.labels ?? env("LABELS")),
    requestStream: flags.requestStream ?? env("REQUEST_STREAM"),
    dlqStream: flags.dlqStream ?? env("DLQ_STREAM"),
    objectBucket: flags.objectBucket ?? env("OBJECT_BUCKET"),
    requestStreamMaxAgeSec: flags.requestStreamMaxAgeSec ??
      envNum("REQUEST_STREAM_MAX_AGE_SEC"),
    dlqStreamMaxAgeSec: flags.dlqStreamMaxAgeSec ?? envNum("DLQ_STREAM_MAX_AGE_SEC"),
    objectBucketMaxAgeSec: flags.objectBucketMaxAgeSec ??
      envNum("OBJECT_BUCKET_MAX_AGE_SEC"),
    maxDeliver: flags.maxDeliver ?? envNum("MAX_DELIVER"),
    ackWaitSec: flags.ackWaitSec ?? envNum("ACK_WAIT_SEC"),
    outputMode: flags.outputMode ?? env("OUTPUT_MODE"),
  };

  // Strip undefined so Zod's .default() fires where applicable.
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined),
  );
  return ConfigSchema.parse(cleaned);
}
