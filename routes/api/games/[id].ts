import { HandlerContext } from "$fresh/server.ts";
import { ClientMessage, ServerMessage } from "../../../dtos.ts";
import { GameState } from "../../../gameServer.ts";

const db = await Deno.openKv();

function sendMessage(socket: WebSocket, message: ServerMessage) {
	socket.send(JSON.stringify(message));
}

class AsyncReader<T> {
	private reader: ReadableStreamDefaultReader<[T]>;

	constructor(private stream: ReadableStream<[T]>) {
		this.reader = stream.getReader();
	}

	async start(onMessage: (message: T) => void) {
		while (true) {
			const update = await this.reader.read();
			if (update.done) break;
			const [message] = update.value;
			onMessage(message);
		}
	}

	cancel() {
		this.reader.cancel();
	}
}

export const handler = async (req: Request, ctx: HandlerContext): Promise<Response> => {
	const upgrade = req.headers.get("upgrade") || "";
	if (upgrade.toLowerCase() != "websocket") {
	  return new Response("request isn't trying to upgrade to websocket.");
	}
	
	const gameId = ctx.params.id;
	if (gameId === undefined) {
		return new Response("invalid id");
	}

	const { socket, response } = Deno.upgradeWebSocket(req);

	const key = ["game", gameId];
	
	const playerToken = crypto.randomUUID();

	socket.onopen = () => {
		sendMessage(socket, { type: "init", token: playerToken });
	};

	const stored = await db.get(key);
	let gameState = stored.value as GameState;
	if (!gameState) {
		gameState = {
			players: {},
			roundNumber: 0,
			reveal: false,
			responses: {},
			tokens: [],
			host: ""
		};
		db.set(key, gameState);
	}

	const stream = db.watch([key]);
	const reader = new AsyncReader(stream);
	reader.start(state => {
		console.log("update", state.value);
		gameState = state.value as GameState;
		sendMessage(socket, { type: "state", state: gameState });
	});

	socket.onmessage = event => {
		const message = JSON.parse(event.data) as ClientMessage;
		if (message.type === "join") {
			gameState.players[playerToken] = {
				points: 0,
				status: "waiting",
				username: message.username
			};
			db.set(key, gameState);
		}
	};
	
	socket.onclose = ev => {
		console.log("socket closed", ev.code, ev.reason);
		reader.cancel();
	};
	
	return response;
}