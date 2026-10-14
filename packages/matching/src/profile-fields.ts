import { z } from "zod";

/** Mirrors docs/profile-spec.md; change the spec first, then this catalog. */

export type Subject = "self" | "desired_partner";
export type FieldGroup = "eligibility" | "compatibility" | "sensitive";

type FieldDefinition = {
  group: FieldGroup;
  description: string;
  self?: z.ZodType;
  partner?: z.ZodType;
  /** Several current assertions may coexist; new values add rather than replace. */
  list?: boolean;
  /** Must be stated outright; the extractor may never infer it. */
  explicitOnly?: boolean;
};

const shortText = z.string().trim().min(1).max(200);
const textList = z.array(shortText).min(1).max(20);
const optionsOf = <T extends z.ZodType>(option: T) =>
  z.array(option).min(1).max(10);

const relationshipIntent = z.enum([
  "long_term",
  "marriage",
  "open_to_see",
  "casual",
]);
const relocation = z.enum(["yes", "no", "maybe"]);
const childrenStatus = z.enum(["has_children", "no_children"]);
const childrenIntent = z.enum(["wants", "does_not_want", "open", "unsure"]);
const smoking = z.enum(["never", "sometimes", "regularly"]);
const drinking = z.enum(["never", "socially", "regularly"]);
const level = z.enum(["low", "moderate", "high"]);
const timeTogether = z.enum(["lots", "balanced", "independent"]);
const socialEnergy = z.enum(["introverted", "ambivert", "extroverted"]);
const religiousPractice = z.enum([
  "not_practising",
  "occasional",
  "regular",
  "devout",
]);

const enumDescription = (schema: z.ZodEnum) =>
  `one of ${schema.options.join(", ")}`;

export const PROFILE_FIELDS = {
  birth_date: {
    group: "eligibility",
    description:
      "ISO date (YYYY-MM-DD). Only when the user gives a date; a stated age is not a birth date.",
    self: z.iso.date(),
  },
  gender: {
    group: "eligibility",
    description: "woman, man, non_binary, or the user's own words.",
    self: shortText,
  },
  seeking_genders: {
    group: "eligibility",
    description:
      "Genders the user wants to meet: list of woman, man, non_binary, or own words.",
    partner: textList,
  },
  preferred_age_range: {
    group: "eligibility",
    description:
      "Partner age range as { min, max } in whole years, both 18 or older.",
    partner: z
      .object({
        min: z.number().int().min(18).max(100),
        max: z.number().int().min(18).max(100),
      })
      .refine((range) => range.min <= range.max, "min must not exceed max"),
  },
  city: {
    group: "eligibility",
    description: "City name only; put neighbourhoods in area.",
    self: shortText,
  },
  relationship_intent: {
    group: "eligibility",
    description: enumDescription(relationshipIntent),
    self: relationshipIntent,
  },
  max_distance_km: {
    group: "eligibility",
    description: "Maximum distance the user will travel for dates, in km.",
    self: z.number().int().positive().max(20000),
  },
  open_to_relocation: {
    group: "eligibility",
    description: enumDescription(relocation),
    self: relocation,
  },
  children_status: {
    group: "eligibility",
    description: `${enumDescription(childrenStatus)}. Having children says nothing about wanting more.`,
    self: childrenStatus,
    partner: optionsOf(childrenStatus),
  },
  children_intent: {
    group: "eligibility",
    description: `Whether the user wants (more) children: ${enumDescription(childrenIntent)}.`,
    self: childrenIntent,
    partner: optionsOf(childrenIntent),
  },
  smoking: {
    group: "compatibility",
    description: enumDescription(smoking),
    self: smoking,
    partner: optionsOf(smoking),
  },
  drinking: {
    group: "compatibility",
    description: enumDescription(drinking),
    self: drinking,
    partner: optionsOf(drinking),
  },
  diet: {
    group: "compatibility",
    description:
      "vegetarian, eggetarian, vegan, jain, non_vegetarian, or the user's own words.",
    self: shortText,
    partner: textList,
  },
  activity_level: {
    group: "compatibility",
    description: enumDescription(level),
    self: level,
    partner: optionsOf(level),
  },
  work_schedule: {
    group: "compatibility",
    description: "Short text, for example night shifts or travels often.",
    self: shortText,
    partner: shortText,
  },
  time_together: {
    group: "compatibility",
    description: enumDescription(timeTogether),
    self: timeTogether,
    partner: optionsOf(timeTogether),
  },
  communication_style: {
    group: "compatibility",
    description: "Short text in the user's words.",
    self: shortText,
    partner: shortText,
  },
  conflict_style: {
    group: "compatibility",
    description: "Short text in the user's words.",
    self: shortText,
    partner: shortText,
  },
  social_energy: {
    group: "compatibility",
    description: `${enumDescription(socialEnergy)}. Only when the user describes themselves with one of these words.`,
    self: socialEnergy,
    partner: optionsOf(socialEnergy),
    explicitOnly: true,
  },
  values: {
    group: "compatibility",
    description: "List of short phrases in the user's words.",
    self: textList,
    partner: textList,
    list: true,
  },
  interests: {
    group: "compatibility",
    description: "List of short phrases.",
    self: textList,
    partner: textList,
    list: true,
  },
  stories: {
    group: "compatibility",
    description: "Short paraphrased anecdotes about the user.",
    self: textList,
    list: true,
  },
  area: {
    group: "compatibility",
    description: "Neighbourhood or locality within the city.",
    self: shortText,
  },
  religion: {
    group: "sensitive",
    description: "Only when the user states their own religion.",
    self: shortText,
    partner: textList,
  },
  religious_practice: {
    group: "sensitive",
    description: enumDescription(religiousPractice),
    self: religiousPractice,
    partner: optionsOf(religiousPractice),
  },
  caste: {
    group: "sensitive",
    description: "Only when the user states their own caste.",
    self: shortText,
    partner: textList,
  },
  community: {
    group: "sensitive",
    description: "Only when the user states their own community.",
    self: shortText,
    partner: textList,
  },
  politics: {
    group: "sensitive",
    description: "Only when the user states their own political views.",
    self: shortText,
    partner: shortText,
  },
} satisfies Record<string, FieldDefinition>;

export type ProfileField = keyof typeof PROFILE_FIELDS;

const definitions: Record<string, FieldDefinition> = PROFILE_FIELDS;

export const PROFILE_FIELD_NAMES = Object.keys(PROFILE_FIELDS) as [
  ProfileField,
  ...ProfileField[],
];

export const REQUIRED_FOR_MATCHING = [
  ["self", "birth_date"],
  ["self", "gender"],
  ["desired_partner", "seeking_genders"],
  ["desired_partner", "preferred_age_range"],
  ["self", "city"],
  ["self", "relationship_intent"],
] as const satisfies readonly (readonly [Subject, ProfileField])[];

export function isListField(field: string): boolean {
  return definitions[field]?.list === true;
}

/** Field reference for the extraction prompt, generated so prompt and validation cannot drift. */
export function describeProfileFields(): string {
  return Object.entries(definitions)
    .map(([name, def]) => {
      const subjects = [
        def.self && "self",
        def.partner && "desired_partner",
      ].filter(Boolean);
      const explicit =
        def.group !== "compatibility" || def.explicitOnly
          ? "; explicit only"
          : "";
      return `- ${name} (${def.group}; ${subjects.join(", ")}${explicit}): ${def.description}`;
    })
    .join("\n");
}

export type Importance = "low" | "medium" | "high";

export type ProposedAssertion = {
  subject: Subject;
  field: string;
  value: unknown;
  status: "explicit" | "inferred" | "contradicted";
  importance: Importance | null;
  proposedHardConstraint: boolean;
  evidence: string[];
  supersedes: string | null;
  conflictsWith: string | null;
};

export type ValidatedAssertion = Omit<
  ProposedAssertion,
  "field" | "importance"
> & {
  field: ProfileField;
  importance: number | null;
};

export type RejectedAssertion = {
  proposal: ProposedAssertion;
  reason: string;
};

const IMPORTANCE_WEIGHT: Record<Importance, number> = {
  low: 0.33,
  medium: 0.66,
  high: 1,
};

export function validateProposedAssertions(
  proposals: ProposedAssertion[],
  context: {
    /** IDs of the user's own messages in this batch; the only valid evidence. */
    citableMessageIds: ReadonlySet<string>;
    existingAssertionIds: ReadonlySet<string>;
    today: Date;
  },
): {
  accepted: ValidatedAssertion[];
  rejected: RejectedAssertion[];
  under18: boolean;
} {
  const accepted: ValidatedAssertion[] = [];
  const rejected: RejectedAssertion[] = [];
  let under18 = false;

  for (const proposal of proposals) {
    const reject = (reason: string) => rejected.push({ proposal, reason });
    const def = definitions[proposal.field];
    if (!def) {
      reject("unknown field");
      continue;
    }
    const schema = proposal.subject === "self" ? def.self : def.partner;
    if (!schema) {
      reject(`field does not apply to ${proposal.subject}`);
      continue;
    }
    let parsed = schema.safeParse(proposal.value);
    if (!parsed.success && typeof proposal.value === "string") {
      // Models sometimes return a single option where the field takes a list.
      const wrapped = schema.safeParse([proposal.value]);
      if (wrapped.success) parsed = wrapped;
    }
    if (!parsed.success) {
      reject(`invalid value: ${parsed.error.issues[0]?.message ?? "invalid"}`);
      continue;
    }
    const explicitOnly = def.group !== "compatibility" || def.explicitOnly;
    if (explicitOnly && proposal.status === "inferred") {
      reject("field must be stated explicitly");
      continue;
    }
    const evidence = [...new Set(proposal.evidence)];
    if (
      evidence.length === 0 ||
      evidence.some((id) => !context.citableMessageIds.has(id))
    ) {
      reject("evidence must cite the user's own new messages");
      continue;
    }
    if (
      proposal.field === "birth_date" &&
      ageOn(parsed.data as string, context.today) < 18
    ) {
      under18 = true;
    }

    const isPartner = proposal.subject === "desired_partner";
    accepted.push({
      subject: proposal.subject,
      field: proposal.field as ProfileField,
      value: parsed.data,
      status: proposal.status,
      importance: isPartner
        ? IMPORTANCE_WEIGHT[proposal.importance ?? "medium"]
        : null,
      proposedHardConstraint:
        isPartner &&
        proposal.status === "explicit" &&
        proposal.proposedHardConstraint,
      evidence,
      supersedes: knownId(proposal.supersedes, context.existingAssertionIds),
      conflictsWith: knownId(
        proposal.conflictsWith,
        context.existingAssertionIds,
      ),
    });
  }

  return { accepted, rejected, under18 };
}

function knownId(id: string | null, known: ReadonlySet<string>) {
  return id && known.has(id) ? id : null;
}

function ageOn(isoDate: string, today: Date): number {
  const born = new Date(`${isoDate}T00:00:00Z`);
  let age = today.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < born.getUTCMonth() ||
    (today.getUTCMonth() === born.getUTCMonth() &&
      today.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}
