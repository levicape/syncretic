import { clsx } from "clsx";
import type { FunctionComponent } from "react";

export type Bars4_IconProps = {
	className?: string;
	viewBox?: `${number} ${number} ${number} ${number}`;
	width?: `w-${string}`;
	height?: `h-${string}`;
	fill?: `fill-${string}`;
	stroke?: `stroke-${string}`;
};

const getClassName = ({
	className,
	width,
	height,
	fill,
	stroke,
}: Bars4_IconProps) => {
	return clsx(
		width ?? "w-6",
		height ?? "h-6",
		fill ?? "fill-current",
		stroke ?? "stroke-none",
		"cursor-[inherit]",
		className,
	);
};

export const Bars4_Icon: FunctionComponent<Bars4_IconProps> = (props) => {
	const { viewBox } = props;

	return (
		<svg
			role={"img"}
			aria-label={"Menu Bars"}
			xmlns="http://www.w3.org/2000/svg"
			viewBox={viewBox ?? "0 0 24 24"}
			className={getClassName(props)}
		>
			<path
				fillRule="evenodd"
				d="M3 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 5.25zm0 4.5A.75.75 0 013.75 9h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 9.75zm0 4.5a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75zm0 4.5a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z"
				clipRule="evenodd"
			/>
		</svg>
	);
};
