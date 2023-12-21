import { signal } from "@preact/signals";
import { useState } from "preact/hooks";
import { Button } from "../components/Button.tsx";
import { ClientMessage } from "../dtos.ts";

enum ConnectionStatus {
	CONNECTING,
	CONNECTED,
	DISCONNECTED,
}

type ClientState = [ConnectionStatus, string];

const isServerSide = typeof location === "undefined";
let ws: WebSocket | undefined;
let id: string | undefined;

const state = signal<ClientState>([ConnectionStatus.CONNECTING, "initial"]);

function connect() {
	console.log("connecting");

	const url = new URL(location.href);
	url.protocol = url.protocol.replace("http", "ws");
	url.pathname = `/api/games/2`;

	id = crypto.randomUUID();
	ws = new WebSocket(url);
	ws.onopen = () => {
		console.log("connected");
		state.value[0] = ConnectionStatus.CONNECTED;


	}
	ws.onmessage = (event) => {
		console.log("message", event.data);
		state.value = [state.value[0], event.data];
	}
	ws.onclose = ev => {
		console.log("disconnected", ev.code, ev.reason);
		state.value[0] = ConnectionStatus.DISCONNECTED;
		ws = undefined;
	}
}

function send(message: ClientMessage) {
	if (ws !== undefined) ws.send(JSON.stringify(message));
}

function sendUsername(name: string) {
	send({ type: "join", username: name });
}

export default function WebsocketClient() {
	if (!isServerSide && state.value[0] === ConnectionStatus.CONNECTING) connect();
	const value = state.value;

	const [inputState, setInputState] = useState("");
	return (
		<div class="flex flex-col gap-4">
			<p class="font-bold text-xl">{ConnectionStatus[value[0]]}</p>
			<pre class="
				w-full
				border-2 border-gray-300
				rounded-lg
				px-4 py-2
				mt-2
				whitespace-pre-wrap
				overflow-auto
			">{value[1]}</pre>

			<input class="w-full border-2 border-gray-300 rounded-lg px-4 py-2 mt-2 focus:outline-none focus:border-blue-500" type="text" value={inputState} onInput={v => setInputState(v.currentTarget.value)} />
			<Button onClick={() => sendUsername(inputState)}>Send</Button>
		</div>
	);
}
