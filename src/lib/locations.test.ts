import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultLocationValue,
  formatSearchRadius,
  hasCoordinates,
  isUnlimitedRadius,
} from "@/lib/locations";

test("a new location has no fabricated coordinates or label", () => {
  assert.deepEqual(defaultLocationValue(), {
    area: "",
    city: "",
    lat: null,
    lng: null,
    search_radius_km: null,
  });
});

test("coordinates must be present as a valid pair", () => {
  assert.equal(hasCoordinates({ lat: 12.9733, lng: 77.6405 }), true);
  assert.equal(hasCoordinates({ lat: null, lng: 77.6405 }), false);
  assert.equal(hasCoordinates({ lat: 91, lng: 77.6405 }), false);
  assert.equal(hasCoordinates({ lat: 12.9733, lng: -181 }), false);
});

test("null search radius means all distances", () => {
  assert.equal(isUnlimitedRadius(null), true);
  assert.equal(isUnlimitedRadius(undefined), true);
  assert.equal(isUnlimitedRadius(15), false);
  assert.equal(formatSearchRadius(null), "All");
  assert.equal(formatSearchRadius(15), "15 km");
});
