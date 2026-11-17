"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/*
  Keeps <html data-program> in step with the signed-in user's program. The
  middleware writes the program code into the tc-program cookie on every page
  request (and clears it for admin, staff and signed-out pages). The root layout
  does not re-render on client-side navigation, so after sign-in or sign-out
  this reads the cookie again whenever the route changes. The cookie only
  chooses colors, so it is not a security boundary.
*/
export function ThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )tc-program=([^;]*)/);
    const code = match ? decodeURIComponent(match[1]) : "";
    const root = document.documentElement;
    if (/^[A-Z]{2,6}$/.test(code)) root.setAttribute("data-program", code);
    else root.removeAttribute("data-program");
  }, [pathname]);

  return null;
}
