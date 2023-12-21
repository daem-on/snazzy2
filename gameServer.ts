import { ClientMessage, QueuedMessage, ServerMessage } from "./dtos.ts";
import { enqueue } from "./queue.ts";

type Card = number;

enum PlayerStatus {
	Waiting,
	Responding,
	Picking,
	Finished,
	Disconnected
}

type Player = {
	username: string;
	points: number;
	status: PlayerStatus;
	hand?: Card[];
};

export type GameState = {
	players: Record<string, Player>;
	roundNumber: number;
	reveal: boolean;
	deck: Card[];
	call?: Card;
	responses: Record<string, Card[]>;
	revealOrder?: string[];
	czarIndex?: number;
	connected: string[];
	host: string;
	lastRoundStarted?: number;
};

const handSize = 7;
const roundEndDelay = 5000;

export function initState(playerToken: string, deckSize: number): GameState {
	return {
		players: {},
		roundNumber: 0,
		reveal: false,
		responses: {},
		deck: [...Array(deckSize).keys()],
		connected: [playerToken],
		host: playerToken
	};
}

// Fisher-Yates
function shuffle(array: unknown[]): void {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

function nextRound(gameState: GameState, updateState: (state: GameState) => void) {
	const players = Object.keys(gameState.players);

	gameState.roundNumber++;
	gameState.reveal = false;
	gameState.call = Math.floor(Math.random() * 10);
	gameState.responses = {};
	gameState.czarIndex = (gameState.czarIndex ?? 0) + 1 % gameState.connected.length;
	gameState.players[gameState.connected[gameState.czarIndex]].status = PlayerStatus.Picking;

	for (const player of players) {
		if (gameState.players[player].status === PlayerStatus.Disconnected
			|| gameState.players[player].status === PlayerStatus.Picking) continue;
		gameState.players[player].status = PlayerStatus.Responding;

		const hand = gameState.players[player].hand;
		if (hand && hand.length < handSize) {
			const amount = handSize - hand.length;
			hand.push(...gameState.deck.splice(0, amount));
		}
	}

	gameState.lastRoundStarted = Date.now();

	updateState(gameState);
}

function checkAndReveal(gameState: GameState, updateState: (state: GameState) => void) {
	const players = Object.values(gameState.players);
	if (players.some(player => player.status === PlayerStatus.Responding)) return;

	gameState.reveal = true;
	gameState.revealOrder = Object.entries(gameState.players)
		.filter(([_, player]) => player.status !== PlayerStatus.Disconnected)
		.map(([token]) => token);
	shuffle(gameState.revealOrder);
	updateState(gameState);
}

export function handleMessage(
	message: ClientMessage,
	sendResponse: (response: ServerMessage) => void,
	gameState: GameState,
	playerToken: string,
	updateState: (state: GameState) => void
) {
	switch (message.type) {
		case "join": {
			gameState.players[playerToken] = {
				points: 0,
				status: PlayerStatus.Waiting,
				username: message.username
			};
			updateState(gameState);
			break;
		}
		case "start": {
			if (gameState.host !== playerToken) {
				sendResponse({ type: "error", message: "only host can start" });
				return;
			}
			if (gameState.roundNumber !== 0) return;
			shuffle(gameState.deck);

			nextRound(gameState, updateState);
			break;
		}
		case "response": {
			if (gameState.roundNumber === 0) return;
			if (gameState.responses[playerToken]) return;
			if (gameState.players[playerToken].status !== PlayerStatus.Responding) return;

			gameState.responses[playerToken] = [message.response];
			gameState.players[playerToken].status = PlayerStatus.Finished;
			updateState(gameState);
			checkAndReveal(gameState, updateState);
			break;
		}
		case "pick": {
			if (gameState.roundNumber === 0) return;
			if (gameState.players[playerToken].status !== PlayerStatus.Picking) return;
			if (!gameState.responses[message.picked]) return;
			if (!gameState.reveal) return;

			gameState.players[message.picked].points++;
			gameState.players[playerToken].status = PlayerStatus.Finished;
			updateState(gameState);
			
			enqueue({
				type: "nextRound",
				gameId: playerToken,
				ifNotChangedSince: Date.now()
			}, roundEndDelay);
			break;
		}
	}
}

export function handleQueuedMessage(
	message: QueuedMessage,
	gameState: GameState,
	updateState: (state: GameState) => void
) {
	switch (message.type) {
		case "nextRound": {
			if ((gameState.lastRoundStarted ?? 0) > message.ifNotChangedSince) return;
			nextRound(gameState, updateState);
			break;
		}
	}
}