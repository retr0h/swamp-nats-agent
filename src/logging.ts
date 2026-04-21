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
