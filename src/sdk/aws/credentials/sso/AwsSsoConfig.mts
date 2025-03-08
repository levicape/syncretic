/*

   Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   Author notes:
   This file reinterprets source code from the AWS SDK for JavaScript v3 to be compatible with this codebase.
   The logic is the same, but organization, formatting, and some variables have been changed.
   Particularly, some types from @smithy have been replaced with inline types, and exceptions are all now VErrors.
   The original source code is available at https://github.com/aws/aws-sdk-js-v3/tree/main/packages/credential-provider-sso

   API Version: 2024-01-16
*/
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
	ParsedIniData,
	SharedConfigFiles,
	SharedConfigInit,
} from "./AwsSsoCredentials.mjs";
import { getHomeDir } from "./AwsSsoToken.mjs";

const prefixKeyRegex = /^([\w-]+)\s(["'])?([\w-@\+\.%:/]+)\2$/;
const profileNameBlockList = ["__proto__", "profile __proto__"];
const swallowError = () => ({});

/**
 * @public
 */
export enum IniSectionType {
	PROFILE = "profile",
	SSO_SESSION = "sso-session",
	SERVICES = "services",
}

export const parseIni = (iniData: string): ParsedIniData => {
	const map: ParsedIniData = {};

	let currentSection: string | undefined;
	let currentSubSection: string | undefined;

	for (const iniLine of iniData.split(/\r?\n/)) {
		const trimmedLine = iniLine.split(/(^|\s)[;#]/)[0].trim(); // remove comments and trim
		const isSection: boolean =
			trimmedLine[0] === "[" && trimmedLine[trimmedLine.length - 1] === "]";
		if (isSection) {
			// New section found. Reset currentSection and currentSubSection.
			currentSection = undefined;
			currentSubSection = undefined;

			const sectionName = trimmedLine.substring(1, trimmedLine.length - 1);
			const matches = prefixKeyRegex.exec(sectionName);
			if (matches) {
				const [, prefix, , name] = matches;
				// Add prefix, if the section name starts with `profile`, `sso-session` or `services`.
				if (Object.values(IniSectionType).includes(prefix as IniSectionType)) {
					currentSection = [prefix, name].join(CONFIG_PREFIX_SEPARATOR);
				}
			} else {
				// If the section name does not match the regex, use the section name as is.
				currentSection = sectionName;
			}

			if (profileNameBlockList.includes(sectionName)) {
				throw new Error(`Found invalid profile name "${sectionName}"`);
			}
		} else if (currentSection) {
			const indexOfEqualsSign = trimmedLine.indexOf("=");
			if (![0, -1].includes(indexOfEqualsSign)) {
				const [name, value]: [string, string] = [
					trimmedLine.substring(0, indexOfEqualsSign).trim(),
					trimmedLine.substring(indexOfEqualsSign + 1).trim(),
				];
				if (value === "") {
					currentSubSection = name;
				} else {
					if (currentSubSection && iniLine.trimStart() === iniLine) {
						// Reset currentSubSection if there is no whitespace
						currentSubSection = undefined;
					}
					map[currentSection] = map[currentSection] || {};
					const key = currentSubSection
						? [currentSubSection, name].join(CONFIG_PREFIX_SEPARATOR)
						: name;
					map[currentSection][key] = value;
				}
			}
		}
	}

	return map;
};

/**
 * @internal
 */
export const ENV_CREDENTIALS_PATH = "AWS_SHARED_CREDENTIALS_FILE";

export const getCredentialsFilepath = () =>
	process.env[ENV_CREDENTIALS_PATH] ||
	join(getHomeDir(), ".aws", "credentials");

/**
 * @internal
 */
export const CONFIG_PREFIX_SEPARATOR = ".";

/**
 * @internal
 */
export const ENV_CONFIG_PATH = "AWS_CONFIG_FILE";

export const getConfigFilepath = () =>
	process.env[ENV_CONFIG_PATH] || join(getHomeDir(), ".aws", "config");

const filePromisesHash: Record<string, Promise<string>> = {};

interface SlurpFileOptions {
	ignoreCache?: boolean;
}

export const slurpFile = (path: string, options?: SlurpFileOptions) => {
	if (!filePromisesHash[path] || options?.ignoreCache) {
		filePromisesHash[path] = readFile(path, "utf8");
	}
	return filePromisesHash[path];
};

/**
 * Returns the config data from parsed ini data.
 * * Returns data for `default`
 * * Returns profile name without prefix.
 * * Returns non-profiles as is.
 */
export const getConfigData = (data: ParsedIniData): ParsedIniData =>
	Object.entries(data)
		.filter(([key]) => {
			const indexOfSeparator = key.indexOf(CONFIG_PREFIX_SEPARATOR);
			if (indexOfSeparator === -1) {
				// filter out keys which do not contain CONFIG_PREFIX_SEPARATOR.
				return false;
			}
			// Check if prefix is a valid IniSectionType.
			return Object.values(IniSectionType).includes(
				key.substring(0, indexOfSeparator) as IniSectionType,
			);
		})
		// remove profile prefix, if present.
		.reduce(
			(acc, [key, value]) => {
				const indexOfSeparator = key.indexOf(CONFIG_PREFIX_SEPARATOR);
				const updatedKey =
					key.substring(0, indexOfSeparator) === IniSectionType.PROFILE
						? key.substring(indexOfSeparator + 1)
						: key;
				acc[updatedKey] = value;
				return acc;
			},
			{
				// Populate default profile, if present.
				...(data.default && { default: data.default }),
			} as ParsedIniData,
		);

/**
 * Loads the config and credentials files.
 * @internal
 */
export const loadSharedConfigFiles = async (
	init: SharedConfigInit = {},
): Promise<SharedConfigFiles> => {
	const {
		filepath = getCredentialsFilepath(),
		configFilepath = getConfigFilepath(),
	} = init;
	const homeDir = getHomeDir();
	const relativeHomeDirPrefix = "~/";

	let resolvedFilepath = filepath;
	if (filepath.startsWith(relativeHomeDirPrefix)) {
		resolvedFilepath = join(homeDir, filepath.slice(2));
	}

	let resolvedConfigFilepath = configFilepath;
	if (configFilepath.startsWith(relativeHomeDirPrefix)) {
		resolvedConfigFilepath = join(homeDir, configFilepath.slice(2));
	}

	const parsedFiles = await Promise.all([
		slurpFile(resolvedConfigFilepath, {
			ignoreCache: init.ignoreCache,
		})
			.then(parseIni)
			.then(getConfigData)
			.catch(swallowError),
		slurpFile(resolvedFilepath, {
			ignoreCache: init.ignoreCache,
		})
			.then(parseIni)
			.catch(swallowError),
	]);

	return {
		configFile: parsedFiles[0],
		credentialsFile: parsedFiles[1],
	};
};

/**
 * Merge multiple profile config files such that settings each file are kept together
 *
 * @internal
 */
export const mergeConfigFiles = (...files: ParsedIniData[]): ParsedIniData => {
	const merged: ParsedIniData = {};
	for (const file of files) {
		for (const [key, values] of Object.entries(file)) {
			if (merged[key] !== undefined) {
				Object.assign(merged[key], values);
			} else {
				merged[key] = values;
			}
		}
	}
	return merged;
};
