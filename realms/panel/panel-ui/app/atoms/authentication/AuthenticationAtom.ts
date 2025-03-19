import { atomWithStorage } from "jotai/utils";
import { z } from "zod";

const myNumberSchema = z.number().int().nonnegative();

export const AuthenticationAtom = atomWithStorage("my-number", 0, {
	getItem(key, initialValue) {
		const storedValue = localStorage.getItem(key);
		try {
			return myNumberSchema.parse(JSON.parse(storedValue ?? ""));
		} catch {
			return initialValue;
		}
	},
	setItem(key, value) {
		localStorage.setItem(key, JSON.stringify(value));
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
					newValue = myNumberSchema.parse(JSON.parse(e.newValue ?? ""));
				} catch {
					newValue = initialValue;
				}
				callback(newValue);
			}
		};
		window.addEventListener("storage", refresh);

		return () => {
			window.removeEventListener("storage", refresh);
		};
	},
});
