import type { Payment, PaymentStatus } from "@/types/database";

export function paymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "dispute":
      return "Dispute";
    default:
      return "Pending";
  }
}

/** Ratings unlock only after both parties confirm payment (not during dispute). */
export function paymentNeedsRating(payment: Payment | null | undefined) {
  return payment != null && payment.status === "confirmed";
}
