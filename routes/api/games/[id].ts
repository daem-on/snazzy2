import { HandlerContext } from "$fresh/server.ts";
import { ClientMessage, DeckState, GameState, ServerMessage } from "../../../dtos.ts";
import { createStateSlice, handleLeave, handleMessage, initDeck, initState } from "../../../gameServer.ts";
import { appShutdown } from "../../../main.ts";

const db = await Deno.openKv();

function sendMessage(socket: WebSocket, message: ServerMessage) {
	socket.send(JSON.stringify(message));
}

class AsyncReader<T> {
	private reader: ReadableStreamDefaultReader<[T]>;

	constructor(stream: ReadableStream<[T]>) {
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

	const url = new URL(req.url);
	
	await initServer(socket, gameId, url);

	return response;
}

async function initServer(socket: WebSocket, gameId: string, url: URL) {
	const gameKey = ["game", gameId];
	const deckKey = ["deck", gameId];
	
	const claimedToken = url.searchParams.get("token");

	let gameState = (await db.get(gameKey)).value as GameState;

	const [playerId, playerToken] = getCredentials(claimedToken, gameState);

	socket.onopen = () => {
		sendMessage(socket, { type: "init", id: playerId, token: playerToken });
	};

	if (!gameState || gameState.connected.length === 0) {
		gameState = initState(playerId);
	} else {
		gameState.connected.push(playerId);
	}
	db.set(gameKey, gameState);
	
	let deckState = (await db.get(deckKey)).value as DeckState;
	if (!deckState) {
		deckState = initDeck({ calls: 3, responses: 20, callLengths: [1, 1, 1] });
		db.set(deckKey, deckState);
	}

	const gameReader = new AsyncReader(db.watch([gameKey]));
	gameReader.start(state => {
		// console.log("update", state.value);
		gameState = state.value as GameState;
		if (!gameState) return;
		sendMessage(socket, {
			type: "state",
			state: createStateSlice(gameState, playerId)
		});
	});
	const deckReader = new AsyncReader(db.watch([deckKey]));
	deckReader.start(state => {
		deckState = state.value as DeckState;
	});

	socket.onmessage = event => {
		const message = JSON.parse(event.data) as ClientMessage;
		handleMessage(
			message,
			response => sendMessage(socket, response),
			gameState,
			deckState,
			playerId,
			state => db.set(gameKey, state),
			state => db.set(deckKey, state),
			gameId,
		);
	};

	function cleanup() {
		gameReader.cancel();
		if (gameState) {
			gameState.connected = gameState?.connected.filter(id => id != playerId);
			if (gameState.connected.length === 0) {
				db.delete(gameKey);
				return;
			}
			handleLeave(
				gameState,
				playerId,
				state => db.set(gameKey, state),
			);
		}
		sub.unsubscribe();
		db.set(gameKey, gameState);
		socket.close();
	}
	
	const sub = appShutdown.subscribe(cleanup);
	socket.onclose = cleanup;
}

function getCredentials(claimed: string | null, gameState: GameState | null): [playerId: string, token: string] {
	if (claimed) {
		if (!gameState) throw new Error("game doesn't exist");
		const player = Object.entries(gameState.tokens).find(([_, t]) => t === claimed);
		if (!player) throw new Error("invalid token");
		return [player[0], claimed];
	} else {
		return [crypto.randomUUID(), crypto.randomUUID()];
	}
}