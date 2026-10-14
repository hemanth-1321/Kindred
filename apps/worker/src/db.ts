import { createDb, type Db } from "@repo/db";
import { env } from "./env.js";

export const db: Db = createDb(env.databaseUrl);
