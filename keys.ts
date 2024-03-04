export const getGameKey = (gameId: string) => ["game", gameId];
export const getDeckKey = (gameId: string) => ["deck", gameId];
export const getDefKey = (gameId: string) => ["def", gameId];

export const getKeys = (gameId: string) => ({
	gameKey: getGameKey(gameId),
	deckKey: getDeckKey(gameId),
	defKey: getDefKey(gameId),
});