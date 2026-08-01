"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

async function markRead(notificationId: string) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .is("read_at", null);
}

export function NotificationItem({
  id,
  href,
  className,
  children,
}: {
  id: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        void markRead(id);
      }}
    >
      {children}
    </Link>
  );
}
