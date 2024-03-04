export type ServerMessage = {
	type: "init";
	id: string;
	token: string;
	deckUrl: string;
} | {
	type: "state";
	state: GameStateSlice;
} | {
	type: "error";
	message: string;
};

export type ClientMessage = {
	type: "join";
	username: string;
} | {
	type: "start";
} | {
	type: "response";
	response: number[];
} | {
	type: "pick";
	pickedIndex: number;
};

export type QueuedMessage = {
	type: "nextRound";
	gameId: string;
	ifNotChangedSince: number;
}

type Card = number;
type PlayerId = string;

export enum PlayerStatus {
	Waiting,
	Responding,
	Picking,
	Finished,
	Disconnected
}

export type Player = {
	username: string;
	points: number;
	status: PlayerStatus;
	hand?: Card[];
};

export type GameDefinition = {
	handSize: number;
	deck: DeckDefinition;
}

export type DeckDefinition = {
	calls: number;
	responses: number;
	callLengths: number[];
	url: string;
}

export type DeckSource = {
	calls: string[][];
	responses: string[][];
}

export type DeckState = {
	calls: Card[];
	responses: Card[];
}

export type GameState = {
	players: Record<PlayerId, Player>;
	tokens: Record<PlayerId, string>;
	roundNumber: number;
	call?: Card;
	responses: Record<PlayerId, Card[]>;
	reveal?: PlayerId[];
	lastWinner?: PlayerId;
	connected: PlayerId[];
	host: PlayerId;
	lastRoundStarted?: number;
};

export type GameStateSlice = {
	players: Omit<Player, "hand">[];
	roundNumber: number;
	call?: Card;
	revealedResponses?: Card[][];
	connected: PlayerId[];
	lastWinner?: {
		id: PlayerId;
		username: string;
		revealIndex: number;
	};
	isHost: boolean;
	hand?: Card[];
	status?: PlayerStatus;
}