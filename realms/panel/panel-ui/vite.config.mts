import build from "@hono/vite-build/node";
import adapter from "@hono/vite-dev-server/node";
import ssg from "@hono/vite-ssg";
import tailwindcss from "@tailwindcss/vite";
import honox from "honox/vite";
import { env } from "std-env";
import { defineConfig } from "vite";

const entry = "/app/server.ts";
const { PORT } = env;

/**
 * @see https://vite.dev/config/
 */
export default defineConfig(({ mode }) => {
	if (mode === "client") {
		const unixtime = Math.floor(Date.now() / 1000);
		const timehash = unixtime.toString(16);
		return {
			build: {
				sourcemap: true,
				rollupOptions: {
					input: ["./app/render.ts", "./app/style.css"],
					output: {
						entryFileNames: "!/!!/[name].js",
						chunkFileNames: `!/!!/_c/${timehash}/[name]-[hash].js`,
						assetFileNames: "!/!!/_a/[name].[ext]",
						generatedCode: "es2015",
						compact: true,
					},
					treeshake: "smallest",
				},
				manifest: true,
			},
			plugins: [tailwindcss()],
		};
	}

	return {
		build: {
			emptyOutDir: false,
			ssrManifest: true,
			rollupOptions: {
				output: {
					generatedCode: "es2015",
				},
			},
			commonjsOptions: {
				include: ["cookie", "set-cookie-parser", "oidc-client-ts"],
			},
		},
		ssr: {
			external: [
				"react",
				"react-dom",
				"prop-types",
				"react-router-dom",
				"fs-extra",
				"react-intl",
				"cookie",
				"set-cookie-parser",
				"react-router",
				"oidc-client-ts",
			],
		},
		plugins: [
			tailwindcss(),
			honox({
				client: {
					input: ["./app/style.css"],
				},
				devServer: {
					adapter,
				},
			}),
			build({
				port: PORT ? Number(PORT) : undefined,
			}),
			ssg({
				entry,
			}),
		],
	};
});
