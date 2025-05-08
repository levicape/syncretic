@bluwy/giget-core

"@inquirer/confirm": "^5.1.8",
"@inquirer/input": "^4.1.8",
"@inquirer/select": "^4.1.0",


"execa": "^8.0.1",
"nanospinner": "^1.2.2",

    "picocolors": "^1.1.1",

	Options

-t, --template <template>
You can specify the desired template from the command line. This is useful for automation, where you'd like to skip any interactive prompts.

npm create hono@latest ./my-app -- --template cloudflare-pages
-i, --install
Install dependencies after cloning template.

npm create hono@latest ./my-app -- --install
-p, --pm <pnpm|bun|deno|npm|yarn>
Allows you to specify which package manager to use.

npm create hono@latest ./my-app -- --pm pnpm
-o, --offline
Use the local cache instead of fetching the latest templates.

npm create hono@latest ./my-app -- --offline