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

import {
	CONFIG_PREFIX_SEPARATOR,
	IniSectionType,
	getConfigFilepath,
	parseIni,
	slurpFile,
} from "./AwsSsoConfig.mjs";
import type { ParsedIniData } from "./AwsSsoCredentials.mjs";

const swallowError = () => ({});

/**
 * Subset of {@link SharedConfigInit}.
 * @internal
 */
export interface SsoSessionInit {
	/**
	 * The path at which to locate the ini config file. Defaults to the value of
	 * the `AWS_CONFIG_FILE` environment variable (if defined) or
	 * `~/.aws/config` otherwise.
	 */
	configFilepath?: string;
}

/**
 * Returns the sso-session data from parsed ini data by reading
 * ssoSessionName after sso-session prefix including/excluding quotes
 */
export const getSsoSessionData = (data: ParsedIniData): ParsedIniData =>
	Object.entries(data)
		// filter out non sso-session keys
		.filter(([key]) =>
			key.startsWith(IniSectionType.SSO_SESSION + CONFIG_PREFIX_SEPARATOR),
		)
		// replace sso-session key with sso-session name
		.reduce(
			(acc, [key, value]) => ({
				...acc,
				[key.substring(key.indexOf(CONFIG_PREFIX_SEPARATOR) + 1)]: value,
			}),
			{},
		);
/**
 * @internal
 */
export const loadSsoSessionData = async (
	init: SsoSessionInit = {},
): Promise<ParsedIniData> =>
	slurpFile(init.configFilepath ?? getConfigFilepath())
		.then(parseIni)
		.then(getSsoSessionData)
		.catch(swallowError);
