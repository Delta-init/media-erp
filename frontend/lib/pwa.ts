"use client";

/**
 * PWA install support — platform detection + per-browser install instructions.
 *
 * Only Chromium browsers fire `beforeinstallprompt`, which is the only way to
 * trigger a *native* install dialog. Every other engine (Safari, Firefox) can
 * still install a PWA, but the user has to do it from a browser menu — so we
 * detect the platform and show the exact steps instead.
 *
 * Hard browser rules that no code can work around:
 *   • A service worker (and therefore install) requires a **secure context**:
 *     `https://` or `localhost`. A plain-http LAN IP (http://192.168.x.x) will
 *     never be installable — `navigator.serviceWorker` isn't even defined.
 */

export type InstallPlatform =
  | "ios"
  | "android-chromium"
  | "samsung"
  | "firefox-android"
  | "desktop-chromium"
  | "safari-desktop"
  | "firefox-desktop"
  | "other";

export interface InstallGuide {
  /** True when the browser can show a real native install dialog. */
  canNativePrompt: boolean;
  label: string;
  steps: string[];
  /** Set when the browser cannot install a PWA at all. */
  unsupported?: boolean;
}

/** Already running as an installed app? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * iOS **and** iPadOS.
 *
 * iPadOS 13+ reports a desktop UA ("Macintosh …"), so a plain
 * /iphone|ipad|ipod/ test misses every modern iPad. Touch points disambiguate
 * an iPad from a real Mac.
 */
export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  if ((window as unknown as { MSStream?: unknown }).MSStream) return false;
  const classic = /iphone|ipad|ipod/i.test(ua);
  const iPadOS13Plus = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return classic || iPadOS13Plus;
}

export function detectPlatform(): InstallPlatform {
  if (typeof window === "undefined") return "other";
  const ua = navigator.userAgent;

  if (isIOS()) return "ios";

  const isAndroid = /android/i.test(ua);
  const isFirefox = /firefox|fxios/i.test(ua);
  const isSamsung = /samsungbrowser/i.test(ua);
  // Chrome/Edge/Brave/Opera all report "Chrome" and are not Safari-only.
  const isChromium = /chrome|chromium|crios|edg(a|ios|e)?\//i.test(ua) && !isFirefox;
  const isSafari = /safari/i.test(ua) && !isChromium && !isFirefox;

  if (isAndroid) {
    if (isSamsung) return "samsung";
    if (isFirefox) return "firefox-android";
    if (isChromium) return "android-chromium";
    return "other";
  }
  if (isFirefox) return "firefox-desktop";
  if (isChromium) return "desktop-chromium";
  if (isSafari) return "safari-desktop";
  return "other";
}

/** Instructions for a platform. `hasNativePrompt` short-circuits to the button. */
export function getInstallGuide(
  platform: InstallPlatform,
  hasNativePrompt: boolean
): InstallGuide {
  if (hasNativePrompt) {
    return {
      canNativePrompt: true,
      label: "Install this app for quick access and offline use.",
      steps: [],
    };
  }

  switch (platform) {
    case "ios":
      return {
        canNativePrompt: false,
        label: "Add mediaERP to your Home Screen:",
        steps: [
          "Tap the Share button in Safari’s toolbar",
          "Scroll down and tap “Add to Home Screen”",
          "Tap “Add” to confirm",
        ],
      };
    case "android-chromium":
      return {
        canNativePrompt: false,
        label: "Install from Chrome’s menu:",
        steps: [
          "Tap the ⋮ menu (top-right)",
          "Tap “Install app” or “Add to Home screen”",
          "Confirm to install",
        ],
      };
    case "samsung":
      return {
        canNativePrompt: false,
        label: "Install from Samsung Internet:",
        steps: [
          "Tap the ☰ menu",
          "Tap “Add page to” → “Home screen”",
          "Confirm to install",
        ],
      };
    case "firefox-android":
      return {
        canNativePrompt: false,
        label: "Install from Firefox’s menu:",
        steps: ["Tap the ⋮ menu", "Tap “Install” or “Add to Home screen”"],
      };
    case "desktop-chromium":
      return {
        canNativePrompt: false,
        label: "Install from the address bar:",
        steps: [
          "Click the install icon (⊕ / monitor) at the right of the address bar",
          "Or open the ⋮ menu → “Cast, save and share” → “Install page as app”",
        ],
      };
    case "safari-desktop":
      return {
        canNativePrompt: false,
        label: "Add mediaERP to your Dock:",
        steps: ["Open the File menu", "Choose “Add to Dock…”", "Click “Add”"],
      };
    case "firefox-desktop":
      return {
        canNativePrompt: false,
        unsupported: true,
        label: "Firefox on desktop can’t install web apps.",
        steps: ["Open mediaERP in Chrome, Edge or Safari to install it."],
      };
    default:
      return {
        canNativePrompt: false,
        label: "Install from your browser’s menu:",
        steps: ["Look for “Install app” or “Add to Home screen”."],
      };
  }
}

/**
 * Why the browser can't offer a native install right now — used to give the
 * user (and us) an honest answer instead of a silent no-op.
 */
export function getInstallBlockers(): string[] {
  if (typeof window === "undefined") return [];
  const out: string[] = [];
  if (!window.isSecureContext) {
    out.push(
      "This page isn’t served over HTTPS. Browsers only allow installing from https:// or localhost."
    );
  }
  if (!("serviceWorker" in navigator)) {
    out.push("This browser doesn’t support service workers, which are required to install.");
  }
  if (isStandalone()) out.push("The app is already installed.");
  return out;
}
