import { signal } from "@preact/signals";
import { useState } from "preact/hooks";
import { Button } from "../components/Button.tsx";
import { ClientMessage, DeckSource, GameStateSlice, PlayerStatus, ServerMessage } from "../dtos.ts";

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
const deck = signal<DeckSource | undefined>(undefined);

async function fetchDeck(url: string) {
	const resp = await fetch(url);
	if (resp.ok)
		deck.value = await resp.json() as DeckSource;
	else
		console.error("failed to fetch deck", resp.status, resp.statusText);
}

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
			fetchDeck(message.deckUrl);
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

function BlackCard(props: { children: number }) {
	if (!deck.value) return <p>loading...</p>;
	const text = deck.value.calls[props.children].join(" ____ ");
	return <p class="font-bold text-xl bg-black text-white px-4">{text}</p>;
}

function WhiteCard(props: { children: number, onClick?: () => void }) {
	if (!deck.value) return <p>loading...</p>;
	const text = deck.value.responses[props.children][0];
	return <button class="border-2 border-gray-300 rounded-lg px-4 py-2 mt-2 focus:outline-none focus:border-blue-500" onClick={props.onClick}>{text}</button>;
}

function ResponseCard(props: { call: number, responses: number[], onClick?: () => void }) {
	if (!deck.value) return <p>loading...</p>;
	const text = deck.value.calls[props.call].map((part, i) => {
		const responseIndex = props.responses[i];
		if (responseIndex === undefined) return part;
		const response = deck.value!.responses[responseIndex][0];
		return part + response;
	}).join("");
	return <button class="border-2 border-gray-300 rounded-lg px-4 py-2 mt-2 focus:outline-none focus:border-blue-500" onClick={props.onClick}>{text}</button>;
}

export default function TestClient(props: { gameId: string }) {
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

			{ state.value?.call && <BlackCard>{state.value.call}</BlackCard> }

			{
				state.value?.hand && (
					<div class="flex gap-2">
						{ state.value.hand.map((card, i) => <WhiteCard key={i} onClick={() => playCard(card)}>{card}</WhiteCard>) }
					</div>
				)
			}

			<div id="responses" class="flex gap-2">
				{
					state.value && state.value.call && state.value.revealedResponses?.map((cards, i) => (
						<ResponseCard key={i} onClick={() => pickCard(i)} call={state.value!.call!} responses={cards}></ResponseCard>
					))
				}
			</div>

			<h2 class="text-lg font-bold">Full State</h2>
			<Code>{JSON.stringify(state.value ?? "initial", null, 2)}</Code>
		</div>
	);
}
