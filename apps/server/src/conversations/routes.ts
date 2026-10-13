import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../http-error.js";
import { requireSession } from "../middleware/require-session.js";
import {
  createConversation,
  listConversations,
  listMessages,
  sendMessage,
} from "./service.js";

const conversationIdSchema = z.uuid();

const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  idempotencyKey: z.string().min(8).max(200),
});

function parseConversationId(value: unknown): string {
  const result = conversationIdSchema.safeParse(value);
  if (!result.success) {
    throw new HttpError(404, "Conversation not found");
  }
  return result.data;
}

export const conversationsRouter = Router();

conversationsRouter.use(requireSession);

conversationsRouter.get("/", async (_req, res) => {
  const conversations = await listConversations(res.locals.user.id);
  res.json({ conversations });
});

conversationsRouter.post("/", async (_req, res) => {
  const conversation = await createConversation(res.locals.user.id);
  res.status(201).json({ conversation });
});

conversationsRouter.get("/:id/messages", async (req, res) => {
  const messages = await listMessages(
    parseConversationId(req.params.id),
    res.locals.user.id,
  );
  res.json({ messages });
});

conversationsRouter.post("/:id/messages", async (req, res) => {
  const body = sendMessageSchema.parse(req.body);
  const result = await sendMessage({
    conversationId: parseConversationId(req.params.id),
    userId: res.locals.user.id,
    content: body.content,
    idempotencyKey: body.idempotencyKey,
  });
  res.status(201).json(result);
});
