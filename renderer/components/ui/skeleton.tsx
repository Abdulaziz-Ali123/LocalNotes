"use client"

import * as React from "react"
import { cn } from "../../lib/util"

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div {...props} className={cn("animate-pulse bg-muted rounded", className)} />
}

export default Skeleton
