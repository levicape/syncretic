import clsx from "clsx";
import type { FC, PropsWithChildren } from "react";
import { ApplicationHead } from "../../ui/DesignSystem";

export const OidcPage: FC<PropsWithChildren> = ({ children }) => {
	return (
		<>
			<main
				className={clsx(
					"grid",
					"grid-flow-dense",
					"auto-rows-auto",
					"grid-cols-6",
					"p-12",
				)}
			>
				<div className={clsx("col-span-6", "md:col-span-4", "md:col-start-2")}>
					<h1 className={clsx("pb-12", "text-center", "text-2xl")}>
						{ApplicationHead.title.default}
					</h1>
					<div
						suppressHydrationWarning
						className={clsx(
							"m-1",
							"h-36",
							"rounded-md",
							"border",
							"border-neutral-content/30",
							"border-dotted",
							"bg-base-200/80",
							typeof window !== "undefined"
								? "shadow-accent"
								: "shadow-primary",
							typeof window !== "undefined" ? "shadow-md" : "shadow-2xs",
							"duration-[2s]",
							+"p-32",
							+"transition-all",
							"will-change-[shadow]",
						)}
					>
						<div
							className={clsx(
								"flex",
								"h-full",
								"items-center",
								"justify-center",
								"align-middle",
							)}
						>
							{children}
						</div>
					</div>
				</div>
			</main>
		</>
	);
};
