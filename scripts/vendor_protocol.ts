// Re-vendors src/protocol.ts from the upstream source of truth at
// ../swamp-nats/extensions/models/lib/protocol.ts. Prepends a short
// vendoring banner so readers know not to edit this file directly.

const UPSTREAM = "../swamp-nats/extensions/models/lib/protocol.ts";
const VENDOR = "src/protocol.ts";

const BANNER = `// ┌─────────────────────────────────────────────────────────────────────────┐
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

await Deno.writeTextFile(VENDOR, BANNER + body);
console.log(`✓ vendored ${UPSTREAM} → ${VENDOR}`);
