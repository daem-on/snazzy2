import { ClientMessage, GameState, Player, PlayerStatus, QueuedMessage, ServerMessage } from "./dtos.ts";
import { enqueue } from "./queue.ts";

const handSize = 7;
const roundEndDelay = 5000;

export function initState(playerToken: string, deckSize: number): GameState {
	return {
		players: {},
		roundNumber: 0,
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
	const tokens = Object.keys(gameState.players);

	gameState.roundNumber++;
	console.log("starting round", gameState.roundNumber);
	gameState.reveal = undefined;
	gameState.call = Math.floor(Math.random() * 10);
	gameState.responses = {};
	gameState.lastWinner = undefined;

	const czar = Object.entries(gameState.players).find(([_, player]) => player.status === PlayerStatus.Picking);

	for (const player of Object.values(gameState.players))
		if (player.status === PlayerStatus.Picking) player.status = PlayerStatus.Finished;

	const czarIndex = gameState.connected.indexOf(czar?.[0] ?? "");
	const newIndex = (czarIndex + 1) % gameState.connected.length;
	gameState.players[gameState.connected[newIndex]].status = PlayerStatus.Picking;

	for (const token of tokens) {
		const player = gameState.players[token];
		if (player.status === PlayerStatus.Disconnected
			|| player.status === PlayerStatus.Picking) continue;
		player.status = PlayerStatus.Responding;
		dealHand(player, gameState);
	}

	gameState.lastRoundStarted = Date.now();

	updateState(gameState);
}

function dealHand(player: Player, gameState: GameState) {
	if (!player.hand) player.hand = [];
	if (player.hand.length < handSize) {
		const amount = handSize - player.hand.length;
		player.hand.push(...gameState.deck.splice(0, amount));
	}
}

function checkAndReveal(gameState: GameState, updateState: (state: GameState) => void) {
	const players = Object.values(gameState.players);
	if (players.some(player => player.status === PlayerStatus.Responding)) return;

	gameState.reveal = Object.keys(gameState.responses);
	shuffle(gameState.reveal);
	updateState(gameState);
}

export function handleMessage(
	message: ClientMessage,
	sendResponse: (response: ServerMessage) => void,
	gameState: GameState,
	playerToken: string,
	updateState: (state: GameState) => void,
	gameId: string,
) {
	switch (message.type) {
		case "join": {
			handleJoin(message.username, gameState, playerToken, updateState);
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
			gameState.lastWinner = message.picked;
			updateState(gameState);
			
			console.log("enqueued next round")
			enqueue({
				type: "nextRound",
				gameId,
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

function handleJoin(
	username: string,
	gameState: GameState,
	playerToken: string,
	updateState: (state: GameState) => void,
) {
	if (gameState.players[playerToken]?.status === PlayerStatus.Disconnected) {
		gameState.players[playerToken].status = PlayerStatus.Waiting;
		updateState(gameState);
	} else if (!gameState.players[playerToken]) {
		gameState.players[playerToken] = {
			points: 0,
			status: PlayerStatus.Waiting,
			username
		};
		updateState(gameState);
	}
}

export function handleLeave(
	gameState: GameState,
	playerToken: string,
	updateState: (state: GameState) => void,
) {
	if (!gameState.players[playerToken]) return;
	if (gameState.players[playerToken].status === PlayerStatus.Disconnected) return;

	const tokens = Object.keys(gameState.players);
	if (tokens.length === 0) return;

	if (gameState.host === playerToken) {
		gameState.host = tokens[0];
	}
	if (gameState.players[playerToken].status === PlayerStatus.Picking) {
		gameState.players[gameState.host].status = PlayerStatus.Picking;
		gameState.responses[gameState.host] = [];
	}

	gameState.players[playerToken].status = PlayerStatus.Disconnected;

	checkAndReveal(gameState, updateState);

	updateState(gameState);
}