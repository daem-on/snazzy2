import { HandlerContext } from "$fresh/server.ts";

const db = await Deno.openKv();

export const handler = (_req: Request, _ctx: HandlerContext): Response => {
	db.delete(["games"]);
	return new Response("ok");
}