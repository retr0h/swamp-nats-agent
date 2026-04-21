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

// Re-vendors src/protocol.ts from the upstream source of truth at
// ../swamp-nats/extensions/models/lib/protocol.ts. Adds the agent's AGPL
// license header and a vendoring banner before the code body.

const UPSTREAM = "../swamp-nats/extensions/models/lib/protocol.ts";
const VENDOR = "src/protocol.ts";

const HEADER = `// Swamp NATS Agent
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

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ VENDORED from swamp-nats/extensions/models/lib/protocol.ts              │
// │ Source of truth lives in the transport extension. This file is a copy   │
// │ kept in sync by \`deno task check-protocol-sync\` (see scripts/).         │
// │ DO NOT EDIT directly — edit the upstream file and re-vendor.            │
// └─────────────────────────────────────────────────────────────────────────┘

`;

const upstream = await Deno.readTextFile(UPSTREAM);
const idx = upstream.indexOf("import {");
if (idx === -1) throw new Error("no 'import {' found in upstream source");
const body = upstream.slice(idx);

await Deno.writeTextFile(VENDOR, HEADER + body);
console.log(`✓ vendored ${UPSTREAM} → ${VENDOR}`);
