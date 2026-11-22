import { popoutPath, type PopoutPrefs } from "./prefs";

type PictureInPicture = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  window: Window | null;
};

export function pictureInPictureApi(): PictureInPicture | null {
  if (typeof window === "undefined") return null;
  const api = (window as Window & { documentPictureInPicture?: PictureInPicture }).documentPictureInPicture;
  return api?.requestWindow ? api : null;
}

export function pictureInPictureSupported(): boolean {
  return pictureInPictureApi() != null;
}

/** iOS has no Document Picture-in-Picture. Those browsers get a normal window. */
export function popoutMode(userAgent: string, hasApi: boolean): "pip" | "window" {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "window";
  return hasApi ? "pip" : "window";
}

/** Copy the desk styles into a Picture-in-Picture document so Tailwind classes resolve there. */
export function preparePipDocument(pipWindow: Window): void {
  const doc = pipWindow.document;
  doc.documentElement.className = document.documentElement.className;
  doc.documentElement.lang = "en";
  doc.body.className = document.body.className;
  doc.body.style.margin = "0";
  doc.body.style.background = "var(--background)";
  doc.body.style.color = "var(--foreground)";
  const title = doc.createElement("title");
  title.textContent = "TradeHax pop-out";
  doc.head.appendChild(title);

  for (const sheet of document.styleSheets) {
    try {
      const css = [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
      const style = doc.createElement("style");
      style.textContent = css;
      doc.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = doc.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        doc.head.appendChild(link);
      }
    }
  }
}

export function openFallbackWindow(prefs: PopoutPrefs): void {
  const url = new URL(popoutPath(prefs), window.location.origin).href;
  window.open(url, "tradehax-popout", "popup=yes,width=360,height=520,resizable=yes");
}
