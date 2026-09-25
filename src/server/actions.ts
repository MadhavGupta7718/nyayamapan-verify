"use server";

import { signOut } from "@/server/auth";

export async function signOutAction(formData: FormData) {
  const locale = formData.get("locale") === "hi" ? "hi" : "en";
  await signOut({ redirectTo: `/${locale}/login` });
}
