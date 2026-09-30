"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Colours come from CSS variables, which follow the admin's `dark` class.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // Sonner's richColors texts are just under 4.5:1 on their tinted backgrounds (WCAG AA);
          // these darker shades keep the same hues.
          "--success-text": "hsl(140, 100%, 22%)",
          "--info-text": "hsl(210, 100%, 35%)",
          "--warning-text": "hsl(31, 92%, 30%)",
          "--error-text": "hsl(360, 100%, 38%)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
