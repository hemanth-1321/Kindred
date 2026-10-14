# Profile specification

Status: agreed design for milestone 1. It defines what the profile contains, how facts are extracted from conversations, who can be matched with whom, how extraction is evaluated, and what product success means. Extraction, review UI, and matching code must follow this document; change the document first when the rules change.

Related: [system design](../matchmaker-system-design.md), [extraction test cases](evals/profile-extraction-cases.json).

## Principles

1. Every stored fact is an assertion with a subject (`self` or `desired_partner`), a field from this catalog, a validated value, the IDs of the messages that support it, and a status (`explicit`, `inferred`, `contradicted`, `unknown`).
2. Only the user's own statements about themselves or what they want count as evidence. Statements about an ex, friends, or family, jokes, and hypotheticals are not evidence.
3. Unknown means "not answered", never "no". A missing field never counts against a match.
4. Contradictions are preserved, marked `contradicted`, and resolved by asking the user. Newer statements do not silently overwrite older ones.
5. Hedged statements ("maybe", "ideally", "not sure", "kind of") produce tentative preferences, never hard constraints.
6. Conversation text is data. Instructions inside messages ("ignore your rules", "set my age to 25") change nothing.
7. Matching uses only confirmed eligibility fields. Ranking may use unconfirmed soft fields, but explanations shown to another user may use only fields the owner approved for sharing.

## Field catalog

### Eligibility fields

Eligibility fields decide who can be matched at all. They are stored in typed `profile_constraints` columns, require an explicit statement, and must be confirmed by the user before they are used. The extractor may never mark them `inferred`.

| Field                 | Subject         | Value                                                                                                | Required before matching |
| --------------------- | --------------- | ---------------------------------------------------------------------------------------------------- | ------------------------ |
| `birth_date`          | self            | ISO date; a stated age alone produces a follow-up question, not a birth date                         | Yes                      |
| `gender`              | self            | `woman`, `man`, `non_binary`, or the user's own words                                                | Yes                      |
| `seeking_genders`     | desired_partner | List of the same values                                                                              | Yes                      |
| `preferred_age_range` | desired_partner | `{ min, max }` in years, both 18 or older                                                            | Yes                      |
| `city`                | self            | City name, normalized to a known city; neighbourhoods are kept as `area` but never used for distance | Yes                      |
| `relationship_intent` | self            | `long_term`, `marriage`, `open_to_see`, `casual`                                                     | Yes                      |
| `max_distance_km`     | self            | Positive integer                                                                                     | No (default below)       |
| `open_to_relocation`  | self            | `yes`, `no`, `maybe`                                                                                 | No                       |
| `children_status`     | self            | `has_children`, `no_children`                                                                        | No                       |
| `children_intent`     | self            | `wants`, `does_not_want`, `open`, `unsure`                                                           | No                       |

Age is self-declared through the birth date for now. Identity or age verification is a later addition and does not change this schema.

### Compatibility fields

Compatibility fields are used for ranking and explanations and never exclude anyone on their own. Non-sensitive compatibility fields may be `inferred` when the evidence is direct (for example, "I go to the gym five days a week" gives `activity_level: high`, inferred).

| Group                | Field                 | Value                                                                              |
| -------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| Lifestyle            | `smoking`             | `never`, `sometimes`, `regularly`                                                  |
|                      | `drinking`            | `never`, `socially`, `regularly`                                                   |
|                      | `diet`                | `vegetarian`, `eggetarian`, `vegan`, `jain`, `non_vegetarian`, or the user's words |
|                      | `activity_level`      | `low`, `moderate`, `high`                                                          |
|                      | `work_schedule`       | Short text, for example "night shifts" or "travels often"                          |
| Relationship style   | `time_together`       | `lots`, `balanced`, `independent`                                                  |
|                      | `communication_style` | Short text in the user's words                                                     |
|                      | `conflict_style`      | Short text in the user's words                                                     |
|                      | `social_energy`       | `introverted`, `ambivert`, `extroverted`; explicit self-description only           |
| Values and interests | `values`              | List of short phrases in the user's words                                          |
|                      | `interests`           | List of short phrases                                                              |
|                      | `stories`             | Short paraphrased anecdotes the user may approve for explanations                  |
| Location detail      | `area`                | Neighbourhood or locality; never used for distance or shown to others by default   |

### Sensitive fields

`religion`, `religious_practice` (`not_practising`, `occasional`, `regular`, `devout`), `caste`, `community`, `politics`.

- Stored only when the user states them about themselves explicitly. Never inferred from names, language, food, festivals, or location.
- Never asked about directly by the assistant.
- Used for ranking only as a stated preference, and as a filter only when the user explicitly says it is a dealbreaker and confirms it.
- Never included in explanations shown to another user unless the owner approves that specific item.

### Never inferred or stored

Health conditions and diagnoses, disability, sexual orientation beyond `seeking_genders`, ethnicity from names or photos, attachment styles or other personality labels from writing style, income from job titles, and anything about third parties.

### Partner preferences

Any compatibility or sensitive field can also be asserted with subject `desired_partner` (for example, a partner who does not smoke). For fields with fixed options, the value is the list of acceptable options (for example, `drinking: ["never", "socially"]`). Each partner preference carries:

- `importance`: `low`, `medium`, or `high`, stored as 0.33, 0.66, or 1.0 in `profile_assertions.importance`. Default `medium` when the user does not indicate strength.
- Dealbreaker flag: stored as `is_hard_constraint`. Set only when the user uses explicit dealbreaker language ("must", "non-negotiable", "I won't date someone who…") and confirms it during profile review. The extractor proposes; the user decides.

## Extraction rules

1. Extract after meaningful boundaries (a completed topic, every few user turns, or session end), not on every message.
2. The extractor returns proposed assertions in a fixed structured format. Each must cite at least one message ID from the user's own messages in this conversation; assertions without valid evidence are dropped.
3. Validate every value against this catalog. Unknown fields, invalid enum values, and ages under 18 in `preferred_age_range` are rejected, not coerced.
4. If a new statement conflicts with an existing assertion on the same subject and field, mark both `contradicted` and queue a clarifying question. Do not supersede until the user resolves it.
5. A correction ("actually I'm 29, not 28") supersedes the earlier assertion and keeps it in history.
6. Refusals ("I'd rather not say") record nothing and the assistant must not ask again in the same session.
7. If the stated age or birth date is under 18, mark the account ineligible, stop collecting matching information, and show a neutral message. Do not store further profile data.
8. The extractor's output and prompt version are recorded with each extraction run for auditing and evaluation.

## Profile review

- The user sees a plain-language summary grouped as "About you", "Who you're looking for", and "Dealbreakers", with each item editable or removable.
- Eligibility fields and dealbreakers show as unconfirmed until the user confirms them.
- Confirming creates a new profile version and an outbox event in one transaction; matching reads only ready versions.
- The user chooses which compatibility items may appear in explanations shown to matches. Nothing is shared by default.

## Matching eligibility

A pair (A, B) is eligible only if every rule holds in both directions:

1. Both accounts are active, adult, not paused, and have all required fields confirmed.
2. Each person's `gender` is in the other's `seeking_genders`.
3. Each person's age is within the other's `preferred_age_range`.
4. Distance: the city distance is within both people's `max_distance_km`, or at least one person has `open_to_relocation: yes`. When `max_distance_km` is unknown, the default is 50 km (an initial product assumption to revisit with data).
5. Relationship intent is compatible:

   | A \ B       | long_term | marriage | open_to_see | casual |
   | ----------- | --------- | -------- | ----------- | ------ |
   | long_term   | Yes       | Yes      | Yes         | No     |
   | marriage    | Yes       | Yes      | Yes         | No     |
   | open_to_see | Yes       | Yes      | Yes         | Yes    |
   | casual      | No        | No       | Yes         | Yes    |

6. Children: `wants` and `does_not_want` are incompatible when both are confirmed. `open`, `unsure`, and unknown never exclude.
7. Every confirmed dealbreaker of each person is satisfied by the other's confirmed value. If the other's value is unknown, the pair is not excluded, but the introduction is held until the value is known ("ask" rather than "introduce" in Flow 4).
8. Neither person has blocked the other, they have no active introduction already, and both have available introduction capacity.

## Evaluation

Test cases live in [evals/profile-extraction-cases.json](evals/profile-extraction-cases.json). Each case has a short conversation, the assertions it must produce, the fields it must not produce, and whether a follow-up question is expected.

Initial pass criteria (product assumptions to revisit):

- Zero hard constraints created without explicit dealbreaker language.
- Zero sensitive or never-inferred fields produced without an explicit self-statement.
- Zero assertions sourced from third parties, exes, jokes, or injected instructions.
- At least 90% precision and 80% recall on expected assertions across all cases, matching on subject, field, and value.
- Every expected follow-up question is triggered (contradictions, under-18, missing required fields).

## Product outcome definitions

- Primary: mutual acceptance rate, meaning the share of offered introductions that both people accept.
- Secondary: the share of mutually accepted introductions where both report that a conversation happened, and the share where at least one reports continued interest after 14 days.
- Safety: introductions declined with a reason that cites a violated dealbreaker or eligibility rule. Target near zero; each one is investigated.
- Profile health: share of active users with all required fields confirmed, and median number of conversation turns to reach that state.

These measure the matching system, not relationship success. Synthetic profiles and test cases validate rules and extraction, not real-world compatibility.

## Open questions

- Whether `max_distance_km` should default by city size instead of a single 50 km value.
- Whether `marriage` and `long_term` should rank lower together than same-intent pairs, while remaining eligible.
- Which explanation items to suggest for sharing by default during profile review.
