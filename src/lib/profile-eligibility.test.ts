import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyEligibilityErrorMessage,
  checkJobEligibility,
  getApplySetupGaps,
  getProfileGaps,
  profileNeedsApplySetup,
  profileNeedsCompletion,
} from "./profile-eligibility";

function yearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

const readyProfile = {
  full_name: "Rahul",
  phone: "+919876543210",
  lat: 12.97,
  lng: 77.59,
  gender: "male" as const,
  date_of_birth: yearsAgo(22),
  work_type: "unskilled" as const,
};

describe("getApplySetupGaps", () => {
  it("requires name, phone, and location before apply", () => {
    const gaps = getApplySetupGaps({
      full_name: null,
      phone: null,
      lat: null,
      lng: null,
    });
    assert.deepEqual(
      gaps.map((g) => g.field),
      ["full_name", "phone", "location"],
    );
    assert.equal(
      profileNeedsApplySetup({
        full_name: null,
        phone: null,
        lat: null,
        lng: null,
      }),
      true,
    );
  });

  it("passes when essentials are present", () => {
    assert.equal(getApplySetupGaps(readyProfile).length, 0);
    assert.equal(profileNeedsApplySetup(readyProfile), false);
  });
});

describe("checkJobEligibility", () => {
  it("blocks apply when profile essentials are missing", () => {
    const result = checkJobEligibility(
      {
        full_name: null,
        phone: null,
        lat: null,
        lng: null,
        gender: null,
        date_of_birth: null,
        work_type: null,
      },
      { gender_preference: "any", skilled: false },
      { setupHref: "/onboarding?returnTo=/job" },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "profile_incomplete");
      assert.ok(result.fixHref?.includes("/onboarding"));
    }
  });

  it("allows apply when profile is complete and not conflicting", () => {
    const result = checkJobEligibility(readyProfile, {
      gender_preference: "any",
      skilled: false,
    });
    assert.equal(result.ok, true);
  });

  it("blocks under-18 when date of birth is known", () => {
    const result = checkJobEligibility(
      {
        ...readyProfile,
        date_of_birth: yearsAgo(16),
      },
      { gender_preference: "any", skilled: false },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "under_18");
  });

  it("allows 18+ applicants", () => {
    const result = checkJobEligibility(readyProfile, {
      gender_preference: "any",
      skilled: false,
    });
    assert.equal(result.ok, true);
  });

  it("blocks gender mismatch against job preference", () => {
    const result = checkJobEligibility(
      readyProfile,
      { gender_preference: "female", skilled: false },
      { editProfileHref: "/profile/edit" },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "gender_mismatch");
      assert.ok(result.fixHref);
    }
  });

  it("allows missing gender so the lead is kept, then profile can be completed", () => {
    const result = checkJobEligibility(
      {
        ...readyProfile,
        gender: null,
      },
      { gender_preference: "female", skilled: false },
    );
    assert.equal(result.ok, true);
  });

  it("blocks prefer_not_to_say when job has a gender preference", () => {
    const result = checkJobEligibility(
      {
        ...readyProfile,
        gender: "prefer_not_to_say",
      },
      { gender_preference: "male", skilled: false },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "gender_mismatch");
  });

  it("blocks unskilled profile on skilled jobs", () => {
    const result = checkJobEligibility(
      readyProfile,
      { gender_preference: "any", skilled: true },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "skilled_mismatch");
  });

  it("allows skilled profile on skilled jobs", () => {
    const result = checkJobEligibility(
      {
        ...readyProfile,
        work_type: "skilled",
      },
      { gender_preference: "male", skilled: true },
    );
    assert.equal(result.ok, true);
  });
});

describe("getProfileGaps", () => {
  it("lists only identity basics after apply", () => {
    const gaps = getProfileGaps({
      date_of_birth: null,
      gender: null,
      photo_url: null,
    });
    assert.deepEqual(
      gaps.map((g) => g.field),
      ["date_of_birth", "gender", "photo_url"],
    );
    assert.equal(
      profileNeedsCompletion({
        date_of_birth: null,
        gender: null,
        photo_url: null,
      }),
      true,
    );
  });

  it("ignores optional about and skills", () => {
    const gaps = getProfileGaps({
      date_of_birth: yearsAgo(20),
      gender: "female",
      photo_url: "https://example.com/a.jpg",
    });
    assert.equal(gaps.length, 0);
  });

  it("returns no gaps when identity basics are set", () => {
    const gaps = getProfileGaps({
      date_of_birth: yearsAgo(20),
      gender: "male",
      photo_url: "https://example.com/a.jpg",
    });
    assert.equal(gaps.length, 0);
  });
});

describe("applyEligibilityErrorMessage", () => {
  it("maps under-18 DB errors", () => {
    const msg = applyEligibilityErrorMessage(
      "APPLICATION_ELIGIBILITY: You must be 18 or older to apply",
    );
    assert.ok(msg?.includes("18 or older"));
  });
});
