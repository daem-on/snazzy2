import { QueuedMessage } from "./dtos.ts";
import { GameState, handleQueuedMessage } from "./gameServer.ts";

const kv = await Deno.openKv();

export function enqueue(message: QueuedMessage, delay?: number) {
	return kv.enqueue(message, { delay })
}

kv.listenQueue(async m => {
	const message = m as QueuedMessage;

	const key = ["games", message.gameId];
	const stored = await kv.get(key);
	const gameState = stored.value as GameState | null;
	if (!gameState) return;
	handleQueuedMessage(
		message,
		gameState,
		state => kv.set(key, state)
	);
});