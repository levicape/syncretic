import { clsx } from "clsx";
import { Suspense } from "react";
import { useOidcClient } from "../../atoms/authentication/OidcClientAtom";
import { useFormatMessage } from "../../atoms/localization/I18nAtom";
import { DesignSystem } from "../../ui/DesignSystem";
import { Button } from "../../ui/daisy/action/Button";
import { Users_Icon } from "../../ui/display/icons/Users";
const { Fallback } = DesignSystem;

export const App = () => {
	const [_, user] = useOidcClient();
	const formatMessage = useFormatMessage();
	const username = user?.profile["cognito:username"] ?? user?.profile.sub;
	return (
		<>
			<section
				className={clsx(
					"card",
					"card-sm",
					"card-border",
					"border-2",
					"border-success/30",
					"border-dashed",
				)}
			>
				<h2 className={clsx("card-title", "pt-4", "justify-center")}>
					<Users_Icon
						height={"h-12"}
						width={"w-12"}
						stroke={user ? "stroke-accent/80" : "stroke-gray-400"}
						fill={"fill-accent-content/40"}
						className={clsx(user ? "animate-pulse" : undefined)}
					/>
				</h2>
				{user ? (
					<Suspense fallback={<Fallback />}>
						<>
							<p className={clsx("card-body", "px-12")}>
								{formatMessage({
									id: "authentication.user._some.logout.button",
									description: "User island welcome",
									defaultMessage: `Welcome${username ? "," : ""} ${username ?? ""}`,
								})}
							</p>
							<footer
								className={clsx(
									"card-actions",
									"join-item",
									"px-8",
									"py-4",
									"border-info/80",
									"border-double",
								)}
							>
								<Button
									size={"sm"}
									color={"error"}
									href={"/~oidc/close"}
									renderAs={"a"}
									variant={"soft"}
									supressContentColor
									block
								>
									{formatMessage({
										id: "authentication.user._some.logout.button",
										description: "User island logout",
										defaultMessage: "Sign out",
									})}
								</Button>
							</footer>
						</>
					</Suspense>
				) : (
					<footer
						className={clsx(
							"card-actions",
							"card-border",
							"join-item",
							"p-8",
							"border-info/80",
							"border-double",
						)}
					>
						<Button
							color={"primary"}
							href={"/~oidc/authorize"}
							renderAs={"a"}
							wide
						>
							{formatMessage({
								id: "authentication.user._none.login.button",
								description: "User island greetings",
								defaultMessage: "Sign in",
							})}
						</Button>
					</footer>
				)}
			</section>
		</>
	);
};
