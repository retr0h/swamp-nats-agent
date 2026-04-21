import type { NatsConnection } from "@nats-io/transport-deno";
import type { ReadFileRequest, ReadFileResponse } from "../protocol.ts";
import { putObject } from "../object_store.ts";

/** runReadFile reads the file locally (sudo via `sudo -n cat` if requested),
 *  uploads the bytes to the configured Object Store bucket, and returns the
 *  ObjectRef. The operator-side transport downloads and decodes. */
export async function runReadFile(
  nc: NatsConnection,
  bucket: string,
  hostname: string,
  req: ReadFileRequest,
): Promise<ReadFileResponse> {
  try {
    const bytes = req.sudo ? await readWithSudo(req.path) : await Deno.readFile(req.path);
    const ref = await putObject(nc, bucket, hostname, bytes);
    return { sourceObject: ref };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function readWithSudo(path: string): Promise<Uint8Array> {
  const output = await new Deno.Command("sudo", {
    args: ["-n", "cat", path],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (output.code !== 0) {
    const stderr = new TextDecoder().decode(output.stderr);
    throw new Error(`sudo cat ${path} exit=${output.code}: ${stderr.trim()}`);
  }
  return output.stdout;
}
