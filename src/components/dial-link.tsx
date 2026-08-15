"use client";

import * as React from "react";
import { dialPhone } from "@/lib/open-external-url";
import { telLink } from "@/lib/utils";

type DialLinkProps = Omit<React.ComponentPropsWithoutRef<"a">, "href"> & {
  /** Phone number or digits (e.g. +9198… or 112). */
  phone: string;
};

/**
 * Opens the device dialer on click. Uses a button-like anchor so Slot/asChild
 * styling still works, but never relies on WebView navigating to tel: alone.
 */
export const DialLink = React.forwardRef<HTMLAnchorElement, DialLinkProps>(
  function DialLink({ phone, onClick, children, ...props }, ref) {
    const href = telLink(phone);

    return (
      <a
        ref={ref}
        href={href}
        role="link"
        {...props}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          event.stopPropagation();
          // Stop other document click listeners from treating this as navigation.
          event.nativeEvent.stopImmediatePropagation();
          dialPhone(phone);
        }}
      >
        {children}
      </a>
    );
  },
);
