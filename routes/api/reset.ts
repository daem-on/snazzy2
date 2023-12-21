import { HandlerContext } from "$fresh/server.ts";

const db = await Deno.openKv();

export const handler = async (_req: Request, _ctx: HandlerContext) => {
	const list = await db.list({ prefix: ["game"] });
	for await (const entry of list) {
		await db.delete(entry.key);
	}
	return new Response("ok");
}