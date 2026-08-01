import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden border border-transparent font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3.5!",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground [a]:hover:bg-primary/90",
        secondary:
          "bg-secondary/80 text-secondary-foreground [a]:hover:bg-secondary",
        destructive:
          "bg-destructive/8 text-destructive [a]:hover:bg-destructive/15",
        outline:
          "border-border/80 bg-transparent text-muted-foreground [a]:hover:bg-muted/60 [a]:hover:text-foreground",
        ghost:
          "bg-transparent text-muted-foreground [a]:hover:bg-muted/50 [a]:hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success:
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        warning:
          "bg-amber-500/10 text-amber-800 dark:text-amber-300",
        info: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
      },
      size: {
        default: "h-8 rounded-lg px-3 text-sm",
        sm: "h-7 rounded-md px-2.5 text-xs",
        lg: "h-9 rounded-lg px-3.5 text-[0.9375rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-size={size}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
