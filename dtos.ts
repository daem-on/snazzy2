export type ServerMessage = {
	type: "init";
	token: string;
} | {
	type: "state";
	state: GameState;
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
	response: number;
} | {
	type: "pick";
	picked: string;
};

export type QueuedMessage = {
	type: "nextRound";
	gameId: string;
	ifNotChangedSince: number;
}

type Card = number;

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

export type GameState = {
	players: Record<string, Player>;
	roundNumber: number;
	reveal: boolean;
	deck: Card[];
	call?: Card;
	responses: Record<string, Card[]>;
	revealOrder?: string[];
	lastWinner?: string;
	czarIndex?: number;
	connected: string[];
	host: string;
	lastRoundStarted?: number;
};