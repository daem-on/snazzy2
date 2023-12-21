import { Head } from "$fresh/runtime.ts";
import { PageProps } from "$fresh/server.ts";
import WebsocketClient from "../../islands/WebsocketClient.tsx";

export default function Home(props: PageProps) {
	return (
	  <>
		<Head>
		  <title>Fresh App</title>
		</Head>
		<div class="p-4 mx-auto max-w-screen-md">
		  <WebsocketClient gameId={props.params.id} />
		</div>
	  </>
	);
  }