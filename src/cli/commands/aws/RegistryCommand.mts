// import { buildCommand } from "@stricli/core";
// import { Logger } from "../../../app/server/logging/Logger.js";

// type Flags = {
// 	readonly target: string;
// 	readonly port: number;
// 	readonly module: string;
// };

// export const StartCommand = async () => {
// 	return async () =>
// 		buildCommand({
// 			loader: async () => {
// 				return async ({ target, port, module }: Flags) => {
// 					const path = `${process.cwd()}/${target}`;
// 					Logger.debug({
// 						StartCommand: {
// 							target,
// 							path,
// 						},
// 					});
// 					const HonoHttpServer = (await import(path))[module];
// 					const server = await HonoHttpServer();
// 					Logger.log({
// 						StartCommand: {
// 							port,
// 							server: {
// 								routes: server.app.routes.filter(
// 									(route: { path: string }) => route.path !== "/*",
// 								),
// 							},
// 						},
// 					});
// 					await server.serve({
// 						port,
// 					});
// 				};
// 			},
// 			parameters: {
// 				flags: {
// 					target: {
// 						brief: "File to serve",
// 						kind: "parsed",
// 						parse: (input: string) => {
// 							const allowed = ["js", "mjs", "cjs"];
// 							if (!allowed.some((ext) => input.endsWith(ext))) {
// 								throw new Error("File must be a js file (mjs, cjs)");
// 							}
// 							return input;
// 						},
// 						optional: false,
// 					},
// 					port: {
// 						brief: "Port to listen on",
// 						kind: "parsed",
// 						default: "5555",
// 						parse: Number,
// 						optional: false,
// 					},
// 					module: {
// 						brief:
// 							"Export to use from target file. (Defaults to `export default ...`)",
// 						kind: "parsed",
// 						default: "default",
// 						parse: String,
// 					},
// 				},
// 			},
// 			docs: {
// 				brief: "Start a spork server",
// 			},
// 		});
// };

// // --name optional
// // --role
// // --bucket

// // --source-credential
// // --source-type
// // --source-server

// // ->

// // CodeBuild Project
// // CodeBuild Role

// // ```
// // Resources:
// //   OIDCProvider:
// //     Type: AWS::IAM::OIDCProvider
// //     Properties: {}
// // ```
