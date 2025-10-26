"use client"

import * as React from "react"

export function TooltipProvider({ children, ...props }: React.ComponentProps<"div">) {
  return <div {...props}>{children}</div>
}

export function Tooltip({ children, ...props }: React.ComponentProps<"div">) {
  return <div {...props}>{children}</div>
}

export function TooltipTrigger({ children, asChild }: { children: any; asChild?: boolean }) {
  return <>{children}</>
}

export function TooltipContent({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div {...props} className={className} role="tooltip">
      {children}
    </div>
  )
}

export default Tooltip
