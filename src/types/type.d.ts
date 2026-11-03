
declare type file = {
    id: string;
    title: string;
}

declare type RoleT = {
    id: string,
    title: string,
    description: string,
    icon: React.ElementType,
    features: string[],
}

declare type ResponseHeader = {
  code: number;
  message: string;
};

/** Pagination block shared by the chat-history endpoints (mirrors projects listing). */
declare type Pagination = {
  total: number;
  limit: number;
  offset: number;
  total_pages: number;
  current_page: number;
};

declare type MessageT = {
    id: string;
    message: string;
    userType: "User" | "Assistant"
}

/** User LLM/AI settings (POST /v1/setting/get|save|reset). */
declare type AppSettings = {
    scenario_mode: "optimistic" | "realistic" | "pessimistic";
    time_horizon: "1_year" | "3_years" | "5_years" | "10_years";
    industry: string | null;
    domain: string | null;
    assumptions: string[];
    show_confidence_scores: boolean;
    show_data_badges: boolean;
    auto_expand_details: boolean;
}

/** Demographics block produced by the persona-builder agent. */
declare type PersonaDemographics = {
    age_group?: string | null;
    gender?: string | null;
    ethnicity?: string | null;
    income?: string | null;
    marital_status?: string | null;
    country?: string | null;
    primary_shopper_household?: string | null;
}

/** A persona as returned by POST /v1/persona/list. */
declare type PersonaListItem = {
    persona_id: string;
    persona_name: string | null;
    coverage: number;
    confidence: string;
    status: string;
    // Persona-builder agent output (null for data-file generated personas).
    persona_index?: number | null;
    industry?: string | null;
    category?: string | null;
    sub_category_id?: string | null;
    micro_category?: string[] | null;
    construct_ids?: string[] | null;
    role_type_ids?: string[] | null;
    timeframe_ids?: string[] | null;
    entity_scope_ids?: string[] | null;
    theme_ids?: string[] | null;
    profile_ids?: string[] | null;
    demographics?: PersonaDemographics | null;
    // Dataset the persona was built from (master when built before this existed).
    data_source?: import("@/api/Chat/query").DataSourceKey | null;
}

/** A participant of a group chat (POST /v1/persona/group-chat/participants). */
declare type GroupParticipant = {
    persona_id: string;
    persona_name: string;
    color: string;
    active: boolean;
}

/**
 * One assumption applied to a group chat — a statement every persona treats as
 * true when replying (POST /v1/persona/group-chat/assumptions/*).
 *
 * Only applied assumptions exist server-side; suggestions are never stored, so
 * anything with an `assumption_id` is live. `source` records whether the wording
 * came from the model or the user, and `reason` is the validator's one-line
 * explanation.
 */
declare type GroupAssumption = {
    assumption_id: string;
    text: string;
    source: "suggested" | "manual";
    reason: string | null;
    created_at: string | null;
}

/**
 * A proposal from /assumptions/suggest. It has no id because nothing was stored:
 * `token` is a signature proving the API authored this text, and sending it back
 * with the text is what applies it without a second validation pass. Held in
 * component state for as long as it is on screen.
 */
declare type AssumptionSuggestion = {
    text: string;
    reason: string | null;
    token: string;
}

/**
 * Result of submitting an assumption. A rejection is a successful call with a
 * negative verdict, so it arrives here rather than as an error: `reason` says
 * why, and `suggested_assumption` — with its own `suggested_token` — is a valid
 * replacement the user can apply in one click.
 */
declare type AssumptionVerdict =
    | { status: "approved"; assumption: GroupAssumption }
    | {
        status: "rejected";
        text: string;
        reason: string;
        suggested_assumption: string | null;
        suggested_token: string | null;
    }

/** A single rendered group-chat message. */
declare type GroupMessageT = {
    id: string;
    /** "system" is one reply for the whole group rather than from a persona —
     * the fallback when the personas can't answer (off-topic question, missing
     * or unusable image). */
    role: "user" | "persona" | "system";
    message: string;
    /** The replying persona (persona messages only). Matches a participant's
     * `persona_id`, which is what "Reply" targets the composer at. */
    persona_id?: string;
    persona_name?: string;
    evidence_tags?: string[];
    /** Per-answer confidence for a persona reply: level ("strong"/"medium"/"weak")
     * and a 0-100 score. Rendered as a badge; absent on user + fallback messages. */
    confidence_level?: string | null;
    confidence_score?: number | null;
    /** True while an optimistic message is awaiting its server reply. */
    pending?: boolean;
    /** Images attached to a user turn. `url` is a local object URL for the
     * current session (server-side display URLs are not wired up yet). */
    images?: { url: string; name: string }[];
}