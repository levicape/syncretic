import { clsx } from "clsx";
import { Loading } from "../../../ui/daisy/feedback/Loading";
import { ShieldCheckmark_Icon } from "../../../ui/display/icons/ShieldCheckmark";
import { DiscordLogo_Icon } from "../../../ui/display/icons/logos/DiscordLogo";

export const CallbackProgress = () => {
	const { enabled: discordEnabled } = {} as Record<string, unknown>; //useDiscord();

	return !discordEnabled ? (
		<Loading className={"bg-clip-content"} size={"xl"} />
	) : (
		<div className={clsx("flex", "items-center")}>
			<div>
				<DiscordLogo_Icon
					className={clsx(
						"h-16 w-16 rounded-full",
						"border-b-2",
						"border-t-2",
						"border-double",
						"border-[#5865f2]",
						"border-opacity-30",
					)}
				/>
			</div>
			<div
				className={clsx(
					"outline-b-2",
					"outline-t-2",
					"outline-x-8",
					"outline-opacity-80",
					"h-16",
					"w-16",
					"translate-x-64",
					"rounded-full",
					"outline-cyan-300",
					"hover:border-white",
					"animate-pulse",
				)}
			>
				<ShieldCheckmark_Icon />
			</div>
			<div
				className={clsx(
					"h-16",
					"w-16",
					"translate-x-[-4em]",
					"animate-ping",
					"rounded-full",
					"border-b-2",
					"border-t-2",
					"border-stone-200",
					"border-opacity-20",
					"delay-75",
					"duration-300",
				)}
			/>
			<div
				className={clsx(
					"h-14",
					"w-16",
					"translate-x-[-4.2em]",
					"animate-ping",
					"rounded-full",
					"border-b-2",
					"border-t-2",
					"border-gray-300",
					"border-opacity-30",
					"delay-100",
					"duration-500",
				)}
			/>
			<div
				className={clsx(
					"h-12",
					"w-14",
					"translate-x-[-4.4em]",
					"animate-ping",
					"rounded-full",
					"border-x-4",
					"border-b-2",
					"border-t-2",
					"border-white",
					"border-x-green-500",
					"border-opacity-40",
					"duration-1000",
				)}
			/>
			<div
				className={clsx(
					"h-12",
					"w-12",
					"translate-x-[-4.6em]",
					"animate-ping",
					"rounded-full",
					"border-b-2",
					"border-t-2",
					"border-slate-200",
					"border-opacity-20",
					"delay-150",
					"duration-700",
				)}
			/>
			<div
				className={clsx(
					"h-10",
					"w-10",
					"translate-x-[-4.8em]",
					"animate-ping",
					"rounded-full",
					"border-b-2",
					"border-t-2",
					"border-stone-100",
					"border-opacity-10",
					"delay-200",
					"duration-200",
				)}
			/>
		</div>
	);
};
