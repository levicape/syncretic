import { clsx } from "clsx";
import type { FunctionComponent } from "react";

export type QuestionMark_IconProps = {
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
}: QuestionMark_IconProps) => {
	return clsx(
		width ?? "w-6",
		height ?? "h-6",
		fill ?? "fill-current",
		stroke ?? "stroke-none",
		"cursor-[inherit]",
		className,
	);
};

export const QuestionMark_Icon: FunctionComponent<QuestionMark_IconProps> = (
	props,
) => {
	const { viewBox } = props;

	return (
		<svg
			role={"img"}
			aria-label={"Question Mark"}
			xmlns="http://www.w3.org/2000/svg"
			viewBox={viewBox ?? "0 0 24 24"}
			className={getClassName(props)}
		>
			<path
				fillRule="evenodd"
				d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 01-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.513 1.324 1.513 3.518 0 4.842a3.75 3.75 0 01-.837.552c-.676.328-1.028.774-1.028 1.152v.75a.75.75 0 01-1.5 0v-.75c0-1.279 1.06-2.107 1.875-2.502.182-.088.351-.199.503-.331.83-.727.83-1.857 0-2.584zM12 18a.75.75 0 100-1.5.75.75 0 000 1.5z"
				clipRule="evenodd"
			/>
		</svg>
	);
};
