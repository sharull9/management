"use client";
import { createContext, useContext } from "react";

/** Closes the nearest sheet or dialog; forms call it after a successful save. */
export const OverlayCloseContext = createContext<(() => void) | null>(null);

export function useCloseOverlay() {
  return useContext(OverlayCloseContext);
}
