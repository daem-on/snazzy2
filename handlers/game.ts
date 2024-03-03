import vs from "https://deno.land/x/value_schema@v4.0.0-rc.2/mod.ts";
import { ClientMessage, DeckDefinition, DeckState, GameState, ServerMessage } from "../dtos.ts";
import { createStateSlice, handleLeave, handleMessage, initDeck, initState } from "../gameServer.ts";
import { appShutdown } from "../main.ts";

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

function onWebsocketInit(socket: WebSocket, callback: () => void) {
	if (socket.readyState === WebSocket.OPEN) callback();
	else socket.onopen = callback;
}

function createCleanup() {
	const cleanupTasks: (() => void)[] = [];
	return {
		onCleanup: (task: () => void) => cleanupTasks.push(task),
		cleanup: () => cleanupTasks.forEach(t => t()),
	};
}

export const gameHandler = (url: URL, socket: WebSocket, id: string): Promise<void> => {
	return initServer(socket, id, url);
}

async function initServer(socket: WebSocket, gameId: string, url: URL) {
	const { cleanup, onCleanup } = createCleanup();

	try {
		const gameKey = ["game", gameId];
		const deckKey = ["deck", gameId];
		const defKey = ["def", gameId];
		
		const claimedToken = url.searchParams.get("token");

		let gameState = (await db.get(gameKey)).value as GameState;

		const [playerId, playerToken] = getCredentials(claimedToken, gameState);

		if (!gameState || gameState.connected.length === 0) {
			gameState = initState(playerId);
		} else {
			gameState.connected.push(playerId);
		}
		gameState.tokens[playerId] = playerToken;
		db.set(gameKey, gameState);

		onCleanup(() => {
			if (gameState) {
				gameState.connected = gameState?.connected.filter(id => id != playerId);
				if (gameState.connected.length === 0) {
					console.log("deleting game", gameId);
					db.delete(gameKey);
					db.delete(deckKey);
					db.delete(defKey);
					return;
				}
				handleLeave(
					gameState,
					playerId,
					state => db.set(gameKey, state),
				);
				db.set(gameKey, gameState);
			}
		});

		let definition = (await db.get(defKey)).value as DeckDefinition;
		if (!definition) {
			const deckUrl = url.searchParams.get("deck");
			if (!deckUrl) throw new Error("no deck url");
	
			definition = await fetchAndValidateDeck(deckUrl);
			db.set(defKey, definition);
		}
		
		let deckState = (await db.get(deckKey)).value as DeckState;
		if (!deckState) {
			deckState = initDeck(definition);
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

		onCleanup(() => {
			gameReader.cancel();
			deckReader.cancel();
		});
	
		socket.onmessage = event => {
			const message = JSON.parse(event.data) as ClientMessage;
			console.log("message", message);
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
		
		onWebsocketInit(socket, () => {
			sendMessage(socket, { type: "init", id: playerId, token: playerToken, deckUrl: definition.url });
		});
		
		const sub = appShutdown.subscribe(cleanup);
		socket.onclose = cleanup;
		
		onCleanup(() => {
			sub.unsubscribe();
			socket.close();
		});
	} catch {
		cleanup();
	}
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

async function fetchAndValidateDeck(url: string): Promise<DeckDefinition> {
	console.log("fetching deck", url);
	const response = await fetch(url);
	const deck = await response.json();
	const result = vs.applySchemaObject({
		calls: vs.array({
			each: vs.array({
				each: vs.string({ ifEmptyString: null })
			})
		}),
		responses: vs.array({
			each: vs.array({ each: vs.string() })
		}),
	}, deck);
	return {
		calls: result.calls.length,
		responses: result.responses.length,
		callLengths: result.calls.map(c => c.length),
		url,
	};
}