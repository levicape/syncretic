// import { clsx } from "clsx";
// import { Suspense, use, useCallback, useMemo, useState } from "react";
// import { useOidcClient } from "../../atoms/authentication/OidcClientAtom";
// import { SuspenseGuard } from "../../ui/ClientSuspense";
// import { DesignSystem } from "../../ui/DesignSystem";
// import { Button } from "../../ui/daisy/action/Button";
// import { Stat, Stats } from "../../ui/daisy/data/Stat";
// const { Fallback } = DesignSystem;

// const ExpensiveComponent = ({ wait }: { wait: Promise<unknown> }) => {
// 	SuspenseGuard();

// 	const [count, setCount] = useState(0);

// 	use(wait);
// 	const increment = useCallback(() => {
// 		setCount((current) => current + 1);
// 	}, []);
// 	const resetState = useCallback(() => {
// 		setCount(0);
// 	}, []);

// 	return (
// 		<>
// 			<header>
// 				<h3
// 					className={clsx(
// 						"font-bold",
// 						"text-lg",
// 						"mb-2",
// 						"flex",
// 						"justify-center",
// 					)}
// 				>
// 					<span>The time has come to...</span>
// 				</h3>
// 			</header>
// 			<object className={clsx("flex", "justify-end", "gap-2", "mt-2")}>
// 				<Button wide color={"primary"} onClick={increment}>
// 					PUSH THE BUTTON
// 				</Button>
// 			</object>
// 			<Stats>
// 				<Stat
// 					title={<>Times clicked</>}
// 					actions={
// 						<Button
// 							color={"secondary"}
// 							variant={"outline"}
// 							onClick={resetState}
// 						>
// 							Reset
// 						</Button>
// 					}
// 				>
// 					{String(count)}
// 				</Stat>
// 			</Stats>
// 		</>
// 	);
// };

// export const App = () => {
// 	const [_, user] = useOidcClient();
// 	const wait = useMemo(
// 		() =>
// 			new Promise((resolve) => {
// 				setTimeout(resolve, 300);
// 			}),
// 		[],
// 	);

// 	return (
// 		<>
// 			{user ? (
// 				<div className={clsx("join join-vertical gap-4")}>
// 					<h2
// 						className={clsx("text-xl", "join-item", "flex", "justify-center")}
// 					>
// 						{`Welcome, ${JSON.stringify(user.profile["cognito:username"] ?? user.profile.sub)}`}
// 					</h2>
// 					<Suspense fallback={<Fallback />}>
// 						<>
// 							<section
// 								className={clsx(
// 									"card join-item p-2 bg-ironstone-300 border-8 rounded-lg",
// 								)}
// 							>
// 								<ExpensiveComponent wait={wait} />
// 							</section>
// 							<section className={clsx("card join-item p-8 border-2")}>
// 								<h2
// 									className={clsx(
// 										"text-xl",
// 										"join-item",
// 										"flex",
// 										"justify-center",
// 									)}
// 								>
// 									{`Welcome, ${JSON.stringify(user.profile["cognito:username"] ?? user.profile.sub)}`}
// 								</h2>

// 								<Button
// 									className={"join-item"}
// 									color={"error"}
// 									href={"/~oidc/close"}
// 									renderAs={"a"}
// 									block
// 								>
// 									Logout
// 								</Button>
// 							</section>
// 						</>
// 					</Suspense>
// 				</div>
// 			) : (
// 				<div className={"card border-primary"}>
// 					<Button
// 						color={"primary"}
// 						href={"/~oidc/authorize"}
// 						renderAs={"a"}
// 						wide
// 					>
// 						Login
// 					</Button>
// 				</div>
// 			)}
// 		</>
// 	);
// };
