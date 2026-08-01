export type RatingDimensions = Record<string, number>;

export const BUSINESS_RATES_FREELANCER = [
  { key: "behaviour", label: "Behaviour" },
  { key: "punctuality", label: "Punctuality" },
  { key: "work_quality", label: "Work Quality" },
] as const;

export const FREELANCER_RATES_BUSINESS = [
  { key: "payment", label: "Payment" },
  { key: "behaviour", label: "Behaviour" },
  { key: "job_accuracy", label: "Gig Accuracy" },
  { key: "safety", label: "Safety" },
] as const;

export function averageDimensions(dims: RatingDimensions) {
  const vals = Object.values(dims).filter((n) => typeof n === "number" && n > 0);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
