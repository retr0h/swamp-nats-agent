import type { ExecRequest, ExecResponse } from "../protocol.ts";

const DEFAULT_TIMEOUT_SEC = 30;

/**
 * runExec handles the "exec" primitive. Runs the command under /bin/sh so the
 * model side sees the same parsing semantics as SSH's ControlMaster exec.
 * When `sudo` is true, the command is wrapped in `sudo -n` or `sudo -S` with
 * the password piped via stdin — the agent enforces sudo locally so the
 * operator never sends raw sudo command strings.
 */
export async function runExec(req: ExecRequest): Promise<ExecResponse> {
  const timeoutSec = req.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
  const { shell, stdin } = buildShellInvocation(req);

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutSec * 1000);

  try {
    const cmd = new Deno.Command("sh", {
      args: ["-c", shell],
      stdin: stdin ? "piped" : "null",
      stdout: "piped",
      stderr: "piped",
      signal: abort.signal,
    });
    const child = cmd.spawn();

    if (stdin) {
      const writer = child.stdin.getWriter();
      await writer.write(new TextEncoder().encode(stdin));
      await writer.close();
    }

    const output = await child.output();
    const response: ExecResponse = {
      stdout: new TextDecoder().decode(output.stdout),
      stderr: new TextDecoder().decode(output.stderr),
      exitCode: output.code,
    };
    if (abort.signal.aborted) {
      response.error = `timeout after ${timeoutSec}s`;
    }
    return response;
  } catch (err) {
    return {
      stdout: "",
      stderr: "",
      exitCode: -1,
      error: abort.signal.aborted
        ? `timeout after ${timeoutSec}s`
        : err instanceof Error
        ? err.message
        : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Shell escape helper for the agent's own sudo wrapping. Single-quotes a
 *  string and escapes embedded single quotes. */
export function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/**
 * buildShellInvocation composes the shell command and stdin string based on
 * the request's sudo options. When sudo is off, we run the command as-is.
 * When sudo is on without a password, we use `sudo -n` (non-interactive —
 * fails fast if a password is required). With a password, `sudo -S` reads
 * the password from stdin on the first line.
 */
export function buildShellInvocation(
  req: ExecRequest,
): { shell: string; stdin: string | undefined } {
  const userStdin = req.stdin;
  if (!req.sudo) {
    return { shell: req.cmd, stdin: userStdin };
  }
  const sudoUser = req.becomeUser ?? "root";
  const inner = shellEscape(req.cmd);
  if (req.becomePassword) {
    return {
      shell: `sudo -S -p '' -u ${shellEscape(sudoUser)} -- sh -c ${inner}`,
      stdin: req.becomePassword + "\n" + (userStdin ?? ""),
    };
  }
  return {
    shell: `sudo -n -u ${shellEscape(sudoUser)} -- sh -c ${inner}`,
    stdin: userStdin,
  };
}
