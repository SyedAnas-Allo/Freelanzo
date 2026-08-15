/** User-facing score explanations — factors only, no weights/formulas/thresholds. */

export type ScoreHelpContent = {
  sheetTitle: string;
  description: string;
  metrics: { label: string; definition: string }[];
  footerNote: string;
};

export const FREELANCER_RELIABILITY_HELP: ScoreHelpContent = {
  sheetTitle: "How Reliability Score works",
  description:
    "Reliability score reflects Freelanzo work history, including attendance, completed gigs, application withdrawals, and feedback from businesses. Attending and completing accepted gigs consistently can improve standing, while missed attendance, incomplete commitments, or frequent withdrawals can reduce it. New accounts may show a starting status until enough history is available.",
  metrics: [
    {
      label: "Gigs Completed",
      definition: "Accepted gigs where checkout was finished.",
    },
    {
      label: "Attendance Rate",
      definition:
        "How often check-in happened for accepted gigs compared with gigs expected to attend.",
    },
    {
      label: "Cancellation Rate",
      definition:
        "How often applications were withdrawn or cancelled relative to those commitments.",
    },
    {
      label: "No-Show Rate",
      definition:
        "Accepted gigs where attendance check-in did not happen.",
    },
  ],
  footerNote:
    "Freelanzo does not publish the exact calculation, and may adjust scoring to keep results fair.",
};

export const BUSINESS_TRUST_HELP: ScoreHelpContent = {
  sheetTitle: "How Trust Score works",
  description:
    "Trust score reflects activity on Freelanzo, including completed and cancelled gigs, confirmed payment outcomes, and feedback from freelancers. Completing gigs as posted, resolving payments promptly, and receiving positive feedback can improve standing. New businesses may show a starting status until enough history is available.",
  metrics: [
    {
      label: "Gigs Posted",
      definition: "Jobs published on Freelanzo (not drafts).",
    },
    {
      label: "Gigs Completed",
      definition: "Posted gigs that finished their work cycle.",
    },
    {
      label: "Payment Rate",
      definition:
        "How often payments were confirmed for tracked payouts after work was completed.",
    },
    {
      label: "Cancel Rate",
      definition: "How often posted gigs were cancelled relative to gigs posted.",
    },
  ],
  footerNote:
    "Freelanzo does not publish the exact calculation, and may adjust scoring to keep results fair.",
};
