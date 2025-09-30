"use client";

import * as React from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { type VariantProps } from "class-variance-authority";

import { Button, buttonVariants } from "@/components/ui/button";

interface ThemeSwitcherProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  hideLabel?: boolean;
}

export function ThemeSwitcher({ hideLabel = true, children, variant, size, className, ...props }: ThemeSwitcherProps) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = (theme ?? resolvedTheme) === "dark";

  if (!mounted) {
    return (
      <Button aria-label="Toggle theme" variant={variant} size={size} className={className} {...props}>
        <SunMedium className="h-4 w-4" />
        {!hideLabel ? <span className="ml-2">Theme</span> : null}
      </Button>
    );
  }

  return (
    <Button
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      variant={variant}
      size={size}
      className={className}
      {...props}
    >
      {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      {!hideLabel ? <span className="ml-2">{isDark ? "Light" : "Dark"}</span> : children}
    </Button>
  );
}
