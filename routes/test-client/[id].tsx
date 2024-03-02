import { Head } from "$fresh/runtime.ts";
import { PageProps } from "$fresh/server.ts";
import TestClient from "../../islands/TestClient.tsx";

export default function Home(props: PageProps) {
	return (
	  <>
		<Head>
		  <title>Fresh App</title>
		</Head>
		<div class="p-4 mx-auto max-w-screen-md">
		  <TestClient gameId={props.params.id} />
		</div>
	  </>
	);
  }