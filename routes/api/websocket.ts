import { HandlerContext } from "https://deno.land/x/rutt@0.1.0/mod.ts";

export const handler = (req: Request, _ctx: HandlerContext): Response => {
	const upgrade = req.headers.get("upgrade") || "";
	if (upgrade.toLowerCase() != "websocket") {
	  return new Response("request isn't trying to upgrade to websocket.");
	}
	const { socket, response } = Deno.upgradeWebSocket(req);
	const channel = new BroadcastChannel("websocket");
	console.log("Opening broadcastchannel");
	socket.onmessage = (event) => {
		channel.postMessage(event.data);
		console.log(`Socket message: ${event.data}`)
	};
	channel.onmessage = (event) => {
		console.log(`Channel message: ${event.data}`)
		if (socket.readyState === socket.OPEN)
			socket.send(`Received ${event.data}`);
		if (event.data === "ping")
			channel.postMessage("pong");
	};
	setTimeout(() => {
		channel.postMessage("closing");
		channel.close();
		socket.close();
	}, 10000);
	return response;
}