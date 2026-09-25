"use server";

import { cookies } from "next/headers";
import { signOut } from "@/server/auth";
import { BROWSER_SESSION_COOKIE } from "@/server/browser-session";

/** Ends the session server-side; the caller then does a full-page replace so no portal page stays in history or router cache. */
export async function signOutAction() {
  (await cookies()).delete(BROWSER_SESSION_COOKIE);
  await signOut({ redirect: false });
}
