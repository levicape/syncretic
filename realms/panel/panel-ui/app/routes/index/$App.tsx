import { clsx } from "clsx";
import { useAtom } from "jotai/react";
import { useResetAtom } from "jotai/utils";
import { Suspense, use, useCallback, useMemo, useState } from "react";
import { AuthenticationAtom } from "../../atoms/authentication/OauthClientAtom";
import { SuspenseGuard } from "../../ui/ClientSuspense";
import { DesignSystem } from "../../ui/DesignSystem";
import { Button } from "../../ui/daisy/action/Button";
import { Stat, Stats } from "../../ui/daisy/data/Stat";
const { Fallback } = DesignSystem;

const ExpensiveComponent = ({ wait }: { wait: Promise<unknown> }) => {
	SuspenseGuard();

	const [count, setCount] = useState(0);

	use(wait);
	const [a, setA] = useAtom(AuthenticationAtom);
	const reset = useResetAtom(AuthenticationAtom);
	const increment = useCallback(() => {
		setCount((current) => current + 1);
		setA((current) => current + 1);
	}, [setA]);
	const resetState = useCallback(() => {
		setCount(0);
	}, []);

	return (
		<>
			<header>
				<h3
					className={clsx(
						"font-bold",
						"text-lg",
						"mb-2",
						"flex",
						"justify-center",
					)}
				>
					<span>The time has come to...</span>
				</h3>
			</header>
			<object className={clsx("flex", "justify-end", "gap-2", "mt-2")}>
				<Button wide color={"primary"} onClick={increment}>
					PUSH THE BUTTON
				</Button>
			</object>
			<Stats>
				<Stat
					title={<>Total clicks</>}
					actions={
						<Button color={"secondary"} onClick={reset} variant={"soft"}>
							Reset
						</Button>
					}
				>
					{String(a)}
				</Stat>
				<Stat
					title={<>Times clicked</>}
					actions={
						<Button color={"secondary"} variant={"soft"} onClick={resetState}>
							Reset
						</Button>
					}
				>
					{String(count)}
				</Stat>
			</Stats>
		</>
	);
};

export const App = () => {
	const wait = useMemo(
		() =>
			new Promise((resolve) => {
				setTimeout(resolve, 300);
			}),
		[],
	);

	return (
		<article className={clsx("hero-content")}>
			<div className={clsx("join join-vertical gap-4")}>
				<h2 className={clsx("text-xl", "join-item", "flex", "justify-center")}>
					World
				</h2>
				<Suspense fallback={<Fallback />}>
					<section
						className={clsx(
							"card join-item p-2 bg-ironstone-300 border-8 rounded-lg",
						)}
					>
						<ExpensiveComponent wait={wait} />
					</section>
				</Suspense>
			</div>
		</article>
	);
};
