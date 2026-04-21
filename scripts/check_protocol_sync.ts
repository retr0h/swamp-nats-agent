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

// Guards against drift between the vendored src/protocol.ts and the source
// of truth at ../swamp-nats/extensions/models/lib/protocol.ts. The source
// file is discovered relative to this repo; if the sibling swamp-nats repo
// isn't checked out, the check is skipped with a warning (not an error) —
// CI is expected to have both repos present when drift matters.

const UPSTREAM = "../swamp-nats/extensions/models/lib/protocol.ts";
const VENDOR = "src/protocol.ts";

const upstreamExists = await Deno.stat(UPSTREAM).then(() => true).catch(() => false);
if (!upstreamExists) {
  console.warn(
    `skip: ${UPSTREAM} not present (sibling repo not checked out) — ` +
      "drift cannot be verified in this environment",
  );
  Deno.exit(0);
}

const upstream = await Deno.readTextFile(UPSTREAM);
const vendor = await Deno.readTextFile(VENDOR);

// Upstream has the extension's license header; vendor has the agent's header
// + vendoring banner. Compare only the code body starting at the first import.
const upstreamBody = body(upstream);
const vendorBody = body(vendor);

if (upstreamBody !== vendorBody) {
  console.error(
    `protocol.ts drift detected.\n` +
      `Upstream: ${UPSTREAM}\n` +
      `Vendored: ${VENDOR}\n` +
      `Run 'deno task vendor-protocol' to re-sync.`,
  );
  Deno.exit(1);
}

console.log("✓ protocol.ts is in sync with upstream");

function body(src: string): string {
  const idx = src.indexOf("import {");
  if (idx === -1) throw new Error("no 'import {' found in source");
  return src.slice(idx);
}
