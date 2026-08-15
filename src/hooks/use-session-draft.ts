"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

export const SESSION_DRAFT_KEYS = {
  postJobForm: "freelanzo:post-job:form",
  postJobLocation: "freelanzo:post-job:location",
  postJobPaymentAccepted: "freelanzo:post-job:payment-accepted",
  onboardingForm: "freelanzo:onboarding:form",
  onboardingLocation: "freelanzo:onboarding:location",
  onboardingStep: "freelanzo:onboarding:step",
  businessSetup: "freelanzo:business-setup:form",
} as const;

export function clearSessionDraft(...keys: string[]) {
  if (typeof window === "undefined") return;

  for (const key of keys) {
    window.sessionStorage.removeItem(key);
  }
}

export function useSessionDraft<T>(
  key: string,
  initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [value, setValue] = useState(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(key);
      if (saved !== null) {
        // Restore only after mount so server and first-client renders still match.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(JSON.parse(saved) as T);
      }
    } catch {
      window.sessionStorage.removeItem(key);
    }

    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;

    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Draft persistence must never block the form itself.
    }
  }, [hydrated, key, value]);

  const clearDraft = useCallback(() => {
    clearSessionDraft(key);
  }, [key]);

  return [value, setValue, clearDraft];
}
