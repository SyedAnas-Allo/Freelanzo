"use client";

import * as React from "react";
import { openWhatsApp } from "@/lib/open-external-url";
import { whatsappLink } from "@/lib/utils";

type WhatsAppLinkProps = Omit<React.ComponentPropsWithoutRef<"a">, "href"> & {
  phone: string;
  /** Prefills the WhatsApp compose box. */
  message?: string;
};

/**
 * Opens WhatsApp (app or wa.me). Same WebView-safe pattern as DialLink.
 */
export const WhatsAppLink = React.forwardRef<
  HTMLAnchorElement,
  WhatsAppLinkProps
>(function WhatsAppLink({ phone, message, onClick, children, ...props }, ref) {
  const href = whatsappLink(phone, message);

  return (
    <a
      ref={ref}
      href={href}
      role="link"
      rel="noopener noreferrer"
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation();
        openWhatsApp(phone, message);
      }}
    >
      {children}
    </a>
  );
});
