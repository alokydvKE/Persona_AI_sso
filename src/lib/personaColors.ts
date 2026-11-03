/**
 * Maps the backend's persona "color" words (green, blue, orange, purple, red,
 * teal — see PALETTE in persona_service.py) to Tailwind utility classes used to
 * render speaker chips/avatars in group chat.
 */
export type PersonaColorStyle = {
  /** Avatar / dot background + foreground. */
  avatar: string;
  /** Small chip background + text + ring. */
  chip: string;
  /** Speaker-name text colour. */
  text: string;
};

const COLOR_STYLES: Record<string, PersonaColorStyle> = {
  green: {
    avatar: "bg-emerald-100 text-emerald-700",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    text: "text-emerald-700",
  },
  blue: {
    avatar: "bg-sky-100 text-sky-700",
    chip: "bg-sky-50 text-sky-700 ring-sky-200",
    text: "text-sky-700",
  },
  orange: {
    avatar: "bg-orange-100 text-orange-700",
    chip: "bg-orange-50 text-orange-700 ring-orange-200",
    text: "text-orange-700",
  },
  purple: {
    avatar: "bg-violet-100 text-violet-700",
    chip: "bg-violet-50 text-violet-700 ring-violet-200",
    text: "text-violet-700",
  },
  red: {
    avatar: "bg-rose-100 text-rose-700",
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
    text: "text-rose-700",
  },
  teal: {
    avatar: "bg-teal-100 text-teal-700",
    chip: "bg-teal-50 text-teal-700 ring-teal-200",
    text: "text-teal-700",
  },
};

const FALLBACK: PersonaColorStyle = {
  avatar: "bg-slate-100 text-slate-700",
  chip: "bg-slate-50 text-slate-700 ring-slate-200",
  text: "text-slate-700",
};

export function personaColorStyle(color: string | undefined): PersonaColorStyle {
  if (!color) return FALLBACK;
  return COLOR_STYLES[color.toLowerCase()] ?? FALLBACK;
}

export function personaInitials(name: string | null | undefined): string {
  if (!name) return "P";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "P";
}
