import { clsx } from "clsx";
import type { FunctionComponent } from "react";

export type LanguageGlyphs_IconProps = {
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
}: LanguageGlyphs_IconProps) => {
	return clsx(
		width ?? "w-6",
		height ?? "h-6",
		fill ?? "fill-none",
		stroke ?? "stroke-current",
		"cursor-[inherit]",
		className,
	);
};

export const LanguageGlyphs_Icon: FunctionComponent<
	LanguageGlyphs_IconProps
> = (props) => {
	const { viewBox } = props;
	return (
		<svg
			role={"img"}
			aria-label={"Language Glyphs icon"}
			xmlns="http://www.w3.org/2000/svg"
			viewBox={viewBox ?? "0 0 24 24"}
			strokeWidth={1.29}
			className={getClassName(props)}
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802"
			/>
		</svg>
	);
};
