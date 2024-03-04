import { ClientMessage, DeckDefinition, DeckState, GameDefinition, GameState, GameStateSlice, Player, PlayerStatus, QueuedMessage, ServerMessage } from "./dtos.ts";
import { enqueue } from "./queue.ts";
import { Snapshot } from "./utils.ts";

const defaultHandSize = 7;
const roundEndDelay = 5000;

export function initState(playerId: string): GameState {
	return {
		players: {},
		tokens: {},
		roundNumber: 0,
		responses: {},
		connected: [playerId],
		host: playerId
	};
}

export function initDeck(def: DeckDefinition): DeckState {
	return {
		calls: Array(def.calls).fill(0).map((_, i) => i),
		responses: Array(def.responses).fill(0).map((_, i) => i),
	}
}

export function initDefinition(deck: DeckDefinition): GameDefinition {
	return {
		handSize: defaultHandSize,
		deck,
	};
}

// Fisher-Yates
function shuffle(array: unknown[]): void {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

function nextRound(
	{ value: gameState, update: updateState }: Snapshot<GameState>,
	{ value: deckState, update: updateDeck }: Snapshot<DeckState>,
	definition: GameDefinition,
) {
	const ids = Object.keys(gameState.players);

	gameState.roundNumber++;
	console.log("starting round", gameState.roundNumber);
	gameState.reveal = undefined;
	gameState.responses = {};
	gameState.lastWinner = undefined;

	gameState.call = deckState.calls.pop() ?? 0;
	
	const czar = Object.entries(gameState.players).find(([_, player]) => player.status === PlayerStatus.Picking);

	for (const player of Object.values(gameState.players))
		if (player.status === PlayerStatus.Picking) player.status = PlayerStatus.Finished;

	const czarIndex = gameState.connected.indexOf(czar?.[0] ?? "");
	const newIndex = (czarIndex + 1) % gameState.connected.length;
	gameState.players[gameState.connected[newIndex]].status = PlayerStatus.Picking;

	for (const id of ids) {
		const player = gameState.players[id];
		if (player.status === PlayerStatus.Disconnected
			|| player.status === PlayerStatus.Picking) continue;
		player.status = PlayerStatus.Responding;
		dealHand(player, deckState, definition);
	}

	gameState.lastRoundStarted = Date.now();

	updateState(gameState);
	updateDeck(deckState);
}

function dealHand(player: Player, deckState: DeckState, definition: GameDefinition) {
	if (!player.hand) player.hand = [];
	if (player.hand.length < definition.handSize) {
		const amount = definition.handSize - player.hand.length;
		player.hand.push(...deckState.responses.splice(0, amount));
	}
}

function checkAndReveal(gameState: GameState) {
	const players = Object.values(gameState.players);
	if (players.some(player => player.status === PlayerStatus.Responding)) return;

	gameState.reveal = Object.keys(gameState.responses);
	shuffle(gameState.reveal);
}

export function handleMessage(
	message: ClientMessage,
	sendResponse: (response: ServerMessage) => void,
	gameSnapshot: Snapshot<GameState>,
	deckSnapshot: Snapshot<DeckState>,
	playerId: string,
	gameId: string,
	definition: GameDefinition,
) {
	const { value: gameState, update: updateState } = gameSnapshot;
	switch (message.type) {
		case "join": {
			handleJoin(message.username, playerId, gameSnapshot);
			break;
		}
		case "start": {
			if (gameState.host !== playerId) {
				sendResponse({ type: "error", message: "only host can start" });
				return;
			}
			if (gameState.roundNumber !== 0) return;
			if (!Object.values(gameState.players).length) return;
			const { value: deckState, update: updateDeck } = deckSnapshot;
			shuffle(deckState.calls);
			shuffle(deckState.responses);
			updateDeck(deckState);

			nextRound(gameSnapshot, deckSnapshot, definition);
			break;
		}
		case "response": {
			const player = gameState.players[playerId];
			if (gameState.roundNumber === 0) return;
			if (gameState.responses[playerId]) return;
			if (player.status !== PlayerStatus.Responding) return;
			if (!player.hand) return;

			for (const card of message.response) {
				if (!player.hand.includes(card)) return;
			}
			player.hand = player.hand.filter(card => !message.response.includes(card));

			gameState.responses[playerId] = message.response;
			player.status = PlayerStatus.Finished;
			checkAndReveal(gameState);
			updateState(gameState);
			break;
		}
		case "pick": {
			if (gameState.roundNumber === 0) return;
			if (gameState.players[playerId].status !== PlayerStatus.Picking) return;
			if (!gameState.reveal) return;
			if (gameState.lastWinner) return;

			const pickedId = gameState.reveal[message.pickedIndex];
			if (!gameState.responses[pickedId]) throw new Error("response doesn't exist");

			gameState.players[pickedId].points++;
			gameState.lastWinner = pickedId;
			updateState(gameState);
			
			enqueue({
				type: "nextRound",
				gameId,
				ifNotChangedSince: Date.now()
			}, roundEndDelay);
			console.log("enqueued next round");
			break;
		}
	}
}

export function handleQueuedMessage(
	message: QueuedMessage,
	gameSnapshot: Snapshot<GameState>,
	deckSnapshot: Snapshot<DeckState>,
	definition: GameDefinition,
) {
	switch (message.type) {
		case "nextRound": {
			if ((gameSnapshot.value.lastRoundStarted ?? 0) > message.ifNotChangedSince) return;
			nextRound(gameSnapshot, deckSnapshot, definition);
			break;
		}
	}
}

function handleJoin(
	username: string,
	playerId: string,
	{ value: gameState, update: updateState }: Snapshot<GameState>,
) {
	if (gameState.players[playerId]?.status === PlayerStatus.Disconnected) {
		gameState.players[playerId].status = PlayerStatus.Waiting;
		updateState(gameState);
	} else if (!gameState.players[playerId]) {
		gameState.players[playerId] = {
			points: 0,
			status: PlayerStatus.Waiting,
			username
		};
		updateState(gameState);
	}
}

export function handleLeave(
	playerId: string,
	{ value: gameState, update: updateState }: Snapshot<GameState>,
) {
	if (!gameState.players[playerId]) return;
	if (gameState.players[playerId].status === PlayerStatus.Disconnected) return;

	const ids = gameState.connected;
	if (ids.length === 0) return;

	if (gameState.host === playerId) {
		gameState.host = ids[0];
	}
	if (gameState.players[playerId].status === PlayerStatus.Picking) {
		gameState.players[gameState.host].status = PlayerStatus.Picking;
		gameState.responses[gameState.host] = [];
	}

	gameState.players[playerId].status = PlayerStatus.Disconnected;

	checkAndReveal(gameState);
	updateState(gameState);
}

export function createStateSlice(gameState: GameState, playerId: string): GameStateSlice {
	const player = gameState.players[playerId] as Player | undefined;
	return {
		connected: gameState.connected,
		roundNumber: gameState.roundNumber,
		players: Object.entries(gameState.players).map(([_, p]) => ({
			username: p.username,
			points: p.points,
			status: p.status,
		})),
		call: gameState.call,
		revealedResponses: gameState.reveal?.map(id => gameState.responses[id]),
		lastWinner: gameState.lastWinner ? {
			id: gameState.lastWinner,
			username: gameState.players[gameState.lastWinner].username,
			revealIndex: gameState.reveal?.indexOf(gameState.lastWinner) ?? -1,
		} : undefined,
		isHost: gameState.host === playerId,
		hand: player?.hand,
		status: player?.status
	}
}