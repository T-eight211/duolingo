import * as React from "react";

export interface IconPlaceholderProps extends React.ComponentProps<"svg"> {
  lucide?: string;
  tabler?: string;
  hugeicons?: string;
  phosphor?: string;
  remixicon?: string;
}

export function IconPlaceholder({
  lucide,
  tabler,
  hugeicons,
  phosphor,
  remixicon,
  className,
  ...props
}: IconPlaceholderProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    />
  );
}
