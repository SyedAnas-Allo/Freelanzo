import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { JobCategory } from "@/types/database";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CATEGORIES: { value: JobCategory | "all"; label: string }[] = [
  { value: "all", label: "All Gigs" },
  { value: "event", label: "Events" },
  { value: "catering", label: "Catering" },
  { value: "promoter", label: "Promotions" },
  { value: "retail", label: "Retail" },
  { value: "warehouse", label: "Warehouse" },
  { value: "office", label: "Office" },
  { value: "sports", label: "Sports" },
  { value: "security", label: "Security" },
  { value: "talent", label: "Talent" },
  { value: "student_jobs", label: "Student Jobs" },
  { value: "labour", label: "Labour" },
  { value: "cleaning", label: "Cleaning" },
  { value: "hospitality", label: "Hospitality" },
  { value: "delivery", label: "Delivery" },
  { value: "other", label: "Other" },
];

export function formatPay(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** Base + food + travel for a single day. */
export function jobDayTotal(job: {
  pay_per_freelancer: number;
  food_allowance_inr?: number | null;
  travel_allowance_inr?: number | null;
}) {
  return (
    job.pay_per_freelancer +
    (job.food_allowance_inr ?? 0) +
    (job.travel_allowance_inr ?? 0)
  );
}

/** Day total × number of work days (paid once at the end). */
export function jobEngagementTotal(job: {
  pay_per_freelancer: number;
  food_allowance_inr?: number | null;
  travel_allowance_inr?: number | null;
  work_dates?: string[] | null;
}) {
  const days = Math.max(1, job.work_dates?.length ?? 1);
  return jobDayTotal(job) * days;
}

/** e.g. "₹600 + ₹100 food" or "₹900 / Day" when no allowances. */
export function formatJobPay(job: {
  pay_per_freelancer: number;
  food_allowance_inr?: number | null;
  travel_allowance_inr?: number | null;
}) {
  const food = job.food_allowance_inr ?? 0;
  const travel = job.travel_allowance_inr ?? 0;
  if (food <= 0 && travel <= 0) {
    return `${formatPay(job.pay_per_freelancer)} / Day`;
  }
  const parts = [formatPay(job.pay_per_freelancer)];
  if (food > 0) parts.push(`${formatPay(food)} food`);
  if (travel > 0) parts.push(`${formatPay(travel)} travel`);
  return parts.join(" + ");
}

export function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function greetingForNow() {
  return "Welcome";
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Build a dialer URL; keep leading + and digits only. */
export function telLink(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return `tel:${cleaned}`;
}

/** India emergency services. */
export const EMERGENCY_PHONE = "112";
