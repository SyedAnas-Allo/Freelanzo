-- Default search radius to unlimited ("All") instead of 10 km.
ALTER TABLE "public"."profiles"
  ALTER COLUMN "search_radius_km" SET DEFAULT NULL;
