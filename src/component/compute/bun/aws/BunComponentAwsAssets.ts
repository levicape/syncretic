import { hostname, networkInterfaces, version } from "node:os";
import { extname } from "node:path";
import type { Function } from "@pulumi/aws/lambda/index.js";
import { BucketV2 } from "@pulumi/aws/s3/bucketV2.js";
import {
	type BucketObject,
	BucketOwnershipControls,
	BucketPublicAccessBlock,
	BucketWebsiteConfigurationV2,
} from "@pulumi/aws/s3/index.js";
import type { Image } from "@pulumi/docker-build/index.js";
import { type Output, all } from "@pulumi/pulumi/index.js";
import { S3BucketFolder } from "@pulumi/synced-folder/s3bucketFolder.js";
import { Static } from "@pulumiverse/time/static.js";
import type { Context } from "../../../../context/Context.js";
import type {
	RouteMap,
	WebsiteManifest,
} from "../../../website/WebsiteManifest.js";
import type { BunArtifactLayer } from "../BunArtifactLayer.js";

export interface BunComponentAwsAssetsProps {
	wwwroot: Output<string>;
	artifact: BunArtifactLayer;
	indexHtmlPath: string;
	errorHtmlPath: string;
	blockPublic?: boolean;
	routes?: Output<RouteMap>;
	publicPath: string;
}
export interface BunComponentAwsAssetsState {
	$type: "BunComponentAws" | string;
	aws: {
		bucket: BucketV2;
		website: BucketWebsiteConfigurationV2;
		manifest?: {
			bucketObject: BucketObject;
			content: Output<{ WebsiteComponent: WebsiteManifest }>;
		};
	};
	publicPath: string;
}

export const BunComponentAwsAssets = (
	name: string,
	{
		lambda,
		image,
	}: {
		lambda: Function;
		image: Image;
	},
	context: Context,
	{
		blockPublic = true,
		artifact,
		wwwroot,
		routes,
		indexHtmlPath,
		errorHtmlPath,
		publicPath,
	}: BunComponentAwsAssetsProps,
): BunComponentAwsAssetsState => {
	const parent = lambda;
	const bucket = new BucketV2(
		`${name}-Website--bucket`,
		{},
		{ parent, dependsOn: [image] },
	);

	const bucketName = bucket.bucket;
	const publicAccessBlock = new BucketPublicAccessBlock(
		`${name}-Website--bucket-public-access`,
		{
			bucket: bucketName,
			blockPublicAcls: blockPublic,
			blockPublicPolicy: blockPublic,
			ignorePublicAcls: blockPublic,
			restrictPublicBuckets: blockPublic,
		},
		{
			parent: bucket,
			dependsOn: [bucket],
			replaceOnChanges: ["*"],
			deleteBeforeReplace: true,
		},
	);

	const ownershipControls = new BucketOwnershipControls(
		`${name}-Website--bucket-ownership`,
		{
			bucket: bucketName,
			rule: {
				objectOwnership: "ObjectWriter",
			},
		},
		{
			parent: bucket,
		},
	);

	const website = new BucketWebsiteConfigurationV2(
		`${name}-Website--bucket-website-configuration`,
		{
			bucket: bucketName,
			indexDocument: {
				suffix: indexHtmlPath,
			},
			errorDocument: {
				key: errorHtmlPath,
			},
		},
		{
			dependsOn: [bucket],
			parent: publicAccessBlock,
		},
	);
	const acl = blockPublic ? "bucket-owner-full-control" : "public-read";
	const folder = new S3BucketFolder(
		`${name}-Website--bucket-folder`,
		{
			path: wwwroot,
			bucketName,
			acl,
			managedObjects: false,
		},
		{
			dependsOn: [website, ownershipControls, publicAccessBlock],
			parent,
			retainOnDelete: false,
			replaceOnChanges: ["*"],
		},
	);
	new Static(
		`${name}-Website-upload-timestamp`,
		{
			triggers: {
				data: folder.urn,
			},
		},
		{
			parent: folder,
			replaceOnChanges: ["*"],
			deleteBeforeReplace: true,
		},
	);

	let content: Output<{ WebsiteComponent: WebsiteManifest }> | undefined;
	if (routes !== undefined) {
		const {
			stage,
			environment: { aws, isProd },
			frontend,
		} = context;
		const { websiteEndpoint } = website;
		content = all([routes, bucketName, websiteEndpoint, wwwroot]).apply(
			([routes, bucketName, url, wwwroot]) => {
				const { dns } = frontend ?? {};
				const { hostnames } = dns ?? {};

				console.debug({
					WebsiteComponentAws: {
						aws,
						stage,
						isProd,
						manifest: {
							bucketName,
							wwwroot,
							hostnames,
							routes: JSON.stringify(
								{
									...routes,
								},
								null,
								4,
							).replaceAll("\n", ""),
						},
					},
				});
				return {
					WebsiteComponent: {
						manifest: {
							ok: true,
							routes,
							frontend: {
								...(isProd
									? {}
									: {
											website: {
												url,
												protocol: "http",
											},
										}),
								hostnames: hostnames ?? [],
							},
							version: {
								sequence: Date.now().toString(),
								build: artifact.current.initialized.root.apply(
									(r) => r.split("/").at(-1)!,
								),
								stage,
								process: (() =>
									isProd
										? {}
										: {
												pid: process.pid.toString(),
												node: process.version,
												arch: process.arch,
												platform: process.platform,
												os: {
													version: version(),
													hostname: hostname(),
													mac: {
														...Object.fromEntries(
															Object.entries(networkInterfaces()).map(
																([key, ni]) => [key, ni?.map((i) => i.mac)],
															),
														),
													},
												},
											})(),
								...(isProd
									? {}
									: {
											aws,
										}),
							},
						},
					} satisfies WebsiteManifest,
				};
			},
		);
	}

	// TODO: Monitor
	// if (monitor) {
	// 	const dashboard = monitor.dashboard;
	// 	if (dashboard) {
	// 		new Dashboard(`${name}-Website--monitor-dashboard`, dashboard, {
	// 			parent: this,
	// 		});
	// 	}
	// }

	// TODO: Bucket should be a prop, so that the lambda can have a reference and can load from env vars
	return {
		$type: "BunComponentAws",
		aws: {
			bucket,
			website,
			// manifest:
			// 	content !== undefined
			// 		? {
			// 				bucketObject: new BucketObject(
			// 					`${name}-Website--bucket-object-manifest-routes`,
			// 					{
			// 						bucket: bucketName,
			// 						key: "/.WebsiteComponent/manifest.json",
			// 						acl,
			// 						content: jsonStringify(content),
			// 						contentType: "application/json",
			// 					},
			// 					{ parent, dependsOn: [folder] },
			// 				),
			// 				content,
			// 			}
			// 		: undefined,
		},
		publicPath,
	};
};

export function getContentType(filename: string, textEncoding: string) {
	const ext = filename.endsWith(".well-known/site-association-json")
		? ".json"
		: extname(filename);
	const extensions = {
		[".txt"]: { mime: "text/plain", isText: true },
		[".htm"]: { mime: "text/html", isText: true },
		[".html"]: { mime: "text/html", isText: true },
		[".xhtml"]: { mime: "application/xhtml+xml", isText: true },
		[".css"]: { mime: "text/css", isText: true },
		[".js"]: { mime: "text/javascript", isText: true },
		[".mjs"]: { mime: "text/javascript", isText: true },
		[".apng"]: { mime: "image/apng", isText: false },
		[".avif"]: { mime: "image/avif", isText: false },
		[".gif"]: { mime: "image/gif", isText: false },
		[".jpeg"]: { mime: "image/jpeg", isText: false },
		[".jpg"]: { mime: "image/jpeg", isText: false },
		[".png"]: { mime: "image/png", isText: false },
		[".svg"]: { mime: "image/svg+xml", isText: true },
		[".bmp"]: { mime: "image/bmp", isText: false },
		[".tiff"]: { mime: "image/tiff", isText: false },
		[".webp"]: { mime: "image/webp", isText: false },
		[".ico"]: { mime: "image/vnd.microsoft.icon", isText: false },
		[".eot"]: { mime: "application/vnd.ms-fontobject", isText: false },
		[".ttf"]: { mime: "font/ttf", isText: false },
		[".otf"]: { mime: "font/otf", isText: false },
		[".woff"]: { mime: "font/woff", isText: false },
		[".woff2"]: { mime: "font/woff2", isText: false },
		[".json"]: { mime: "application/json", isText: true },
		[".jsonld"]: { mime: "application/ld+json", isText: true },
		[".xml"]: { mime: "application/xml", isText: true },
		[".pdf"]: { mime: "application/pdf", isText: false },
		[".zip"]: { mime: "application/zip", isText: false },
		[".wasm"]: { mime: "application/wasm", isText: false },
		[".webmanifest"]: { mime: "application/manifest+json", isText: true },
	};
	const extensionData = extensions[ext as keyof typeof extensions];
	const mime = extensionData?.mime ?? "application/octet-stream";
	const charset =
		extensionData?.isText && textEncoding !== "none"
			? `;charset=${textEncoding}`
			: "";
	return `${mime}${charset}`;
}
