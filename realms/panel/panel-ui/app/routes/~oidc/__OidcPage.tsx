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
				)}
			>
				<div className={clsx("col-span-6", "md:col-span-4", "md:col-start-2")}>
					<h1 className={clsx("py-2", "text-center", "text-2xl")}>
						{ApplicationHead.title.default}
					</h1>
					<div
						className={clsx(
							"m-1",
							"h-36",
							"rounded-md",
							"border",
							"border-neutral-content/30",
							"bg-neutral/20",
							"p-1",
							"shadow-lg",
							"md:m-0",
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
