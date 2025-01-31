import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { Appshell } from "../Appshell.tsx";

export const render = (_props: {
	url: string;
}) => {
	const html = renderToString(
		<StrictMode>
			<Appshell />
		</StrictMode>,
	);

	return { ssr: { html } };
};
