export const PROFILE_EXTRACT_TOPIC = "profile.extract";

/** Extraction waits for a pause in the conversation so several quick messages share one model call. */
export const PROFILE_EXTRACT_DELAY_MS = 30_000;

export type ProfileExtractPayload = {
  conversationId: string;
  userId: string;
  /** Sequence of the user message that requested this extraction. */
  sequence: number;
};
