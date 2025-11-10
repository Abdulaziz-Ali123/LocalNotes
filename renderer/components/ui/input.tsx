"use client";

import * as React from "react";
import { cn } from "../../lib/util";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn("min-w-0 flex-1 rounded-md border px-2 py-1 text-sm bg-transparent", className)}
    />
  );
}

export default Input;
