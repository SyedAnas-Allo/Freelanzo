"use client";

/**
 * Drop-in useRouter that triggers the global top loader on push/replace.
 * Prefer this over next/navigation for any in-app redirects.
 */
export { useRouter } from "nextjs-toploader/app";
