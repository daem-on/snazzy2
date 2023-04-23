import { GameState } from "./gameServer.ts";

type Join = {
	type: "join";
	id: string;
	username: string;
}

type Leave = {
	type: "leave";
	id: string;
}

type RequestState = {
	type: "request-state";
	fromId: string;
}

type OfferState = {
	type: "offer-state";
	id: string;
}

type SendState = {
	type: "send-state";
	id: string;
	state: GameState;
}

export type GameMessage = Join | Leave | RequestState | OfferState | SendState;