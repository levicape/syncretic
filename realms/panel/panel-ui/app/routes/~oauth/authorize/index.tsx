import type { Context } from "hono";
import type { ReactElement } from "react";

export default async function Callback(_c: Context): Promise<ReactElement> {
	return (
		<main className="hero">
			<article className={"hero-content"}>
				<div className="join join-vertical gap-4">
					<h2 className={"join-item"}>{"Atlasfile"}</h2>
				</div>
			</article>
		</main>
	);
}

// import { AccountTokenResponse } from "$account/response/AccountTokenResponse";
// import { useDiscord } from "@/sdk/discord/DiscordProvider";
// import { useConfig } from "@/ui/data/ConfigProvider";
// import { useServices } from "@/ui/data/ServicesProvider";
// import { CanonicalBriscasName } from "@/ui/display/CanonicalBriscas";
// import {
//   LogosDiscordIcon,
//   ShieldCheckmark
// } from "@/ui/display/HeroIcons";
// import { GameIdParam } from "@/ui/routing/AppRoutes";
// import { useStoreDispatch, useStoreSelector } from "@/ui/store/ReduxProvider";
// import {
//   AuthClearAction,
//   AuthLoginAction,
// } from "@/ui/store/authentication/actions";
// import { getAuthentication } from "@/ui/store/authentication/reducer";
// import clsx from "clsx";
// import { useSearchParams } from "next/navigation";
// import { useEffect } from "react";
// import { FormattedMessage } from "react-intl";

// export default function Login() {
//   const params = useSearchParams();
//   const { instanceId, enabled: discordEnabled } = useDiscord();
//   const { ready: configReady } = useConfig();
//   const { ready: authReady, refresh } = useStoreSelector(getAuthentication);
//   const { account, router } = useServices();
//   const dispatch = useStoreDispatch();

//   useEffect(() => {
//     if (!discordEnabled) {
//       if (configReady && authReady === false) {
//         account
//           .loginAnonymous(refresh ?? undefined)
//           .then((response: AccountTokenResponse) => {
//             dispatch(AuthLoginAction(response));
//           })
//           .catch((e) => {
//             const { code, reason } = e;
//             if (
//               code === "PROFILE_NOT_FOUND" ||
//               (reason && reason.includes("JsonWebTokenError"))
//             ) {
//               dispatch(AuthClearAction());
//             } else {
//               throw e;
//             }
//           });
//       }
//     }
//   }, [authReady, configReady, account, refresh, dispatch, discordEnabled]);

//   useEffect(() => {
//     if (discordEnabled && authReady === true) {
//       setTimeout(() => {
//         router.push(`/game?${GameIdParam}=${encodeURIComponent(instanceId)}`);
//       }, 1500);
//     } else {
//       const gameId = params.get(GameIdParam);
//       if (authReady === true) {
//         if (gameId) {
//           router.push(`/game?${GameIdParam}=${gameId}`);
//         } else {
//           router.push("/lobby");
//         }
//       }
//     }
//   }, [authReady, router, params, instanceId, discordEnabled]);

//   return (
//     <main className={"grid grid-flow-dense auto-rows-auto grid-cols-6"}>
//       <div className={"col-span-6 md:col-span-4 md:col-start-2"}>
//         <h1 className={"py-2 text-center text-2xl"}>{CanonicalBriscasName}</h1>
//         <div
//           className={
//             "m-1 h-36 rounded-md border border-white border-opacity-40 bg-zinc-700 p-1 shadow-lg md:m-0"
//           }
//         >
//           <div
//             className={"flex h-full items-center justify-center align-middle"}
//           >
//             {!discordEnabled ? (
//               <FormattedMessage id={"landing.login.automatic"} />
//             ) : (
//               <div className={"flex items-center"}>
//                 <div>
//                   <LogosDiscordIcon
//                     className={
//                       "h-16 w-16 rounded-full border-b-2 border-t-2 border-double border-[#5865f2] border-opacity-30"
//                     }
//                   />
//                 </div>
//                 <div
//                   className={clsx(
//                     "outline-b-2 outline-t-2 outline-x-8 outline-opacity-80 h-16 w-16 translate-x-64 rounded-full outline-cyan-300 hover:border-white",
//                     "animate-pulse",
//                   )}
//                 >
//                   <ShieldCheckmark />
//                 </div>
//                 <div
//                   className={
//                     "h-16 w-16 translate-x-[-4em] animate-ping rounded-full border-b-2 border-t-2 border-stone-200 border-opacity-20 delay-75 duration-300"
//                   }
//                 ></div>
//                 <div
//                   className={
//                     "h-14 w-16 translate-x-[-4.2em] animate-ping rounded-full border-b-2 border-t-2 border-gray-300 border-opacity-30 delay-100 duration-500"
//                   }
//                 ></div>
//                 <div
//                   className={
//                     "h-12 w-14 translate-x-[-4.4em] animate-ping rounded-full border-x-4 border-b-2 border-t-2 border-white border-x-green-500 border-opacity-40 duration-1000"
//                   }
//                 ></div>
//                 <div
//                   className={
//                     "h-12 w-12 translate-x-[-4.6em] animate-ping rounded-full border-b-2 border-t-2 border-slate-200 border-opacity-20 delay-150 duration-700"
//                   }
//                 ></div>
//                 <div
//                   className={
//                     "h-10 w-10 translate-x-[-4.8em] animate-ping rounded-full border-b-2 border-t-2 border-stone-100 border-opacity-10 delay-200 duration-200"
//                   }
//                 ></div>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </main>
//   );
// }
