import { createContext } from "react";

/**
 * The top bar's slots a page can render into (see PageHeader.tsx). Null outside
 * the root layout, where page header content renders in place instead.
 */
export type PageHeaderSlots = {
  title: HTMLElement | null;
  actions: HTMLElement | null;
};

export const PageHeaderSlotsContext = createContext<PageHeaderSlots | null>(null);
