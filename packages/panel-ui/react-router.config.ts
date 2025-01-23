import type { Config } from "@react-router/dev/config";

const {
  ROUTER_BUILD_DIRECTORY,
  ROUTER_NO_PRERENDER,
  ROUTER_SSR
} = process.env;

export default {
  buildDirectory: ROUTER_BUILD_DIRECTORY || "output/unknown",
  prerender: ROUTER_NO_PRERENDER !== undefined,
  ssr: ROUTER_SSR === "1" || ROUTER_SSR === "true",
} satisfies Config;