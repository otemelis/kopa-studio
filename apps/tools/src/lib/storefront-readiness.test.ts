import { describe, expect, it } from "vitest";
import gbProductionFixture from "./fixtures/gb-storefront-readiness.json";
import { assessStorefrontLocalization } from "./storefront-readiness";

const gbSnapshot = {
  country: "gb",
  locale: "en-GB",
  capturedAt: "2026-07-29T10:00:00.000Z",
  name: "InnerType Personality Test",
  description: "A personality test.",
  screenshotUrls: ["https://example.com/gb-1.png"],
  source: "public_store",
};

describe("storefront localization evidence", () => {
  it("does not infer GB app language from an app-wide English language", () => {
    const assessment = assessStorefrontLocalization(gbProductionFixture);
    expect(assessment.appLanguageEvidence).toMatchObject({ state: "unknown", source: null });
    expect(assessment.readiness).toBe("Localization evidence unknown");
  });

  it("does not treat market activity as localization evidence", () => {
    expect(gbProductionFixture.activity).toEqual({ trackedKeywords: 9, appStoreConnectRows: 7, appleAdsCampaigns: 1 });
    const assessment = assessStorefrontLocalization(gbProductionFixture);
    expect([
      assessment.metadataEvidence.state,
      assessment.screenshotEvidence.state,
      assessment.appLanguageEvidence.state,
    ]).toEqual(["unknown", "unknown", "unknown"]);
  });

  it("does not treat legacy flags or free-text notes as verified evidence", () => {
    const assessment = assessStorefrontLocalization({
      country: "gb",
      legacyMetadataLocalised: true,
      legacyScreenshotsLocalised: true,
      legacyNotes: "Screenshot UI localized. App language localized.",
    });
    expect(assessment.metadataEvidence.state).toBe("unknown");
    expect(assessment.screenshotEvidence.state).toBe("unknown");
    expect(assessment.appLanguageEvidence.state).toBe("unknown");
  });

  it("verifies only exact-country metadata and screenshot snapshots", () => {
    const assessment = assessStorefrontLocalization({ country: "gb", metadataSnapshot: gbSnapshot });
    expect(assessment.metadataEvidence).toMatchObject({ state: "verified", source: "public_store_snapshot", observedAt: gbSnapshot.capturedAt });
    expect(assessment.screenshotEvidence).toMatchObject({ state: "verified", source: "public_store_snapshot", observedAt: gbSnapshot.capturedAt });
    expect(assessment.appLanguageEvidence.state).toBe("unknown");
    expect(assessment.readiness).toBe("Localization evidence partial");
  });

  it("keeps exact-country metadata Unknown when its listing locale is unavailable", () => {
    const assessment = assessStorefrontLocalization({
      country: "gb",
      legacyMetadataLocalised: true,
      legacyScreenshotsLocalised: true,
      metadataSnapshot: { ...gbSnapshot, locale: null },
    });
    expect(assessment.metadataLocale).toBeNull();
    expect(assessment.metadataEvidence).toMatchObject({ state: "unknown", source: null });
    expect(assessment.metadataEvidence.detail).toContain("locale is Unknown");
    expect(assessment.screenshotEvidence.state).toBe("unknown");
    expect(assessment.screenshotEvidence.detail).toContain("locale is Unknown");
  });

  it("keeps storefront evidence isolated", () => {
    const assessment = assessStorefrontLocalization({ country: "de", metadataSnapshot: gbSnapshot });
    expect(assessment.metadataEvidence.state).toBe("unknown");
    expect(assessment.screenshotEvidence.state).toBe("unknown");
  });

  it("requires a supported source before verifying a snapshot", () => {
    const assessment = assessStorefrontLocalization({ country: "gb", metadataSnapshot: { ...gbSnapshot, source: "manual" } });
    expect(assessment.metadataEvidence.state).toBe("unknown");
    expect(assessment.screenshotEvidence.state).toBe("unknown");
  });

  it("does not verify screenshots from an empty exact-country snapshot", () => {
    const assessment = assessStorefrontLocalization({
      country: "gb",
      metadataSnapshot: { ...gbSnapshot, screenshotUrls: [] },
    });
    expect(assessment.metadataEvidence.state).toBe("verified");
    expect(assessment.screenshotEvidence.state).toBe("unknown");
  });
});
