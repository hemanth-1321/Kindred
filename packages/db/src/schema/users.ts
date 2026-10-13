import { boolean, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./columns.js";
import { accountStateEnum } from "./enums.js";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  adultEligible: boolean("adult_eligible").notNull().default(false),
  accountState: accountStateEnum("account_state").notNull().default("active"),
  maxActiveIntroductions: integer("max_active_introductions")
    .notNull()
    .default(3),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
