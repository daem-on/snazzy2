import { DeckState, GameState, QueuedMessage } from "./dtos.ts";
import { handleQueuedMessage } from "./gameServer.ts";

const kv = await Deno.openKv();

export function enqueue(message: QueuedMessage, delay?: number) {
	return kv.enqueue(message, { delay })
}

kv.listenQueue(async m => {
	const message = m as QueuedMessage;

	console.log("dequeued", message);
	const gameKey = ["game", message.gameId];
	const stored = await kv.get(gameKey);
	const gameState = stored.value as GameState | null;
	if (!gameState) return;
	const deckKey = ["deck", message.gameId];
	const deckState = (await kv.get(deckKey)).value as DeckState;
	handleQueuedMessage(
		message,
		gameState,
		state => kv.set(gameKey, state),
		deckState,
		state => kv.set(deckKey, state),
	);
});