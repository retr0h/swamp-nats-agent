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

// Dead-letter publisher. When the agent hits a permanent error (Zod
// validation fail, unknown primitive, fetch-from-bucket miss), it term()s
// the JetStream message and publishes this envelope to the DLQ stream so
// operators have visibility. Transient failures (handler exceptions)
// nak() for retry; only permanent failures DLQ.

import { encodeBase64 } from "@std/encoding/base64";
import type { NatsConnection } from "@nats-io/transport-deno";
import { DLQ_SUBJECT_PREFIX, type DlqEnvelope } from "./protocol.ts";
import { log } from "./logging.ts";

export type DlqReason = DlqEnvelope["reason"];

export function publishDlq(
  nc: NatsConnection,
  hostname: string,
  params: {
    originalSubject: string;
    primitive?: string;
    reason: DlqReason;
    error: string;
    originalPayload?: Uint8Array;
    deliveryAttempt?: number;
  },
): void {
  const l = log("dlq");
  const envelope: DlqEnvelope = {
    originalSubject: params.originalSubject,
    hostname,
    primitive: params.primitive,
    reason: params.reason,
    error: params.error,
    originalPayload: params.originalPayload ? encodeBase64(params.originalPayload) : undefined,
    timestamp: new Date().toISOString(),
    deliveryAttempt: params.deliveryAttempt,
  };
  const subject = `${DLQ_SUBJECT_PREFIX}.${hostname}.${params.reason}`;
  try {
    nc.publish(subject, new TextEncoder().encode(JSON.stringify(envelope)));
    l.warn("dlq published", {
      subject,
      reason: params.reason,
      error: params.error,
    });
  } catch (err) {
    l.error("dlq publish failed", {
      subject,
      reason: params.reason,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
