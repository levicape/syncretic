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

/**
 * @public
 */
export interface Identity {
	/**
	 * A `Date` when the identity or credential will no longer be accepted.
	 */
	readonly expiration?: Date;
}

/**
 * @public
 */
export type IdentityProvider<IdentityT extends Identity> = (
	identityProperties?: Record<string, unknown>,
) => Promise<IdentityT>;

/**
 * @public
 */
export interface AwsCredentialIdentity extends Identity {
	/**
	 * AWS access key ID
	 */
	readonly accessKeyId: string;

	/**
	 * AWS secret access key
	 */
	readonly secretAccessKey: string;

	/**
	 * A security or session token to use with these credentials. Usually
	 * present for temporary credentials.
	 */
	readonly sessionToken?: string;

	/**
	 * AWS credential scope for this set of credentials.
	 */
	readonly credentialScope?: string;

	/**
	 * AWS accountId.
	 */
	readonly accountId?: string;
}

/**
 * @public
 */
export type AwsCredentialIdentityProvider =
	IdentityProvider<AwsCredentialIdentity>;
