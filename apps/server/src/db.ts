import { createDb } from "@repo/db";
import { env } from "./env.js";

export const db = createDb(env.databaseUrl);
