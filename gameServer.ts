type Card = {
	ids: number[];
}

type Player = {
	username: string;
	points: number;
	status: string;
}

export type GameState = {
	players: Record<string, Player>;
	roundNumber: number;
	reveal: boolean;
	call?: Card;
	responses: Record<string, Card>;
	tokens: string[];
	host: string;
}
