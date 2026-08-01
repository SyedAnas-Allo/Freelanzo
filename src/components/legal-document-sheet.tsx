"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getLegalDocument,
  type LegalDocumentId,
} from "@/lib/legal";

export function LegalDocumentSheet({
  documentId,
  open,
  onOpenChange,
}: {
  documentId: LegalDocumentId | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const doc = documentId ? getLegalDocument(documentId) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] gap-0 overflow-hidden rounded-t-3xl p-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {doc ? (
          <>
            <SheetHeader className="border-b border-border/50 px-4 pb-3 pt-4">
              <SheetTitle className="pr-8 text-left text-lg font-extrabold">
                {doc.title}
              </SheetTitle>
              <SheetDescription className="text-left">
                {doc.description}
                <span className="mt-1 block text-[11px] text-muted-foreground/80">
                  Last updated {doc.updatedAt}
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="overflow-y-auto overscroll-contain px-4 py-4 pb-6">
              <div className="space-y-5">
                {doc.sections.map((section) => (
                  <section key={section.heading}>
                    <h3 className="text-sm font-bold text-foreground">
                      {section.heading}
                    </h3>
                    <div className="mt-1.5 space-y-2">
                      {section.paragraphs.map((paragraph, index) => (
                        <p
                          key={`${section.heading}-${index}`}
                          className="text-[13px] font-light leading-relaxed text-muted-foreground"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
