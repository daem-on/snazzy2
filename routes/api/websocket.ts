import { HandlerContext } from "https://deno.land/x/rutt@0.1.0/mod.ts";

export const handler = (req: Request, _ctx: HandlerContext): Response => {
	const upgrade = req.headers.get("upgrade") || "";
	if (upgrade.toLowerCase() != "websocket") {
	  return new Response("request isn't trying to upgrade to websocket.");
	}
	const { socket, response } = Deno.upgradeWebSocket(req);
	socket.onmessage = (event) => {
		socket.send(event.data);
	};
	return response;
}