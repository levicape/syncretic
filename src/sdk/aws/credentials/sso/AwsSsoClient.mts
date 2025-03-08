import type { Provider } from "./AwsSsoCredentials.mjs";

export interface AwsSsoClientConfig {
	// /**
	//  * The HTTP handler to use or its constructor options. Fetch in browser and Https in Nodejs.
	//  */
	// requestHandler?: __HttpHandlerUserInput;

	/**
	 * A constructor for a class implementing the {@link @smithy/types#ChecksumConstructor} interface
	 * that computes the SHA-256 HMAC or checksum of a string or binary buffer.
	 * @internal
	 */
	// sha256?: __ChecksumConstructor | __HashConstructor;

	/**
	 * The function that will be used to convert strings into HTTP endpoints.
	 * @internal
	 */
	// urlParser?: __UrlParser;

	/**
	 * A function that can calculate the length of a request body.
	 * @internal
	 */
	// bodyLengthChecker?: __BodyLengthCalculator;

	/**
	 * A function that converts a stream into an array of bytes.
	 * @internal
	 */
	// streamCollector?: __StreamCollector;

	/**
	 * The function that will be used to convert a base64-encoded string to a byte array.
	 * @internal
	 */
	// base64Decoder?: __Decoder;

	/**
	 * The function that will be used to convert binary data to a base64-encoded string.
	 * @internal
	 */
	// base64Encoder?: __Encoder;

	/**
	 * The function that will be used to convert a UTF8-encoded string to a byte array.
	 * @internal
	 */
	// utf8Decoder?: __Decoder;

	/**
	 * The function that will be used to convert binary data to a UTF-8 encoded string.
	 * @internal
	 */
	// utf8Encoder?: __Encoder;

	/**
	 * The runtime environment.
	 * @internal
	 */
	runtime?: string;

	/**
	 * Disable dynamically changing the endpoint of the client based on the hostPrefix
	 * trait of an operation.
	 */
	disableHostPrefix?: boolean;

	/**
	 * Unique service identifier.
	 * @internal
	 */
	serviceId?: string;

	/**
	 * Enables IPv6/IPv4 dualstack endpoint.
	 */
	useDualstackEndpoint?: boolean | Provider<boolean>;

	/**
	 * Enables FIPS compatible endpoints.
	 */
	useFipsEndpoint?: boolean | Provider<boolean>;

	/**
	 * The AWS region to which this client will send requests
	 */
	region?: string | Provider<string>;

	/**
	 * Setting a client profile is similar to setting a value for the
	 * AWS_PROFILE environment variable. Setting a profile on a client
	 * in code only affects the single client instance, unlike AWS_PROFILE.
	 *
	 * When set, and only for environments where an AWS configuration
	 * file exists, fields configurable by this file will be retrieved
	 * from the specified profile within that file.
	 * Conflicting code configuration and environment variables will
	 * still have higher priority.
	 *
	 * For client credential resolution that involves checking the AWS
	 * configuration file, the client's profile (this value) will be
	 * used unless a different profile is set in the credential
	 * provider options.
	 *
	 */
	profile?: string;

	/**
	 * The provider populating default tracking information to be sent with `user-agent`, `x-amz-user-agent` header
	 * @internal
	 */
	// defaultUserAgentProvider?: Provider<__UserAgent>;

	/**
	 * Value for how many times a request will be made at most in case of retry.
	 */
	maxAttempts?: number | Provider<number>;

	/**
	 * Specifies which retry algorithm to use.
	 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-smithy-util-retry/Enum/RETRY_MODES/
	 *
	 */
	retryMode?: string | Provider<string>;
}
