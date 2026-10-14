import {
  extractProfileAssertions,
  type ExistingAssertion,
  type FollowUp,
  type LlmClient,
  type ProfileExtraction,
  type TranscriptMessage,
} from "@repo/llm";
import {
  describeProfileFields,
  PROFILE_FIELD_NAMES,
  validateProposedAssertions,
  type RejectedAssertion,
  type ValidatedAssertion,
} from "@repo/matching";

export type ExtractionResult = {
  accepted: ValidatedAssertion[];
  rejected: RejectedAssertion[];
  followUps: FollowUp[];
  under18: boolean;
  usage: Omit<ProfileExtraction, "assertions" | "followUps" | "under18">;
};

const fieldGuide = describeProfileFields();

export async function extractProfile(
  client: LlmClient,
  model: string,
  input: {
    existing: ExistingAssertion[];
    context: TranscriptMessage[];
    messages: TranscriptMessage[];
    today?: Date;
  },
): Promise<ExtractionResult> {
  const { assertions, followUps, under18, ...usage } =
    await extractProfileAssertions(client, model, {
      fieldNames: PROFILE_FIELD_NAMES,
      fieldGuide,
      existing: input.existing,
      context: input.context,
      messages: input.messages,
    });

  const validation = validateProposedAssertions(assertions, {
    citableMessageIds: new Set(
      input.messages.filter((m) => m.role === "user").map((m) => m.id),
    ),
    existingAssertionIds: new Set(input.existing.map((a) => a.id)),
    today: input.today ?? new Date(),
  });

  // Nothing about a minor is kept, whichever signal detected it.
  if (under18 || validation.under18) {
    return {
      accepted: [],
      rejected: validation.rejected,
      followUps: ["under_18"],
      under18: true,
      usage,
    };
  }

  const pending = new Set(followUps.filter((f) => f !== "under_18"));
  if (validation.accepted.some((a) => a.status === "contradicted")) {
    pending.add("resolve_contradiction");
  }
  return {
    accepted: validation.accepted,
    rejected: validation.rejected,
    followUps: [...pending],
    under18: false,
    usage,
  };
}
