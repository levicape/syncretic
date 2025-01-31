import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import viteLogo from "/vite.svg";
import reactLogo from "./assets/react.svg";
import "./App.css";

export const App = () => {
	const [count, setCount] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies:
	const task = useMemo(
		() => Effect.sync(() => setCount((current) => current + 1)),
		[setCount],
	);

	const increment = useCallback(() => Effect.runSync(task), [task]);

	return (
		<>
			<div>
				<a href="https://vite.dev" target="_blank" rel="noreferrer">
					<img src={viteLogo} className="logo" alt="Vite logo" />
				</a>
				<a href="https://react.dev" target="_blank" rel="noreferrer">
					<img src={reactLogo} className="logo react" alt="React logo" />
				</a>
			</div>
			<h1>Vite + React</h1>
			<button type={"button"} onClick={increment}>
				count is {count}
			</button>
			<div className="card">
				<button type={"button"} onClick={() => setCount((count) => count + 1)}>
					count is {count}
				</button>
				<p>
					Edit <code>src/App.tsx</code> and save to test HMR
				</p>
			</div>
			<p className="read-the-docs">
				Click on the Vite and React logos to learn more
			</p>
		</>
	);
};
