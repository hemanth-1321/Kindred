import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { ZodError } from "zod";
import { auth } from "./auth.js";
import { conversationsRouter } from "./conversations/routes.js";
import { env } from "./env.js";
import { HttpError } from "./http-error.js";
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

app.use("/conversations", conversationsRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: "Invalid request", issues: error.issues });
    return;
  }
  if (error instanceof HttpError) {
    if (error.status >= 500) console.error(error.cause ?? error);
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
