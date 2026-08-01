import type { AppFeedback, AppFeedbackCategory } from "@/types/database";

export type FeedbackCategoryOption = {
  key: AppFeedbackCategory;
  label: string;
};

export const FEEDBACK_CATEGORIES: FeedbackCategoryOption[] = [
  { key: "experience", label: "App experience" },
  { key: "bug", label: "Bug or problem" },
  { key: "feature", label: "Feature idea" },
  { key: "other", label: "Other" },
];

export function feedbackCommentRequired(overall: number) {
  return overall > 0 && overall <= 2;
}

export function categoryLabel(key: AppFeedbackCategory) {
  return FEEDBACK_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export type SubmitAppFeedbackInput = {
  overall: number;
  category: AppFeedbackCategory;
  comment: string | null;
};

export type SubmitAppFeedbackResult =
  | { ok: true; data: AppFeedback }
  | { ok: false; message: string };

export type AppFeedbackStore = {
  submit: (
    input: SubmitAppFeedbackInput,
  ) => Promise<{
    data: AppFeedback | null;
    error: { message: string } | null;
  }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSupabaseAppFeedbackStore(supabase: any): AppFeedbackStore {
  return {
    async submit(input) {
      return supabase.rpc("submit_app_feedback", {
        p_overall: input.overall,
        p_category: input.category,
        p_comment: input.comment,
      });
    },
  };
}

export async function submitAppFeedback(
  store: AppFeedbackStore,
  input: SubmitAppFeedbackInput,
): Promise<SubmitAppFeedbackResult> {
  if (!input.overall || input.overall < 1 || input.overall > 5) {
    return { ok: false, message: "Pick a star rating" };
  }
  if (!input.category) {
    return { ok: false, message: "Pick a category" };
  }

  const comment = input.comment?.trim() ? input.comment.trim() : null;
  if (feedbackCommentRequired(input.overall) && !comment) {
    return { ok: false, message: "Please add a short note for low ratings" };
  }

  const { data, error } = await store.submit({
    overall: input.overall,
    category: input.category,
    comment,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data) {
    return { ok: false, message: "Could not submit feedback" };
  }

  return { ok: true, data };
}
