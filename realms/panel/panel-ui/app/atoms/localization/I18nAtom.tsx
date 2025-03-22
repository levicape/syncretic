import { useAtom } from "jotai/react";
import { atomWithStorage } from "jotai/utils";
import { useCallback, useMemo } from "react";
import { type IntlShape, createIntl, createIntlCache } from "react-intl";
import { PlaceholderText } from "../../ui/display/PlaceholderText";

export const I18nSupportedLanguages = ["en", "es"] as const;
export type I18nSupportedLanguage = (typeof I18nSupportedLanguages)[number];
export type I18nAtomState = {
	selectedLanguage: I18nSupportedLanguage;
	intl: IntlShape;
};

export const I18nAtomSymbol = Symbol.for("I18N_ATOM");

const onError: Parameters<typeof createIntl>[0]["onError"] = (error): void => {
	if (error.code === "MISSING_TRANSLATION") {
		return;
	}
	console.error(error);
};

const intlConfig: Omit<Parameters<typeof createIntl>[0], "locale"> = {
	onError,
	textComponent: PlaceholderText,
} as const;

export const I18nIntlCache = createIntlCache();
export const I18nAtom = atomWithStorage(
	String(I18nAtomSymbol),
	{
		selectedLanguage: "en" as I18nSupportedLanguage,
		intl: createIntl(
			{
				locale: "en",
				...intlConfig,
			},
			I18nIntlCache,
		),
	} as I18nAtomState,
	{
		getItem(key, initialValue) {
			const storedValue = localStorage.getItem(key);
			try {
				const parsedValue = JSON.parse(storedValue ?? "");
				return {
					...parsedValue,
					intl: createIntl(
						{
							locale: parsedValue.selectedLanguage,
							...intlConfig,
						},
						I18nIntlCache,
					),
				};
			} catch {
				return {
					...initialValue,
					intl: createIntl(
						{
							locale: initialValue.selectedLanguage,
							...intlConfig,
						},
						I18nIntlCache,
					),
				};
			}
		},
		setItem(key, value) {
			const copy: Partial<typeof value> = { ...value };

			// biome-ignore lint:
			delete copy.intl;

			localStorage.setItem(key, JSON.stringify(copy));
		},
		removeItem(key) {
			localStorage.removeItem(key);
		},
		subscribe(key, callback, initialValue) {
			if (
				typeof window === "undefined" ||
				typeof window.addEventListener === "undefined"
			) {
				return () => {};
			}

			const refresh = (e: StorageEvent) => {
				if (e.storageArea === localStorage && e.key === key) {
					let newValue: typeof initialValue;
					try {
						newValue = JSON.parse(e.newValue ?? "");
					} catch {
						newValue = initialValue;
					}
					callback({
						...newValue,
						intl: createIntl(
							{
								locale: newValue.selectedLanguage,
								...intlConfig,
							},
							I18nIntlCache,
						),
					});
				}
			};
			window.addEventListener("storage", refresh);

			return () => {
				window.removeEventListener("storage", refresh);
			};
		},
	},
);

export const I18nAtomActions = {
	SetLanguage: (language: I18nSupportedLanguage) => ({
		$kind: "SET_LANGUAGE",
		payload: language,
	}),
};

export type I18nAction = ReturnType<typeof I18nAtomActions.SetLanguage>;
export const I18nReducer = (
	state: I18nAtomState,
	action: I18nAction,
): I18nAtomState => {
	switch (action.$kind) {
		case "SET_LANGUAGE":
			return {
				...state,
				selectedLanguage: action.payload,
			};
		default:
			return state;
	}
};

export const useI18nAtom = () => {
	const [state, setState] = useAtom(I18nAtom);
	const dispatch = useCallback(
		(action: I18nAction) => setState((prev) => I18nReducer(prev, action)),
		[setState],
	);
	return [state, dispatch] as const;
};

export const useI18n = () => useI18nAtom()[0];
export const useI18nDispatch = () => useI18nAtom()[1];
export const useI18nIntl = () => useI18n().intl;
export const useI18nLanguage = () => useI18n().selectedLanguage;
export const useFormatMessage = () => {
	const intl = useI18nIntl();

	return useCallback(
		(parameters: Parameters<IntlShape["formatMessage"]>[0]) => {
			const memoized = useMemo(
				() => intl.formatMessage(parameters),
				[parameters],
			);
			return memoized;
		},
		[intl],
	);
};
