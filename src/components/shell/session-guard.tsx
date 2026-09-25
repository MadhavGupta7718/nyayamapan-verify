"use client";

import * as React from "react";

/** A portal page restored from the back/forward cache is re-requested so the server re-checks the session. */
export function SessionGuard() {
  React.useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  return null;
}
