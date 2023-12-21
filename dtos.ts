import { GameState } from "./gameServer.ts";

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