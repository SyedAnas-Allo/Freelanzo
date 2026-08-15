"use client";

import { FileText, ListChecks, Shirt } from "lucide-react";
import {
  FormField,
  formControlClassName,
} from "@/components/forms/form-field";
import { FormGroup } from "@/components/forms/form-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { JobFormController } from "./use-post-job-form";

const TEXTAREA_CLASS_NAME =
  "min-h-6 resize-none border-0 bg-transparent p-0 text-sm font-medium shadow-none focus-visible:ring-0 dark:bg-transparent";

export function JobDescriptionFields({
  controller: { form, setForm },
}: {
  controller: JobFormController;
}) {
  return (
    <FormGroup>
      <FormField
        icon={FileText}
        label="Gig Description"
        required
        hint={`${form.description.length}/300`}
      >
        <Textarea
          className={TEXTAREA_CLASS_NAME}
          maxLength={300}
          placeholder="What the work involves…"
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
      </FormField>

      <FormField icon={ListChecks} label="Requirements / Instructions">
        <Textarea
          className={TEXTAREA_CLASS_NAME}
          placeholder="Bring ID proof. Arrive 15 minutes early."
          value={form.instructions}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              instructions: event.target.value,
            }))
          }
        />
      </FormField>

      <FormField icon={Shirt} label="Dress code">
        <Input
          className={formControlClassName}
          placeholder="Clean black pants and formal shoes"
          value={form.dress_code}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              dress_code: event.target.value,
            }))
          }
        />
      </FormField>
    </FormGroup>
  );
}
