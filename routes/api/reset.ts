import { HandlerContext } from "$fresh/server.ts";

const db = await Deno.openKv();

export const handler = async (_req: Request, _ctx: HandlerContext) => {
	const games = db.list({ prefix: ["game"] });
	for await (const entry of games) {
		await db.delete(entry.key);
	}
	const decks = db.list({ prefix: ["deck"] });
	for await (const entry of decks) {
		await db.delete(entry.key);
	}
	const defs = db.list({ prefix: ["def"] });
	for await (const entry of defs) {
		await db.delete(entry.key);
	}
	return new Response("ok");
}