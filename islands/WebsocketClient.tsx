import { signal } from "@preact/signals";
import { useState } from "preact/hooks";
import { Button } from "../components/Button.tsx";
import { ClientMessage, GameStateSlice, PlayerStatus, ServerMessage } from "../dtos.ts";

enum ConnectionStatus {
	CONNECTING,
	CONNECTED,
	DISCONNECTED,
}

const isServerSide = typeof location === "undefined";
let ws: WebSocket | undefined;

const status = signal<ConnectionStatus>(ConnectionStatus.CONNECTING);
const state = signal<GameStateSlice | undefined>(undefined);
const clientId = signal<string | undefined>(undefined);

function connect(gameId: string) {
	console.log("connecting");

	const url = new URL(location.href);
	url.protocol = url.protocol.replace("http", "ws");
	url.pathname = `/api/games/${gameId}`;

	ws = new WebSocket(url);
	ws.onopen = () => {
		console.log("connected");
		status.value = ConnectionStatus.CONNECTED;

		sendUsername("test");
	}
	ws.onmessage = (event) => {
		console.log("message", event.data);
		const message = JSON.parse(event.data) as ServerMessage;
		if (message.type === "state") {
			state.value = message.state;
		} else if (message.type === "init") {
			clientId.value = message.id;
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

async function reset() {
	const resp = await fetch("/api/reset");
	if (resp.ok) console.log("reset");
	else console.error("failed to reset");
}

function playCard(card: number) {
	send({ type: "response", response: [card] });
}

function pickCard(index: number) {
	send({ type: "pick", pickedIndex: index });
}

function Code({ children }: { children: string }) {
	return <code class="bg-gray-100 px-2 rounded-lg whitespace-pre-wrap overflow-x-auto">{children}</code>;
}

function Card(props: { children: string, onClick?: () => void }) {
	return <button class="border-2 border-gray-300 rounded-lg px-4 py-2 mt-2 focus:outline-none focus:border-blue-500" onClick={props.onClick}>{props.children}</button>;
}

export default function WebsocketClient(props: { gameId: string }) {
	if (!isServerSide && status.value === ConnectionStatus.CONNECTING) connect(props.gameId);

	const [inputState, setInputState] = useState("");
	return (
		<div class="flex flex-col gap-4">
			<p class="font-bold text-xl">{ConnectionStatus[status.value]}</p>

			<input class="w-full border-2 border-gray-300 rounded-lg px-4 py-2 mt-2 focus:outline-none focus:border-blue-500" type="text" placeholder="Username" value={inputState} onInput={v => setInputState(v.currentTarget.value)} />
			<Button onClick={() => sendUsername(inputState)}>Set username</Button>
			<Button onClick={() => send({ type: "start" })}>Start</Button>

			<Button onClick={() => reset()}>Reset</Button>

			<p class="font-bold text-xl">Client id: {clientId.value}</p>
			{ state.value?.isHost && <p class="font-bold text-xl">You are the host</p> }

			{ state.value?.status === PlayerStatus.Picking && <p class="font-bold text-xl">You are the Card Czar.</p> }

			{
				state.value?.hand && (
					<div class="flex gap-2">
						{ state.value.hand.map((card, i) => <Card key={i} onClick={() => playCard(card)}>{card.toString()}</Card>) }
					</div>
				)
			}

			<div id="responses" class="flex gap-2">
				{
					state.value && state.value.revealedResponses?.map((cards, i) => (
						<Card key={i} onClick={() => pickCard(i)}>{cards.join(", ")}</Card>
					))
				}
			</div>

			<h2 class="text-lg font-bold">Full State</h2>
			<Code>{JSON.stringify(state.value ?? "initial", null, 2)}</Code>
		</div>
	);
}
