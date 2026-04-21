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

import type { NatsConnection } from "@nats-io/transport-deno";
import type { WriteFileRequest, WriteFileResponse } from "../protocol.ts";
import { fetchObject } from "../object_store.ts";

/**
 * runWriteFile fetches content from Object Store, then writes it to the
 * local filesystem. Non-sudo writes use Deno's FS APIs; sudo writes shell
 * out to install(1) for atomic mode + ownership.
 */
export async function runWriteFile(
  nc: NatsConnection,
  req: WriteFileRequest,
): Promise<WriteFileResponse> {
  try {
    const bytes = await fetchObject(nc, req.sourceObject);
    if (req.sudo) {
      await writeWithSudo(req, bytes);
    } else {
      await writeWithoutSudo(req, bytes);
    }
    return { ok: true, bytesWritten: bytes.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function writeWithoutSudo(
  req: WriteFileRequest,
  bytes: Uint8Array,
): Promise<void> {
  const mode = req.mode ? parseInt(req.mode, 8) : 0o644;
  await Deno.writeFile(req.path, bytes, { mode });
  if (req.owner || req.group) {
    await chown(req.path, req.owner, req.group);
  }
}

async function writeWithSudo(
  req: WriteFileRequest,
  bytes: Uint8Array,
): Promise<void> {
  const mode = req.mode ?? "0644";
  const args = ["-n", "install", "-m", mode];
  if (req.owner) args.push("-o", req.owner);
  if (req.group) args.push("-g", req.group);
  args.push("/dev/stdin", req.path);

  const cmd = new Deno.Command("sudo", {
    args,
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(bytes);
  await writer.close();
  const output = await child.output();
  if (output.code !== 0) {
    const stderr = new TextDecoder().decode(output.stderr);
    throw new Error(`sudo install ${req.path} exit=${output.code}: ${stderr.trim()}`);
  }
}

async function chown(
  path: string,
  owner: string | undefined,
  group: string | undefined,
): Promise<void> {
  const spec = owner && group ? `${owner}:${group}` : owner ?? `:${group}`;
  const output = await new Deno.Command("chown", {
    args: [spec, path],
    stdout: "null",
    stderr: "piped",
  }).output();
  if (output.code !== 0) {
    const stderr = new TextDecoder().decode(output.stderr);
    throw new Error(`chown ${path} exit=${output.code}: ${stderr.trim()}`);
  }
}
