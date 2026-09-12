#!/usr/bin/env node
/** The entrypoint. Everything it does lives in `commands.ts`; this file only supplies the process. */

import { loadConfig } from "../config.js";
import { ConsoleLogger } from "../log.js";
import { runCli } from "./commands.js";

const env = process.env;
const config = loadConfig(env);

// The logger scrubs these before writing anything, so a key that leaks into an error
// message from a dependency still does not reach the terminal or a CI log.
const logger = new ConsoleLogger([
  config.circle.apiKey,
  config.circle.entitySecretCiphertext,
  config.gateway.apiKey,
]);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const code = await runCli(process.argv.slice(2), {
  logger,
  env,
  fetchImpl: fetch,
  sleep,
  now: () => Math.floor(Date.now() / 1000),
});

process.exitCode = code;
