import { HandlerContext } from "https://deno.land/x/rutt@0.1.0/mod.ts";

export const handler = (req: Request, _ctx: HandlerContext): Response => {
	const { socket, response } = Deno.upgradeWebSocket(req);
	socket.onmessage = (event) => {
		socket.send(event.data);
	};
	return response;
}