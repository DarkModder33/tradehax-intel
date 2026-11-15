"use client";

import { useCallback, useState } from "react";
import { publishPopoutPrefs } from "@/lib/popout/live-prefs";
import { openFallbackWindow, pictureInPictureApi, pictureInPictureSupported, preparePipDocument } from "@/lib/popout/pip";
import type { PopoutPrefs } from "@/lib/popout/prefs";

export function useBreakaway() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  const open = useCallback(async (prefs: PopoutPrefs) => {
    const next = publishPopoutPrefs(prefs);

    const api = pictureInPictureApi();
    if (api) {
      try {
        const existing = api.window;
        if (existing && !existing.closed) {
          existing.focus();
          setPipWindow(existing);
          return "pip" as const;
        }
        const child = await api.requestWindow({ width: 360, height: 520 });
        preparePipDocument(child);
        const onHide = () => {
          setPipWindow((current) => (current === child ? null : current));
          child.removeEventListener("pagehide", onHide);
        };
        child.addEventListener("pagehide", onHide);
        setPipWindow(child);
        return "pip" as const;
      } catch {
        // The gesture was dismissed, or this browser has no always-on-top window.
      }
    }

    openFallbackWindow(next);
    return "window" as const;
  }, []);

  return { pipWindow, open, pipSupported: pictureInPictureSupported() };
}
