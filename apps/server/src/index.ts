import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";
import { auth } from "./auth.js";
import { env } from "./env.js";
import { requireSession } from "./middleware/require-session.js";

const app = express();

app.use(cors({ origin: env.clientOrigin, credentials: true }));

// Better Auth reads the raw request body, so it must be mounted before express.json().
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "wavelength-api" });
});

app.get("/me", requireSession, (_req, res) => {
  res.json({ user: res.locals.user });
});

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
