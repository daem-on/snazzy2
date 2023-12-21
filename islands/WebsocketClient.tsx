import { signal } from "@preact/signals";
import { useState } from "preact/hooks";
import { Button } from "../components/Button.tsx";
import { ClientMessage, ServerMessage } from "../dtos.ts";
import { GameState } from "../gameServer.ts";

enum ConnectionStatus {
	CONNECTING,
	CONNECTED,
	DISCONNECTED,
}

const isServerSide = typeof location === "undefined";
let ws: WebSocket | undefined;

const status = signal<ConnectionStatus>(ConnectionStatus.CONNECTING);
const state = signal<GameState | undefined>(undefined);
const clientToken = signal<string | undefined>(undefined);

function connect() {
	console.log("connecting");

	const url = new URL(location.href);
	url.protocol = url.protocol.replace("http", "ws");
	url.pathname = `/api/games/2`;

	ws = new WebSocket(url);
	ws.onopen = () => {
		console.log("connected");
		status.value = ConnectionStatus.CONNECTED;
	}
	ws.onmessage = (event) => {
		console.log("message", event.data);
		const message = JSON.parse(event.data) as ServerMessage;
		if (message.type === "state") {
			state.value = message.state;
		} else if (message.type === "init") {
			clientToken.value = message.token;
		}
	}
	ws.onclose = ev => {
		console.log("disconnected", ev.code, ev.reason);
		status.value = ConnectionStatus.DISCONNECTED;
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
	if (!isServerSide && status.value === ConnectionStatus.CONNECTING) connect();
	const playerInfo = state.value?.players[clientToken.value ?? ""];

	const [inputState, setInputState] = useState("");
	return (
		<div class="flex flex-col gap-4">
			<p class="font-bold text-xl">{ConnectionStatus[status.value]}</p>

			<input class="w-full border-2 border-gray-300 rounded-lg px-4 py-2 mt-2 focus:outline-none focus:border-blue-500" type="text" value={inputState} onInput={v => setInputState(v.currentTarget.value)} />
			<Button onClick={() => sendUsername(inputState)}>Send</Button>
			<Button onClick={() => send({ type: "start" })}>Start</Button>

			<p class="font-bold text-xl">Client token: {clientToken.value}</p>

			{
				playerInfo && (
					<div>
						<p class="font-bold text-xl">Player info</p>
						<pre class="
							w-full
							border-2 border-gray-300
							rounded-lg
							px-4 py-2
							mt-2
							whitespace-pre-wrap
							overflow-auto
						">{JSON.stringify(playerInfo, null, 2)}</pre>
					</div>
				)
			}

			<div id="responses">
				{
					state.value && Object.values(state.value.responses).map((response, i) => (
						<div key={i}>{response.join(", ")}</div>
					))
				}
			</div>

			<h2 class="text-lg font-bold">Full State</h2>
			<pre class="
				w-full
				border-2 border-gray-300
				rounded-lg
				px-4 py-2
				mt-2
				whitespace-pre-wrap
				overflow-auto
			">{JSON.stringify(state.value ?? "initial", null, 2)}</pre>
		</div>
	);
}
