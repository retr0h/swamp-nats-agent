// Object Store helpers — agent-side counterpart to the transport's
// upload/download. Used when a writeFile/readFile payload crosses the
// wire (all file primitives ride Object Store; no inline path).

import { jetstream } from "@nats-io/jetstream";
import { Objm } from "@nats-io/obj";
import type { NatsConnection } from "@nats-io/transport-deno";
import type { ObjectRef } from "./protocol.ts";

export async function fetchObject(
  nc: NatsConnection,
  ref: ObjectRef,
): Promise<Uint8Array> {
  const js = jetstream(nc);
  const objm = new Objm(js);
  const os = await objm.open(ref.bucket);
  const bytes = await os.getBlob(ref.name);
  if (bytes === null) {
    throw new Error(`object not found: ${ref.bucket}/${ref.name}`);
  }
  return bytes;
}

/** Upload bytes under a randomly-named key in the configured object bucket
 *  and return the ObjectRef for the transport to fetch. */
export async function putObject(
  nc: NatsConnection,
  bucket: string,
  hostname: string,
  bytes: Uint8Array,
): Promise<ObjectRef> {
  const js = jetstream(nc);
  const objm = new Objm(js);
  const os = await objm.open(bucket);
  const name = `${hostname}/${crypto.randomUUID()}`;
  const info = await os.putBlob({ name }, bytes);
  return {
    bucket,
    name,
    digest: info.digest,
    size: info.size,
  };
}
