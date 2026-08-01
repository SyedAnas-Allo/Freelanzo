import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { SectionHeader } from "@/components/layout/section-header";
import { StatCard } from "@/components/shared/stat-card";
import { EarningsTransactionListItem } from "@/features/payments/components/earnings-transaction-list-item";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPay } from "@/lib/utils";
import type { Job, Payment } from "@/types/database";

export default async function EarningsPage() {
  const { user } = await getSessionProfile();
  const supabase = await createClient();

  const { data: apps } = await supabase
    .from("applications")
    .select("id, job_id, jobs(*)")
    .eq("freelancer_id", user!.id)
    .eq("status", "accepted");

  const appIds = (apps ?? []).map((a) => a.id);
  const { data: payments } = appIds.length
    ? await supabase
        .from("payments")
        .select("*")
        .in("application_id", appIds)
        .eq("status", "confirmed")
    : { data: [] };

  const payList = (payments ?? []) as Payment[];
  const total = payList.reduce((s, p) => s + (p.amount ?? 0), 0);

  const now = new Date();
  const thisMonth = payList
    .filter((p) => {
      const d = new Date(p.updated_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, p) => s + (p.amount ?? 0), 0);

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = payList
    .filter((p) => {
      const d = new Date(p.updated_at);
      return (
        d.getMonth() === lastMonthDate.getMonth() &&
        d.getFullYear() === lastMonthDate.getFullYear()
      );
    })
    .reduce((s, p) => s + (p.amount ?? 0), 0);

  const jobByApp = new Map(
    (apps ?? []).map((a) => [a.id, a.jobs as unknown as Job]),
  );

  return (
    <PageContent>
      <PageHeader
        backHref="/profile"
        title="Earnings"
        description="Track confirmed payments from completed gigs."
      />

      <div className="rounded-xl bg-primary p-5 text-primary-foreground shadow-md shadow-primary/25">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium opacity-85">Total Earnings</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">
              {formatPay(total)}
            </p>
          </div>
          <span className="flex size-12 items-center justify-center rounded-full bg-white/15">
            <Wallet className="size-6" />
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ["This Month", thisMonth],
          ["Last Month", lastMonth],
          ["Total", total],
        ].map(([label, value]) => (
          <StatCard
            key={label as string}
            value={formatPay(value as number)}
            label={label as string}
          />
        ))}
      </div>

      <SectionHeader title="Recent Transactions" />
      <div className="space-y-2">
        {payList.length === 0 ? (
          <EmptyState
            icon={<Wallet aria-hidden="true" className="size-5" />}
            title="No Confirmed Payments Yet"
            description="Complete a gig to see earnings here."
          />
        ) : (
          payList.map((payment) => (
            <EarningsTransactionListItem
              key={payment.id}
              job={jobByApp.get(payment.application_id)}
              amount={payment.amount ?? 0}
            />
          ))
        )}
      </div>
    </PageContent>
  );
}
