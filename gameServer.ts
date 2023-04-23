import { GameMessage } from "./GameMessage.ts";

abstract class ServerState {}

type Card = {
	ids: number[];
}

type PlayedCard = Card & {
	playedBy: string;
}

type Player = {
	id: string;
	username: string;
	points: number;
	status: string;
}

export type GameState = {
	players: Player[];
	roundNumber: number;
	reveal: boolean;
	call: Card;
	responses: PlayedCard[];
}

class ConnectingState extends ServerState {}
abstract class ConnectedState extends ServerState {
	constructor(
		public readonly broadcast: (message: GameMessage) => void,
		public readonly id: string
	) { super(); }
}
class JoinedState extends ConnectedState {}
class JoinedAndRequestedState extends ConnectedState {}
class ConfiguredState extends ConnectedState {
	constructor(
		broadcast: (message: GameMessage) => void,
		id: string,
		public gameState: GameState
	) { super(broadcast, id); }
}

let state: ServerState = new ConnectingState();
let emptyTimeout: number | undefined;

export function onConnect(broadcast: (message: GameMessage) => void) {
	const id = crypto.randomUUID();
	state = new JoinedState(broadcast, id);
	broadcast({ type: "join", id: id, username: "test" });

	emptyTimeout = setTimeout(() => {
		// Timeout means that the room is empty
		initState();
	}, 500);
}

function initState() {
	if (!(state instanceof ConnectedState)) return;
	state = new ConfiguredState(state.broadcast, state.id, {
		players: [],
		roundNumber: 0,
		reveal: false,
		call: { ids: [] },
		responses: []
	});
}

export function onMessage(message: GameMessage) {
	if (state instanceof ConfiguredState) {
		switch (message.type) {
			case "join":
				state.broadcast({ type: "offer-state", id: state.id });
				state.gameState.players.push({
					id: message.id,
					username: message.username,
					points: 0,
					status: "waiting"
				});
				break;
			case "request-state":
				if (message.fromId === state.id) 
					state.broadcast({ type: "send-state", id: state.id, state: state.gameState });
				break;
			case "leave":
				state.gameState.players = state.gameState.players.filter(p => p.id !== message.id);
				break;
		}
	} else if (state instanceof JoinedState) {
		if (message.type === "offer-state") {
			state.broadcast({ type: "request-state", fromId: state.id });
			state = new JoinedAndRequestedState(state.broadcast, state.id);
			clearTimeout(emptyTimeout);
		}
	} else if (state instanceof JoinedAndRequestedState) {
		if (message.type === "send-state") {
			state = new ConfiguredState(state.broadcast, state.id, message.state);
		}
	}
}