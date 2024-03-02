import { Application, Router } from "https://deno.land/x/oak@v14.1.1/mod.ts";
import { Subject } from "https://esm.sh/rxjs@7.8.1";
import { gameHandler } from "./handlers/game.ts";
import { resetHandler } from "./handlers/reset.ts";

export const appShutdown = new Subject<void>();

globalThis.addEventListener("beforeunload", () => {
	console.log("beforeunload")
	appShutdown.next();
});

Deno.addSignalListener("SIGINT", () => {
	console.log("SIGINT")
	appShutdown.next();
	Deno.exit();
});

const router = new Router();
router
	.get("/api/games/:id", (context) => {
		const socket = context.upgrade();
		const url = context.request.url;
		gameHandler(url, socket, context.params.id);
	})
	.get("/api/reset", (context) => {
		context.response.body = "ok";
		return resetHandler();
	})
	.get("/error", () => {
		throw new Error("test error");
	});

const app = new Application();

app.use(async (ctx, next) => {
	try {
		await next();
	} catch (e) {
		console.error("Error in request", ctx.request.url.href, e);
		ctx.response.status = 500;
	}
});

app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8000 });
