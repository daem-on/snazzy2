import { StateUpdater, useState } from "preact/hooks";
import { Button } from "../components/Button.tsx";

enum ClientState {
	CONNECTING,
	CONNECTED,
	DISCONNECTED,
}

const isServerSide = typeof location === "undefined";
let ws: WebSocket | undefined;

function connect(setState: StateUpdater<ClientState>) {
	console.log("connecting");
	const url = new URL(location.href);
	url.protocol = url.protocol.replace("http", "ws");
	url.pathname = "/api/websocket";

	ws = new WebSocket(url);
	ws.onopen = () => {
		console.log("connected");
		setState(ClientState.CONNECTED);
	}
	ws.onmessage = (event) => {
		console.log("message", event.data);
	}
	ws.onclose = () => {
		console.log("disconnected");
		setState(ClientState.DISCONNECTED);
		ws = undefined;
	}
}

function send(message: string) {
	if (ws !== undefined) ws.send(message);
}

export default function WebsocketClient() {
	const [state, setState] = useState(ClientState.CONNECTING);
	if (!isServerSide && state === ClientState.CONNECTING) connect(setState);
	return (
		<div class="flex gap-2 w-full">
			<p class="flex-grow-1 font-bold text-xl">{ClientState[state]}</p>
			<input type="text" />
			<Button onClick={() => send("ping")}>Send</Button>
		</div>
	);
}
