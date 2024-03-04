import { DeckState, GameDefinition, GameState, QueuedMessage } from "./dtos.ts";
import { handleQueuedMessage } from "./gameServer.ts";
import { getKeys } from "./keys.ts";
import { createSnapshot } from "./utils.ts";

const kv = await Deno.openKv();

export function enqueue(message: QueuedMessage, delay?: number) {
	return kv.enqueue(message, { delay })
}

kv.listenQueue(async m => {
	const message = m as QueuedMessage;

	console.log("dequeued", message);
	const { gameKey, deckKey, defKey } = getKeys(message.gameId);
	const definition = (await kv.get(defKey)).value as GameDefinition;
	handleQueuedMessage(
		message,
		await createSnapshot<GameState>(kv, gameKey),
		await createSnapshot<DeckState>(kv, deckKey),
		definition,
	);
});