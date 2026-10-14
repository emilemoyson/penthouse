"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, checkPassword, createSessionToken } from "@/lib/auth";

export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const password = String(form.get("password") || "");
  const next = String(form.get("next") || "/");
  if (!process.env.APP_PASSWORD) return { error: "APP_PASSWORD isn't set on the server yet." };
  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 600));
    return { error: "That password isn't right." };
  }
  const { token, maxAge } = await createSessionToken();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  redirect(next.startsWith("/") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}
