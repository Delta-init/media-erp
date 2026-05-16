import type { ConnectorPlatform } from "@/types/connector";

export interface PlatformMeta {
  label: string;
  description: string;
  initials: string;
  bgClass: string;
}

export const PLATFORM_META: Record<ConnectorPlatform, PlatformMeta> = {
  google_ads: {
    label: "Google Ads",
    description: "Search, display & YouTube campaigns",
    initials: "G",
    bgClass: "bg-blue-500",
  },
  ga4: {
    label: "Google Analytics 4",
    description: "Web & app analytics",
    initials: "GA",
    bgClass: "bg-orange-500",
  },
  facebook_ads: {
    label: "Facebook Ads",
    description: "Facebook & Instagram campaigns",
    initials: "f",
    bgClass: "bg-blue-700",
  },
  linkedin_ads: {
    label: "LinkedIn Ads",
    description: "B2B advertising campaigns",
    initials: "in",
    bgClass: "bg-sky-600",
  },
  tiktok_ads: {
    label: "TikTok Ads",
    description: "Short-form video campaigns",
    initials: "TT",
    bgClass: "bg-pink-500",
  },
  facebook_pages: {
    label: "Facebook Pages",
    description: "Publish posts & send Messenger DMs",
    initials: "FB",
    bgClass: "bg-blue-600",
  },
  instagram: {
    label: "Instagram (via Facebook)",
    description: "Requires a Facebook Page linked to an Instagram Business account",
    initials: "IG",
    bgClass: "bg-gradient-to-br from-purple-500 to-pink-500",
  },
  instagram_login: {
    label: "Instagram Direct",
    description: "Log in with Instagram directly — no Facebook Page required",
    initials: "IG✦",
    bgClass: "bg-gradient-to-br from-fuchsia-600 to-rose-500",
  },
};

export const CONNECTABLE_PLATFORMS: ConnectorPlatform[] = [
  "google_ads",
  "ga4",
  "facebook_ads",
  "facebook_pages",
  "instagram",          // via Facebook OAuth — requires linked Facebook Page
  "instagram_login",    // direct Instagram Business Login — no Facebook Page needed
  "linkedin_ads",
  "tiktok_ads",
];
