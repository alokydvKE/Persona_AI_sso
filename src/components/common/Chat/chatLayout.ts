/**
 * The centred column every piece of a chat view sits in — messages, composer,
 * loaders and notices — so they always line up. Change the chat width here and
 * nowhere else.
 *
 * Kept as one literal class string so Tailwind's source scan picks it up.
 */
export const CHAT_COLUMN = "mx-auto w-full max-w-4xl";

/**
 * Side padding of the column's full-width blocks — the composer, the
 * "chat has ended" bar and the persona-build card — so their edges line up.
 */
export const CHAT_INSET = "px-3 md:px-5";
