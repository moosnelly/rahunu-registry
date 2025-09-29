"use client";

import * as React from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";

import { Button, type ButtonProps } from "@/components/ui/button";

interface ThemeSwitcherProps extends ButtonProps {
  hideLabel?: boolean;
}

export function ThemeSwitcher({ hideLabel = true, children, ...props }: ThemeSwitcherProps) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = (theme ?? resolvedTheme) === "dark";

  if (!mounted) {
    return (
      <Button aria-label="Toggle theme" {...props}>
        <SunMedium className="h-4 w-4" />
        {!hideLabel ? <span className="ml-2">Theme</span> : null}
      </Button>
    );
  }

  return (
    <Button
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      {...props}
    >
      {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      {!hideLabel ? <span className="ml-2">{isDark ? "Light" : "Dark"}</span> : children}
    </Button>
  );
}
