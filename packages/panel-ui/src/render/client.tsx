import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { Appshell } from "../Appshell.tsx";

const rootElement = document.getElementById("root");
if (!rootElement) {
	console.warn("No #root element found");
} else {
	createRoot(rootElement).render(
		<StrictMode>
			<Appshell />
		</StrictMode>,
	);
}
