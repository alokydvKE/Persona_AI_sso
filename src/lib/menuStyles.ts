/**
 * Shared look for the app's pick-one menus — the persona panel's sort and
 * data-source filter, and the group chat's recipient picker: a roomy one-line
 * list whose chosen row is tinted purple, with the check in the same colour.
 * The base items keep their own hover state; a chosen row stays purple even
 * while hovered.
 *
 * Kept as literal class strings so Tailwind's source scan picks them up.
 */
export const PICK_MENU = "min-w-56 rounded-xl p-1.5 shadow-lg";

export const PICK_ITEM =
  "gap-2 rounded-lg py-2 pl-2.5 pr-9 text-[13px] data-[state=checked]:bg-primary/[0.08] data-[state=checked]:font-medium data-[state=checked]:text-primary data-[state=checked]:focus:bg-primary/[0.12] data-[state=checked]:focus:text-primary data-[state=checked]:focus:**:text-primary";
