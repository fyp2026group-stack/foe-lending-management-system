// Adapted from official shadcn/ui new-york-v4 registry; retrieved 2026-11-09.
import type * as React from "react"
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-md bg-accent", className)}
      {...props}
    />
  )
}

export { Skeleton }
