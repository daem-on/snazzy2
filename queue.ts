import { GameState, QueuedMessage } from "./dtos.ts";
import { handleQueuedMessage } from "./gameServer.ts";

const kv = await Deno.openKv();

export function enqueue(message: QueuedMessage, delay?: number) {
	return kv.enqueue(message, { delay })
}

kv.listenQueue(async m => {
	const message = m as QueuedMessage;

	console.log("dequeued", message);
	const key = ["game", message.gameId];
	const stored = await kv.get(key);
	const gameState = stored.value as GameState | null;
	if (!gameState) return;
	handleQueuedMessage(
		message,
		gameState,
		state => kv.set(key, state)
	);
});