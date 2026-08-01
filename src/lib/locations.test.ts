import assert from "node:assert/strict";
import test from "node:test";
import { defaultLocationValue, hasCoordinates } from "@/lib/locations";

test("a new location has no fabricated coordinates or label", () => {
  assert.deepEqual(defaultLocationValue(), {
    area: "",
    city: "",
    lat: null,
    lng: null,
    search_radius_km: 10,
  });
});

test("coordinates must be present as a valid pair", () => {
  assert.equal(hasCoordinates({ lat: 12.9733, lng: 77.6405 }), true);
  assert.equal(hasCoordinates({ lat: null, lng: 77.6405 }), false);
  assert.equal(hasCoordinates({ lat: 91, lng: 77.6405 }), false);
  assert.equal(hasCoordinates({ lat: 12.9733, lng: -181 }), false);
});
