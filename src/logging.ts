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

import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { getPrettyFormatter } from "@logtape/pretty";

export type Mode = "log" | "json";

/** initLogging wires LogTape with a console sink. "log" mode uses the pretty
 *  formatter for humans; "json" emits one JSON line per record. */
export async function initLogging(mode: Mode = "log"): Promise<void> {
  await configure({
    sinks: {
      console: mode === "json"
        ? getConsoleSink()
        : getConsoleSink({ formatter: getPrettyFormatter() }),
    },
    loggers: [
      { category: "swamp-nats-agent", sinks: ["console"], lowestLevel: "info" },
      { category: ["logtape", "meta"], sinks: ["console"], lowestLevel: "warning" },
    ],
  });
}

export function log(component: string) {
  return getLogger(["swamp-nats-agent", component]);
}
