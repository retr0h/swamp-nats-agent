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

// Cross-compile the agent to every supported target. Invoked by
// `deno task compile`.

const TARGETS = [
  { name: "linux-x86_64", triple: "x86_64-unknown-linux-gnu" },
  { name: "linux-aarch64", triple: "aarch64-unknown-linux-gnu" },
  { name: "darwin-x86_64", triple: "x86_64-apple-darwin" },
  { name: "darwin-aarch64", triple: "aarch64-apple-darwin" },
];

await Deno.mkdir("bin", { recursive: true });

for (const t of TARGETS) {
  const out = `bin/swamp-nats-agent-${t.name}`;
  console.log(`→ compiling ${t.name} → ${out}`);
  const cmd = new Deno.Command("deno", {
    args: [
      "compile",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--allow-run",
      "--allow-net",
      "--allow-sys",
      "--target",
      t.triple,
      "--output",
      out,
      "main.ts",
    ],
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await cmd.output();
  if (code !== 0) {
    console.error(`compile failed for ${t.name}`);
    Deno.exit(code);
  }
}

console.log("\n✓ built binaries in ./bin/");
