#!/usr/bin/env node

import { run } from "@stricli/core";
import { CreateFourtwoApp } from "./app.mts";
import { CreateFourtwoContext } from "./context.mts";

await run(
	await CreateFourtwoApp(),
	process.argv.slice(2),
	await CreateFourtwoContext(),
);
