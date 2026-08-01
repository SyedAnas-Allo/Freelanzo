"use client";

import Link from "next/link";
import { markRead } from "@/app/(app)/notifications/actions";

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
