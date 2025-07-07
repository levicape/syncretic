#!/usr/bin/env node

import { run } from "@stricli/core";
import { CreateSyncreticApp } from "./app.mjs";
import { CreateSyncreticContext } from "./context.mjs";

await run(
	await CreateSyncreticApp(),
	process.argv.slice(2),
	await CreateSyncreticContext(),
);
