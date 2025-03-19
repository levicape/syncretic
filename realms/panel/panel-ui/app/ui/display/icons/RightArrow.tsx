import { clsx } from "clsx";
import type { FunctionComponent } from "react";

export type RightArrow_IconProps = {
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
}: RightArrow_IconProps) => {
	return clsx(
		width ?? "w-6",
		height ?? "h-6",
		fill ?? "fill-current",
		stroke ?? "stroke-none",
		"cursor-[inherit]",
		className,
	);
};

export const RightArrow_Icon: FunctionComponent<RightArrow_IconProps> = (
	props,
) => {
	const { viewBox } = props;

	return (
		<svg
			role={"img"}
			aria-label={"Right Arrow"}
			xmlns="http://www.w3.org/2000/svg"
			viewBox={viewBox ?? "0 0 24 24"}
			className={getClassName(props)}
		>
			<path
				fillRule="evenodd"
				d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z"
				clipRule="evenodd"
			/>
		</svg>
	);
};
