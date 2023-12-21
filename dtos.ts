import { GameState } from "./gameServer.ts";

type InitMessage = {
	type: "init";
	token: string;
}

type StateMessage = {
	type: "state";
	state: GameState;
}

export type ServerMessage = InitMessage | StateMessage;

type JoinMessage = {
	type: "join";
	username: string;
}

export type ClientMessage = JoinMessage;