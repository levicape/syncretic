// import type { MagmapHonoApp } from "@levicape/spork-magmap-io/http/HonoApp";
import clsx from "clsx";
import { Suspense, useCallback, useState } from "react";
import {
	Route,
	RouterProvider,
	createMemoryRouter,
	createRoutesFromElements,
	useLoaderData,
} from "react-router";
import { SuspenseGuard } from "../../ui/ClientSuspense";
import { DesignSystem } from "../../ui/DesignSystem";

// const Magmap = hc<MagmapHonoApp>("");
const GetMagmapAtlasfile = async () => {
	await new Promise((resolve) => setTimeout(resolve, 3000));
	const atlasfiles = await Promise.resolve({
		status: 200,
		statusText: "OK",
		json: () => Promise.resolve({}),
	});
	const response =
		atlasfiles.status < 500
			? await atlasfiles.json()
			: {
					error: {
						message: `Error fetching liveness for route ${atlasfiles.status}: ${atlasfiles.statusText}`,
						code: "RouteNotFound",
					},
				};
	console.log({
		MagmapRoutemap: {
			atlasfiles,
			response,
		},
	});

	return response;
};

const instance = createMemoryRouter(
	createRoutesFromElements(
		<Route
			index
			loader={
				typeof window !== "undefined" ? GetMagmapAtlasfile : SuspenseGuard
			}
			Component={() => {
				const { data } = (useLoaderData() as { data: unknown }) ?? {};
				const [count, setCount] = useState(0);
				const increment = useCallback(
					() => setCount((current) => current + 1),
					[],
				);

				return (
					<>
						<header>
							<h3>AtlasRoutes</h3>
						</header>
						<pre className="overflow-x-auto">
							{JSON.stringify(data ?? {}, null, 2)}
						</pre>
						<footer className="pt-4 pb-2">
							<button
								className="btn btn-wide btn-primary"
								type={"button"}
								onClick={increment}
							>
								count is {count}
							</button>
						</footer>
					</>
				);
			}}
			ErrorBoundary={() => {
				return (
					<div className="alert alert-error" role="alert">
						<data className="font-bold">Error!</data>
						<span className="block sm:inline"> Something went wrong!</span>
					</div>
				);
			}}
			hydrateFallbackElement={
				<div className={clsx("skeleton", "h-32", "w-32")} />
			}
		/>,
	),
);

// type _ReactRouter_ = typeof import("react-router-dom");
// const ReactRouter = import("react-router-dom");
// const importReactRouter = async () => {
// 	let createMemoryRouter: _ReactRouter_["createMemoryRouter"];
// 	let RouterProvider: _ReactRouter_["RouterProvider"] | FC = () => <></>;

// 	let __module__: Awaited<typeof ReactRouter> | undefined;
// 	let withReactRouter: () => {
// 		__module__: Awaited<typeof ReactRouter> | undefined;
// 		instance: ReturnType<typeof createMemoryRouter> | undefined;
// 		ClientRenderedRouter: FC;
// 	} = () => ({
// 		__module__: undefined,
// 		instance: undefined,
// 		ClientRenderedRouter: () => <></>,
// 	});

// 	if (!isNode) {
// 		__module__ = await ReactRouter;
// 		const { createRoutesFromElements, Route, useLoaderData } = __module__;
// 		createMemoryRouter = __module__.createMemoryRouter;
// 		RouterProvider = __module__.RouterProvider;

// 		withReactRouter = () => {
// 			const instance = createMemoryRouter(
// 				createRoutesFromElements(
// 					<Route
// 						index
// 						hydrateFallbackElement={
// 							<div className={clsx("skeleton", "h-32", "w-32")} />
// 						}
// 						Component={() => {
// 							const { data } = (useLoaderData() as { data: unknown }) ?? {};
// 							const [count, setCount] = useState(0);
// 							const increment = useCallback(
// 								() => setCount((current) => current + 1),
// 								[],
// 							);

// 							return (
// 								<>
// 									<header>
// 										<h3>AtlasRoutes</h3>
// 									</header>
// 									<pre className="overflow-x-auto">
// 										{JSON.stringify(data ?? {}, null, 2)}
// 									</pre>
// 									<footer className="pt-4 pb-2">
// 										<button
// 											className="btn btn-wide btn-primary"
// 											type={"button"}
// 											onClick={increment}
// 										>
// 											count is {count}
// 										</button>
// 									</footer>
// 								</>
// 							);
// 						}}
// 						ErrorBoundary={() => {
// 							return (
// 								<div className="alert alert-error" role="alert">
// 									<data className="font-bold">Error!</data>
// 									<span className="block sm:inline">
// 										{" "}
// 										Something went wrong!
// 									</span>
// 								</div>
// 							);
// 						}}
// 						loader={GetMagmapAtlasfile}
// 					/>,
// 				),
// 			);

// 			const ClientRenderedRouter: FC = () => {
// 				SuspenseGuard();
// 				return <RouterProvider router={instance} />;
// 			};

// 			return {
// 				__module__,
// 				instance,
// 				ClientRenderedRouter,
// 			};
// 		};
// 	}

// 	return {
// 		__module__,
// 		withReactRouter,
// 	};
// };

// const ClientRenderedRouter = lazy(() =>
// 	importReactRouter().then(({ withReactRouter }) => {
// 		return {
// 			default: withReactRouter().ClientRenderedRouter,
// 		};
// 	}),
// );

export const MagmapAtlas = () => (
	<Suspense fallback={<DesignSystem.Fallback />}>
		<section className="card join-item p-2 bg-ironstone-300 border-8 rounded-lg">
			<RouterProvider router={instance} />
		</section>
	</Suspense>
);
