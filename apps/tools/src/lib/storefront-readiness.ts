export type LocalizationEvidenceState = "verified" | "unknown";

export type LocalizationEvidence = {
  state: LocalizationEvidenceState;
  detail: string;
  source: "public_store_snapshot" | null;
  observedAt: string | null;
};

export type StorefrontReadinessInput = {
  country: string;
  appWideLanguages?: string[] | null;
  legacyMetadataLocalised?: boolean;
  legacyScreenshotsLocalised?: boolean;
  legacyNotes?: string | null;
  metadataSnapshot?: {
    country: string;
    locale: string | null;
    capturedAt: string;
    name: string | null;
    description: string | null;
    screenshotUrls: unknown;
    source: string | null;
  } | null;
};

export type StorefrontLocalizationAssessment = {
  metadataLocale: string | null;
  metadataEvidence: LocalizationEvidence;
  screenshotEvidence: LocalizationEvidence;
  appLanguageEvidence: LocalizationEvidence;
  readiness: "Localization evidence verified" | "Localization evidence partial" | "Localization evidence unknown";
};

const normalizeCountry = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
const normalizeLocale = (value: string | null | undefined) => {
  const raw = (value ?? "").trim().replaceAll("_", "-");
  const match = raw.match(/^([A-Za-z]{2,3})-([A-Za-z]{2})$/);
  return match ? `${match[1].toLowerCase()}-${match[2].toUpperCase()}` : null;
};

const unknown = (detail: string): LocalizationEvidence => ({
  state: "unknown",
  detail,
  source: null,
  observedAt: null,
});

export function assessStorefrontLocalization(input: StorefrontReadinessInput): StorefrontLocalizationAssessment {
  const country = normalizeCountry(input.country);
  const snapshot = input.metadataSnapshot;
  const exactCountrySnapshot = snapshot
    && normalizeCountry(snapshot.country) === country
    && snapshot.source === "public_store"
    ? snapshot
    : null;
  const metadataLocale = normalizeLocale(exactCountrySnapshot?.locale);
  const hasMetadata = Boolean(metadataLocale && exactCountrySnapshot?.name?.trim() && exactCountrySnapshot?.description?.trim());
  const screenshotUrls = metadataLocale && Array.isArray(exactCountrySnapshot?.screenshotUrls)
    ? exactCountrySnapshot.screenshotUrls.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    : [];

  const metadataEvidence: LocalizationEvidence = hasMetadata
    ? {
        state: "verified",
        detail: `Exact-country public-store listing captured for ${country.toUpperCase()} in ${metadataLocale}.`,
        source: "public_store_snapshot",
        observedAt: exactCountrySnapshot?.capturedAt ?? null,
      }
    : unknown(
        input.legacyMetadataLocalised
          ? "A legacy localization flag exists, but it has no evidence source or verification time."
          : exactCountrySnapshot && !metadataLocale
            ? "An exact-country metadata snapshot is stored, but its App Store locale is Unknown."
            : "No exact-country metadata snapshot is stored.",
      );

  const screenshotEvidence: LocalizationEvidence = screenshotUrls.length
    ? {
        state: "verified",
        detail: `${screenshotUrls.length} screenshot${screenshotUrls.length === 1 ? "" : "s"} captured in an exact-country public-store snapshot.`,
        source: "public_store_snapshot",
        observedAt: exactCountrySnapshot?.capturedAt ?? null,
      }
    : unknown(
        input.legacyScreenshotsLocalised
          ? "A legacy screenshot flag exists, but no exact-country screenshot evidence is stored."
          : "No exact-country screenshot evidence is stored.",
      );

  const appLanguageEvidence = unknown(
    input.appWideLanguages?.length
      ? "The recorded language list is app-wide and cannot verify the language available in this market."
      : "No storefront-specific in-app language evidence is stored.",
  );

  const verifiedCount = [metadataEvidence, screenshotEvidence, appLanguageEvidence].filter((evidence) => evidence.state === "verified").length;
  const readiness = verifiedCount === 3
    ? "Localization evidence verified"
    : verifiedCount > 0
      ? "Localization evidence partial"
      : "Localization evidence unknown";

  return { metadataLocale, metadataEvidence, screenshotEvidence, appLanguageEvidence, readiness };
}
