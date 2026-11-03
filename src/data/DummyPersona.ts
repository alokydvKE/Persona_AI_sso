export interface EvidenceItem {
    label: string
    value: string
}

export interface EvidenceCategory {
    category: string
    items: EvidenceItem[]
}

export interface PersonaDetail {
    title: string
    role: string
    confidence: "High" | "Med-High" | "Medium"
    matchedN: { study: string; n: number }[]
    coverage: number
    evidenceCategories: EvidenceCategory[]
}

export const PERSONA_DETAILS: PersonaDetail[] = [
    {
        title: "Clean Label Hydrators",
        role: "Health-Forward, Sugar-Avoidant, Trust-Sensitive",
        confidence: "High",
        coverage: 80,
        matchedN: [
            { study: "U&A", n: 260 },
            { study: "Price-Pack", n: 210 },
            { study: "Claims", n: 170 },
        ],
        evidenceCategories: [
            {
                category: "Appeal",
                items: [
                    { label: "Sugar reduction priority", value: "72%" },
                    { label: "Clean/natural ingredients matter", value: "68%" },
                ],
            },
            {
                category: "Taste",
                items: [
                    { label: "Avoid artificial taste/additives (top barrier)", value: "46%" },
                    { label: "Prefers light/crisp flavors", value: "61%" },
                ],
            },
            {
                category: "Trust / Ingredients",
                items: [
                    { label: "Ingredient list checkers", value: "65%" },
                    { label: "Wants proof/transparency for functional claims", value: "41%" },
                ],
            },
            {
                category: "Pack / Format",
                items: [
                    { label: "Prefers ready-to-drink", value: "62%" },
                    { label: "Mix-at-home preference", value: "18%" },
                ],
            },
            {
                category: "Price / Value",
                items: [
                    { label: "Buy mostly on deal", value: "34%" },
                    { label: "Willing to pay small premium for credible benefit", value: "38%" },
                ],
            },
            {
                category: "Occasions",
                items: [{ label: "Mid-day reset / post-light activity", value: "57%" }],
            },
        ],
    },
    {
        title: "Flavor & Fun Explorers",
        role: "Novelty-Driven, Variety-Seeking",
        confidence: "High",
        coverage: 83,
        matchedN: [
            { study: "U&A", n: 310 },
            { study: "Price-Pack", n: 260 },
            { study: "Claims", n: 200 },
        ],
        evidenceCategories: [
            {
                category: "Appeal",
                items: [
                    { label: "Enjoy trying new flavors", value: "76%" },
                    { label: "Tried a new beverage in last 30 days", value: "58%" },
                ],
            },
            {
                category: "Taste / Variety",
                items: [
                    { label: "Flavor variety is a top driver", value: "63%" },
                    { label: "Prefers carbonated drinks weekly+", value: "62%" },
                ],
            },
            {
                category: "Trust / Ingredients",
                items: [{ label: '"Very important" clean label', value: "29%" }],
            },
            {
                category: "Functional",
                items: [{ label: "Too technical/functional is a turn-off", value: "22%" }],
            },
            {
                category: "Price / Value",
                items: [{ label: "Buy on deal", value: "48%" }],
            },
            {
                category: "Pack / Format",
                items: [{ label: "Enjoys DIY/mix experiences", value: "44%" }],
            },
            {
                category: "Occasions",
                items: [{ label: "Social / on-the-go discovery", value: "64%" }],
            },
        ],
    },
    {
        title: "Value-First Routine Buyers",
        role: "Deal-Driven, Household Stock-Up Mindset",
        confidence: "Med-High",
        coverage: 78,
        matchedN: [
            { study: "U&A", n: 420 },
            { study: "Price-Pack", n: 360 },
            { study: "Claims", n: 240 },
        ],
        evidenceCategories: [
            {
                category: "Appeal",
                items: [
                    { label: "Price is #1/#2 driver", value: "74%" },
                    { label: "Needs clear value-per-serving", value: "57%" },
                ],
            },
            {
                category: "Price / Value",
                items: [{ label: "Buy mostly on deal", value: "71%" }],
            },
            {
                category: "Pack / Format",
                items: [
                    { label: "Multipack/family pack preference", value: "66%" },
                    { label: "Mix-at-home/concentrate buyers monthly+", value: "52%" },
                ],
            },
            {
                category: "Functional",
                items: [{ label: "Low willingness to pay premium for functional benefits", value: "22%" }],
            },
            {
                category: "Trust",
                items: [{ label: '"Sounds gimmicky/expensive" rejection trigger', value: "39%" }],
            },
            {
                category: "Occasions",
                items: [{ label: "At-home routine consumption", value: "69%" }],
            },
        ],
    },
]