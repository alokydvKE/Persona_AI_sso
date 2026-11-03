import { Briefcase, Building2 } from "lucide-react";

export const Roles = [
  {
    id: "brand_representative" as const,
    title: "Brand Representative",
    description:
      "You represent a brand or company and want to create AI personas based on your consumer research data to gain strategic insights.",
    icon: Building2,
    features: ["Upload proprietary survey data", "Create brand-specific personas", "Get competitive insights"],
  },
  {
    id: "consultant" as const,
    title: "Consultant",
    description:
      "You advise multiple brands and want to leverage AI personas across different client projects for data-driven recommendations.",
    icon: Briefcase,
    features: ["Manage multi-client projects", "Cross-industry analysis", "Exportable persona reports"],
  },
]