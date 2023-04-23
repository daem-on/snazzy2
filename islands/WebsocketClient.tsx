import { StateUpdater, useState } from "preact/hooks";
import { Button } from "../components/Button.tsx";

enum ClientState {
	CONNECTING,
	CONNECTED,
	DISCONNECTED,
}

const isServerSide = typeof location === "undefined";
let ws: WebSocket | undefined;
let id: string | undefined;

function connect(setState: StateUpdater<ClientState>) {
	console.log("connecting");

	const url = new URL(location.href);
	url.protocol = url.protocol.replace("http", "ws");
	url.pathname = "/api/websocket";

	id = crypto.randomUUID();
	ws = new WebSocket(url);
	ws.onopen = () => {
		console.log("connected");
		setState(ClientState.CONNECTED);
	}
	ws.onmessage = (event) => {
		console.log("message", event.data);
	}
	ws.onclose = ev => {
		console.log("disconnected", ev.code, ev.reason);
		setState(ClientState.DISCONNECTED);
		ws = undefined;
	}
}

function send(message: string) {
	if (ws !== undefined) ws.send(`${id}: ${message}`);
}

function send2() {
	if (ws !== undefined) ws.send(new Uint8Array([1, 2, 3]));
}

export default function WebsocketClient() {
	const [state, setState] = useState(ClientState.CONNECTING);
	if (!isServerSide && state === ClientState.CONNECTING) connect(setState);
	return (
		<div class="flex gap-2 w-full">
			<p class="flex-grow-1 font-bold text-xl">{ClientState[state]}</p>
			<input type="text" />
			<Button onClick={() => send2()}>Send</Button>
		</div>
	);
}
