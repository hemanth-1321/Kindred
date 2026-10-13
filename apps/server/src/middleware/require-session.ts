import { fromNodeHeaders } from "better-auth/node";
import type { NextFunction, Request, Response } from "express";
import { auth, type AuthSession } from "../auth.js";

declare global {
  namespace Express {
    interface Locals {
      session: AuthSession["session"];
      user: AuthSession["user"];
    }
  }
}

export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const result = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!result) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  res.locals.session = result.session;
  res.locals.user = result.user;
  next();
}
