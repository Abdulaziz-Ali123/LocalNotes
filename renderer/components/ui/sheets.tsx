"use client";

import * as React from "react";

export function Sheet({ children, ...props }: React.ComponentProps<"div">) {
  return <div {...props}>{children}</div>;
}

export function SheetContent({ children, ...props }: React.ComponentProps<"div">) {
  return <div {...props}>{children}</div>;
}

export function SheetHeader({ children, ...props }: React.ComponentProps<"header">) {
  return <header {...props}>{children}</header>;
}

export function SheetTitle({ children, ...props }: React.ComponentProps<"h2">) {
  return <h2 {...props}>{children}</h2>;
}

export function SheetDescription({ children, ...props }: React.ComponentProps<"p">) {
  return <p {...props}>{children}</p>;
}

export default Sheet;
