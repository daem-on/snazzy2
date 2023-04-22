import { HandlerContext } from "https://deno.land/x/rutt@0.1.0/mod.ts";

export const handler = (req: Request, _ctx: HandlerContext): Response => {
	const upgrade = req.headers.get("upgrade") || "";
	if (upgrade.toLowerCase() != "websocket") {
	  return new Response("request isn't trying to upgrade to websocket.");
	}
	const { socket, response } = Deno.upgradeWebSocket(req);
	const channel = new BroadcastChannel("websocket");
	socket.onmessage = (event) => {
		socket.send(`Received ${event.data}`);
		channel.postMessage(event.data);
	};
	channel.onmessage = (event) => {
		socket.send(`Received ${event.data}`);
	};
	socket.onclose = () => {
		channel.close();
	};
	return response;
}