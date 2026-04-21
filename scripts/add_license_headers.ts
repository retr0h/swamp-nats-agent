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

// Ensures every .ts file under main.ts + src/ + scripts/ begins with the
// AGPLv3 header defined in FILE-LICENSE-TEMPLATE.md. Invoked as
// `deno task license-headers`.

import { walk } from "jsr:@std/fs@^1.0.22/walk";

const TEMPLATE = (await Deno.readTextFile("FILE-LICENSE-TEMPLATE.md"))
  .trim()
  .split("\n")
  .map((line) => (line.length > 0 ? `// ${line}` : "//"))
  .join("\n");

const SENTINEL = "// Swamp NATS Agent";
const ROOTS = ["main.ts", "src", "scripts"];

let added = 0;
let kept = 0;

for (const root of ROOTS) {
  const stat = await Deno.stat(root).catch(() => null);
  if (!stat) continue;

  if (stat.isFile) {
    await apply(root);
    continue;
  }

  for await (const entry of walk(root, { exts: [".ts"] })) {
    if (entry.isFile) await apply(entry.path);
  }
}

async function apply(path: string): Promise<void> {
  const original = await Deno.readTextFile(path);
  if (original.startsWith(SENTINEL)) {
    kept++;
    return;
  }
  await Deno.writeTextFile(path, TEMPLATE + "\n\n" + original);
  added++;
  console.log(`+ header: ${path}`);
}

console.log(`\n✓ ${added} added, ${kept} already present`);
