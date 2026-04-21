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

// JetStream topology for the agent:
//   - {requestStream}          — captures {subjectPrefix}.>     (limits retention)
//   - agent-{hostname} consumer — filter {subjectPrefix}.{host}.>, explicit ack
//   - {dlqStream}              — captures swamp.dlq.>           (limits retention)
//   - {objectBucket}           — Object Store for large file transfers
//
// All stream/consumer/bucket names come from Config — no hardcoded constants
// in this module. Defaults live in protocol.ts and are pulled in through
// Config defaults.

import {
  AckPolicy,
  type Consumer,
  DeliverPolicy,
  jetstream,
  type JetStreamClient,
  type JetStreamManager,
  RetentionPolicy,
  StorageType,
} from "@nats-io/jetstream";
import { Objm } from "@nats-io/obj";
import type { NatsConnection } from "@nats-io/transport-deno";
import type { Config } from "./config.ts";
import { log } from "./logging.ts";
import { DLQ_SUBJECT_PREFIX } from "./protocol.ts";

const SEC_TO_NS = 1_000_000_000;

export async function ensureStreams(
  jsm: JetStreamManager,
  cfg: Config,
): Promise<void> {
  const l = log("jetstream");
  await ensureStream(jsm, {
    name: cfg.requestStream,
    subjects: [`${cfg.natsSubjectPrefix}.>`],
    max_age: cfg.requestStreamMaxAgeSec * SEC_TO_NS,
  }, l);
  await ensureStream(jsm, {
    name: cfg.dlqStream,
    subjects: [`${DLQ_SUBJECT_PREFIX}.>`],
    max_age: cfg.dlqStreamMaxAgeSec * SEC_TO_NS,
  }, l);
}

async function ensureStream(
  jsm: JetStreamManager,
  opts: { name: string; subjects: string[]; max_age: number },
  l: ReturnType<typeof log>,
): Promise<void> {
  // Critical: no_ack disables the PubAck that JetStream would otherwise
  // send to the message's reply inbox on successful capture, which races
  // our core subscriber's msg.respond() and breaks request-reply.
  const config = {
    name: opts.name,
    subjects: opts.subjects,
    retention: RetentionPolicy.Limits,
    storage: StorageType.File,
    max_age: opts.max_age,
    num_replicas: 1,
    no_ack: true,
  };

  try {
    await jsm.streams.info(opts.name);
    // Stream exists — reconcile config so any drift (e.g. no_ack flip,
    // retention change, subject scope change) gets applied without a
    // manual delete-and-recreate.
    await jsm.streams.update(opts.name, config);
    l.info("stream reconciled", { stream: opts.name });
  } catch {
    await jsm.streams.add(config);
    l.info("stream created", { stream: opts.name });
  }
}

export async function ensureObjectBucket(
  nc: NatsConnection,
  cfg: Config,
): Promise<void> {
  const l = log("jetstream");
  const js = jetstream(nc);
  const objm = new Objm(js);
  try {
    await objm.open(cfg.objectBucket);
    l.info("object bucket exists", { bucket: cfg.objectBucket });
  } catch {
    await objm.create(cfg.objectBucket, {
      storage: StorageType.File,
    });
    l.info("object bucket created", { bucket: cfg.objectBucket });
  }
}

export async function ensureDirectConsumer(
  jsm: JetStreamManager,
  cfg: Config,
): Promise<string> {
  const name = `agent-${cfg.hostname}`;
  const filter = `${cfg.natsSubjectPrefix}.${cfg.hostname}.>`;
  const l = log("jetstream");
  try {
    await jsm.consumers.info(cfg.requestStream, name);
    l.info("consumer exists", { name, filter });
  } catch {
    await jsm.consumers.add(cfg.requestStream, {
      durable_name: name,
      filter_subject: filter,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.New,
      max_deliver: cfg.maxDeliver,
      ack_wait: cfg.ackWaitSec * SEC_TO_NS,
    });
    l.info("consumer created", { name, filter });
  }
  return name;
}

export async function getConsumer(
  js: JetStreamClient,
  streamName: string,
  consumerName: string,
): Promise<Consumer> {
  return await js.consumers.get(streamName, consumerName);
}
