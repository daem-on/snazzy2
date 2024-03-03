import { Subject } from "https://esm.sh/rxjs@7.8.1";
import { gameHandler } from "./handlers/game.ts";
import { resetHandler } from "./handlers/reset.ts";

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

async function routeRequest(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const path = url.pathname;

	if (path.startsWith("/games/")) {
		const gameId = path.split("/")[2] as string | undefined;
		const upgrade = req.headers.get("upgrade") || "";
		if (upgrade.toLowerCase() != "websocket") {
			return new Response("request isn't trying to upgrade to websocket.");
		}
		if (!gameId) {
			return new Response("game id not found in path.");
		}
		const { socket, response } = Deno.upgradeWebSocket(req);
		await gameHandler(url, socket, gameId);
		return response;
	} else if (path === "/reset") {
		await resetHandler();
		return new Response("ok");
	} else if (path === "/health") {
		return new Response("ok", {
			status: 200,
			headers: { "Access-Control-Allow-Origin": "*" }
		});
	} else {
		return new Response("Not found\n", { status: 404 });
	}
}

async function handleRequest(req: Request): Promise<Response> {
	try {
		return await routeRequest(req);
	} catch (e) {
		console.error("Error in request handler", e);
		return new Response("Internal error\n", { status: 500 });
	}
}

Deno.serve({ port: 8000 }, handleRequest);