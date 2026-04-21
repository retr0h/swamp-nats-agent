import { assertEquals, assertThrows } from "@std/assert";
import { buildConfig, parseLabels } from "./config.ts";

Deno.test("parseLabels: empty string yields empty record", () => {
  assertEquals(parseLabels(""), {});
  assertEquals(parseLabels(undefined), {});
});

Deno.test("parseLabels: single pair", () => {
  assertEquals(parseLabels("role=web"), { role: "web" });
});

Deno.test("parseLabels: multiple pairs with whitespace", () => {
  assertEquals(
    parseLabels(" role = web , env = prod "),
    { role: "web", env: "prod" },
  );
});

Deno.test("parseLabels: ignores malformed entries", () => {
  assertEquals(parseLabels("role=web,invalid"), { role: "web" });
});

Deno.test("buildConfig: CLI flags win over env + defaults", () => {
  const prev = Deno.env.get("SWAMP_AGENT_NATS_URL");
  try {
    Deno.env.set("SWAMP_AGENT_NATS_URL", "nats://env:4222");
    const cfg = buildConfig({
      natsUrl: "nats://flag:4222",
      hostname: "web01",
      labels: "role=web",
    });
    assertEquals(cfg.natsUrl, "nats://flag:4222");
    assertEquals(cfg.hostname, "web01");
    assertEquals(cfg.labels, { role: "web" });
    assertEquals(cfg.natsSubjectPrefix, "swamp.agent");
  } finally {
    if (prev === undefined) Deno.env.delete("SWAMP_AGENT_NATS_URL");
    else Deno.env.set("SWAMP_AGENT_NATS_URL", prev);
  }
});

Deno.test("buildConfig: defaults fill in unset fields", () => {
  const cfg = buildConfig({ hostname: "h" });
  assertEquals(cfg.natsUrl, "nats://localhost:4222");
  assertEquals(cfg.natsSubjectPrefix, "swamp.agent");
  assertEquals(cfg.requestStream, "SWAMP_AGENT");
  assertEquals(cfg.dlqStream, "SWAMP_AGENT_DLQ");
  assertEquals(cfg.objectBucket, "swamp-agent-files");
  assertEquals(cfg.maxDeliver, 5);
  assertEquals(cfg.ackWaitSec, 60);
  assertEquals(cfg.outputMode, "log");
});

Deno.test("buildConfig: rejects invalid URL", () => {
  assertThrows(() => buildConfig({ natsUrl: "not-a-url", hostname: "h" }));
});

Deno.test("buildConfig: rejects non-positive tuning values", () => {
  assertThrows(() => buildConfig({ hostname: "h", maxDeliver: 0 }));
  assertThrows(() => buildConfig({ hostname: "h", ackWaitSec: -1 }));
});

Deno.test("buildConfig: auth fields pass through", () => {
  const cfg = buildConfig({
    hostname: "h",
    natsUser: "ops",
    natsPass: "secret",
    natsCredsPath: "/etc/nats/ops.creds",
  });
  assertEquals(cfg.natsUser, "ops");
  assertEquals(cfg.natsPass, "secret");
  assertEquals(cfg.natsCredsPath, "/etc/nats/ops.creds");
});

Deno.test("buildConfig: custom streams for multi-tenant isolation", () => {
  const cfg = buildConfig({
    hostname: "h",
    requestStream: "TENANT_A_AGENT",
    dlqStream: "TENANT_A_DLQ",
    objectBucket: "tenant-a-files",
    natsSubjectPrefix: "tenant-a.agent",
  });
  assertEquals(cfg.requestStream, "TENANT_A_AGENT");
  assertEquals(cfg.dlqStream, "TENANT_A_DLQ");
  assertEquals(cfg.objectBucket, "tenant-a-files");
  assertEquals(cfg.natsSubjectPrefix, "tenant-a.agent");
});
