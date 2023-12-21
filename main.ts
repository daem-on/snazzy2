/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />

import { start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";

import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";

import { Subject } from "https://esm.sh/rxjs@7.8.1";

export const appShutdown = new Subject<void>();

globalThis.addEventListener("beforeunload", () => {
	console.log("beforeunload")
	appShutdown.next();
});

Deno.addSignalListener("SIGINT", () => {
	console.log("SIGINT")
	appShutdown.next();
	Deno.exit();
});

await start(manifest, { plugins: [twindPlugin(twindConfig)] });
