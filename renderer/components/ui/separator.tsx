"use client";

import * as React from "react";
import { cn } from "../../lib/util";

export function Separator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="separator"
      aria-hidden
      {...props}
      className={cn("h-px w-full bg-border my-2", className)}
    />
  );
}

export default Separator;
