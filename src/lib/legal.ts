export type LegalDocumentId = "terms" | "privacy";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalDocument = {
  id: LegalDocumentId;
  title: string;
  description: string;
  updatedAt: string;
  sections: LegalSection[];
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  terms: {
    id: "terms",
    title: "Terms & Conditions",
    description: "Rules for using Freelanzo as a freelancer or business.",
    updatedAt: "31 July 2026",
    sections: [
      {
        heading: "About Freelanzo",
        paragraphs: [
          "Freelanzo is an on-demand local freelancing platform that connects businesses with nearby freelancers for short gigs. By creating an account or using the app, you agree to these Terms.",
          "Freelanzo provides the marketplace and tools. The work agreement for each gig is between the business and the freelancer.",
        ],
      },
      {
        heading: "Accounts",
        paragraphs: [
          "You must provide accurate profile information, including a valid mobile number. You are responsible for activity on your account.",
          "We may suspend or remove accounts that post fake details, harass others, skip payments, no-show on accepted gigs, or otherwise misuse the platform.",
        ],
      },
      {
        heading: "Jobs & applications",
        paragraphs: [
          "Businesses must describe gigs clearly and pay freelancers the agreed amount by Cash or UPI as soon as work ends, unless both sides agree otherwise in writing.",
          "Freelancers should only accept gigs they can attend. Repeated cancellations, no-shows, or unsafe behaviour can limit access to jobs.",
          "Job posting fees, if any, are shown before you pay and are non-refundable once a job is published, except where required by law.",
        ],
      },
      {
        heading: "Payments",
        paragraphs: [
          "Freelanzo may charge posting or platform fees. Freelancer wages for completed work are paid directly by the business unless we introduce an escrow or payout feature and say so clearly.",
          "Disputes about pay should first be raised in-app. We may review reports and take action on accounts, but we are not a party to every wage dispute.",
        ],
      },
      {
        heading: "Safety & conduct",
        paragraphs: [
          "Treat every user with respect. Do not use Freelanzo for illegal work, discrimination, threats, or anything that puts people at risk.",
          "Use Safety & SOS features only in a real emergency. False SOS reports or false abuse reports may lead to suspension.",
        ],
      },
      {
        heading: "Content & IP",
        paragraphs: [
          "You keep rights to content you upload (photos, documents, messages). You grant Freelanzo a licence to host and show that content as needed to run the service.",
          "Do not upload content you do not have rights to, or that is illegal or harmful.",
        ],
      },
      {
        heading: "Limitation of liability",
        paragraphs: [
          "Freelanzo is provided as-is. To the fullest extent allowed by law, we are not liable for indirect losses, gig outcomes between users, or issues outside our reasonable control.",
          "Nothing in these Terms limits rights you have under applicable Indian consumer or other mandatory law.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          "We may update these Terms. Continued use after an update means you accept the revised Terms. The “Last updated” date above shows the latest version.",
          "Questions: contact support through the app or visit freelanzo-three.vercel.app.",
        ],
      },
    ],
  },
  privacy: {
    id: "privacy",
    title: "Privacy Policy",
    description: "How Freelanzo collects, uses, and protects your data.",
    updatedAt: "31 July 2026",
    sections: [
      {
        heading: "What we collect",
        paragraphs: [
          "Account data such as name, photo, phone number, email (from Google sign-in), city/area, and role (freelancer or business).",
          "Profile and gig data such as work history, documents you upload for verification, job posts, applications, messages, ratings, and reports.",
          "Device and usage data such as app activity, approximate location when you choose to share it for nearby gigs, and basic diagnostics to keep the service reliable.",
        ],
      },
      {
        heading: "How we use it",
        paragraphs: [
          "To create and secure your account, show nearby jobs, match freelancers and businesses, process posting fees, and support chat, check-in, reviews, and safety features.",
          "To improve Freelanzo, prevent fraud and abuse, enforce our Terms, and contact you about your account or important service updates.",
        ],
      },
      {
        heading: "What others can see",
        paragraphs: [
          "Businesses and freelancers you interact with may see relevant profile details (for example name, photo, area, ratings, and job-related info).",
          "We do not sell your personal data. We may share data with service providers (such as hosting, auth, or payments) who process it only for Freelanzo, or when required by law.",
        ],
      },
      {
        heading: "Retention & security",
        paragraphs: [
          "We keep data as long as your account is active and as needed for legal, safety, and dispute reasons. You can ask us to delete your account; some records may be retained where the law requires.",
          "We use industry-standard safeguards, but no online service is perfectly secure. Protect your device and do not share OTPs or passwords.",
        ],
      },
      {
        heading: "Your choices",
        paragraphs: [
          "You can update profile details in Settings. You can control location sharing on your device. You can request access, correction, or deletion of personal data by contacting support.",
          "If you sign in with Google, Google’s own privacy policy also applies to that sign-in flow.",
        ],
      },
      {
        heading: "Children",
        paragraphs: [
          "Freelanzo is not intended for children under 18. If we learn we have collected data from a minor without proper consent, we will delete it.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: [
          "For privacy questions or requests, contact Freelanzo support through the app or visit freelanzo-three.vercel.app. We may update this Policy; the “Last updated” date shows the latest version.",
        ],
      },
    ],
  },
};

export function getLegalDocument(id: LegalDocumentId): LegalDocument {
  return LEGAL_DOCUMENTS[id];
}
