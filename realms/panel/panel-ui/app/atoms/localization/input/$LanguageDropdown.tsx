import { clsx } from "clsx";
import {
	type BaseHTMLAttributes,
	type ChangeEventHandler,
	Fragment,
	type FunctionComponent,
	type OptionHTMLAttributes,
	type SelectHTMLAttributes,
	useCallback,
} from "react";
import { Select, type SelectProps } from "../../../ui/daisy/field/Select";
import {
	LanguageGlyphs_Icon,
	type LanguageGlyphs_IconProps,
} from "../../../ui/display/icons/LanguageGlyphs";
import {
	I18nAtomActions,
	type I18nSupportedLanguage,
	I18nSupportedLanguages,
	useI18nAtom,
} from "../I18nAtom";

const languageText: Record<I18nSupportedLanguage, string> = {
	en: "English",
	es: "Español",
};

export type LanguageDropdownProps = {
	className?: string;
	glyph?: FunctionComponent | null;
	glyphProps?: LanguageGlyphs_IconProps;
	selectClassname?: string;
	selectProps?: Omit<SelectProps, "className" | "onChange" | "defaultValue"> &
		SelectHTMLAttributes<HTMLSelectElement>;
	optionClassname?: (
		language: keyof typeof languageText,
		index: number,
	) => string;
	optionProps?: (
		language: keyof typeof languageText,
		index: number,
	) => OptionHTMLAttributes<HTMLOptionElement>;
};

export const LanguageDropdown: FunctionComponent = ({
	className,
	glyph,
	glyphProps,
	selectClassname,
	selectProps,
	optionClassname,
	optionProps,
	...htmlProps
}: LanguageDropdownProps & BaseHTMLAttributes<HTMLDivElement>) => {
	//   const { language } = useStoreSelector(getSettings);
	//   const { ready } = useStoreSelector(getAuthentication);
	//   const dispatch = useStoreDispatch();

	const [i18nState, dispatch] = useI18nAtom();
	const { selectedLanguage: language } = i18nState;

	const languageOnChange: ChangeEventHandler<HTMLSelectElement> = useCallback(
		({ target }) => {
			dispatch(
				I18nAtomActions.SetLanguage(target.value as I18nSupportedLanguage),
			);
		},
		[dispatch],
	);

	//   if (ready === null) {
	//     return null;
	//   }

	const Glyph =
		glyph === undefined
			? LanguageGlyphs_Icon
			: glyph !== null
				? glyph
				: Fragment;
	return (
		<div className={clsx("flex", "items-center", className)} {...htmlProps}>
			<Glyph {...glyphProps} />
			<Select
				className={clsx("ml-2", "w-full", "bg-transparent", selectClassname)}
				onChange={languageOnChange}
				value={language}
				{...selectProps}
			>
				{I18nSupportedLanguages.map((language, index) => {
					return (
						<option
							key={language}
							value={language}
							className={clsx(optionClassname?.(language, index))}
							{...(optionProps?.(language, index) ?? {})}
						>
							{languageText[language]}
						</option>
					);
				})}
			</Select>
		</div>
	);
};
