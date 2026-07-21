export type AppleAdsStatusTone = "good" | "bad" | "neutral";

export type AppleAdsDisplayStatus = {
  label: string;
  tone: AppleAdsStatusTone;
};

const normalize = (value: string | null | undefined) => (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");

const humanize = (value: string | null | undefined) => {
  const normalized = normalize(value);
  if (!normalized || normalized === "UNKNOWN") return "Unknown";
  return normalized
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export function formatAppleAdsEntityStatus(value: string | null | undefined): AppleAdsDisplayStatus {
  switch (normalize(value)) {
    case "ACTIVE":
    case "ENABLED":
    case "RUNNING":
      return { label: "Enabled", tone: "good" };
    case "PAUSED":
      return { label: "Paused", tone: "bad" };
    case "DELETED":
    case "REMOVED":
      return { label: "Removed", tone: "bad" };
    case "DRAFT":
      return { label: "Draft", tone: "neutral" };
    default:
      return { label: humanize(value), tone: "neutral" };
  }
}

export function formatAppleAdsDeliveryStatus(value: string | null | undefined): AppleAdsDisplayStatus {
  switch (normalize(value)) {
    case "RUNNING":
      return { label: "Delivering", tone: "good" };
    case "NOT_RUNNING":
      return { label: "Not delivering", tone: "neutral" };
    case "PAUSED":
      return { label: "Paused", tone: "bad" };
    case "SCHEDULED":
      return { label: "Scheduled", tone: "neutral" };
    case "ENDED":
      return { label: "Ended", tone: "neutral" };
    default:
      return { label: humanize(value), tone: "neutral" };
  }
}

export const appleAdsStatusClass = (status: AppleAdsDisplayStatus) => `badge ${status.tone}`;
