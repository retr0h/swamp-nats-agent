import { assertEquals, assertStringIncludes } from "@std/assert";
import { buildShellInvocation, runExec, shellEscape } from "./exec.ts";

Deno.test("shellEscape: single-quotes a string", () => {
  assertEquals(shellEscape("hello"), "'hello'");
});

Deno.test("shellEscape: escapes embedded single quotes", () => {
  assertEquals(shellEscape("it's"), "'it'\\''s'");
});

Deno.test("buildShellInvocation: sudo=false passes command through", () => {
  const result = buildShellInvocation({ cmd: "echo hi" });
  assertEquals(result.shell, "echo hi");
  assertEquals(result.stdin, undefined);
});

Deno.test("buildShellInvocation: sudo=true without password uses -n", () => {
  const result = buildShellInvocation({ cmd: "id", sudo: true });
  assertStringIncludes(result.shell, "sudo -n");
  assertStringIncludes(result.shell, "sh -c 'id'");
  assertEquals(result.stdin, undefined);
});

Deno.test("buildShellInvocation: sudo=true with password uses -S + stdin", () => {
  const result = buildShellInvocation({
    cmd: "id",
    sudo: true,
    becomePassword: "secret",
  });
  assertStringIncludes(result.shell, "sudo -S -p ''");
  assertStringIncludes(result.stdin ?? "", "secret\n");
});

Deno.test("buildShellInvocation: sudo + custom becomeUser", () => {
  const result = buildShellInvocation({
    cmd: "whoami",
    sudo: true,
    becomeUser: "www-data",
  });
  assertStringIncludes(result.shell, "-u 'www-data'");
});

Deno.test("runExec: echo hello returns stdout + exit 0", async () => {
  const result = await runExec({ cmd: "echo hello" });
  assertEquals(result.stdout.trim(), "hello");
  assertEquals(result.exitCode, 0);
});

Deno.test("runExec: non-zero exit code is surfaced", async () => {
  const result = await runExec({ cmd: "exit 42" });
  assertEquals(result.exitCode, 42);
});

Deno.test("runExec: stderr is captured separately", async () => {
  const result = await runExec({ cmd: "echo err >&2 ; echo out" });
  assertEquals(result.stdout.trim(), "out");
  assertEquals(result.stderr.trim(), "err");
});

Deno.test("runExec: stdin is piped into the command", async () => {
  const result = await runExec({ cmd: "cat", stdin: "piped input" });
  assertEquals(result.stdout, "piped input");
});

Deno.test("runExec: timeout surfaces as error field", async () => {
  const result = await runExec({ cmd: "sleep 5", timeoutSec: 1 });
  // When abort fires, Deno may kill the child via SIGTERM (exit 143) before
  // our catch block runs, so we only assert the error field is set.
  assertStringIncludes(result.error ?? "", "timeout");
});
