import { HandlerContext } from "https://deno.land/x/rutt@0.1.0/mod.ts";

function getBroadcastChannel(name: string) {
	if (typeof BroadcastChannel !== "undefined") {
		return new BroadcastChannel(name);
	} else {
		return {
			postMessage: () => {},
			onmessage: () => {},
			close: () => {},
		}
	}
}

export const handler = (req: Request, _ctx: HandlerContext): Response => {
	const upgrade = req.headers.get("upgrade") || "";
	if (upgrade.toLowerCase() != "websocket") {
	  return new Response("request isn't trying to upgrade to websocket.");
	}
	const { socket, response } = Deno.upgradeWebSocket(req);
	const channel = getBroadcastChannel("websocket");
	socket.onmessage = (event) => {
		socket.send(`Received ${event.data}`);
		channel.postMessage(event.data);
	};
	channel.onmessage = (event) => {
		console.log("channel message", event.data);
		socket.send(`Received ${event.data}`);
	};
	socket.onclose = ev => {
		console.log("socket closed", ev.code, ev.reason);
		channel.close();
	};
	return response;
}