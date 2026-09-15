"use server";

import { redirect } from "next/navigation";
import { adoptLegacy, ensureDb } from "./db";
import { clearSession, createUser, listUsers, setSession, verifyUser, type User } from "./auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const loginUrl = (mode: "signin" | "signup", error: string) => `/login?mode=${mode}&error=${encodeURIComponent(error)}`;

export async function signIn(formData: FormData) {
  const user = verifyUser(str(formData, "email"), str(formData, "password"));
  if (!user) redirect(loginUrl("signin", "Wrong email or password."));
  ensureDb(user.id, user.name, user.email);
  await setSession(user.id);
  redirect("/");
}

export async function signUp(formData: FormData) {
  const first = listUsers().length === 0;
  let user: User;
  try {
    user = createUser(str(formData, "name"), str(formData, "email"), str(formData, "password"));
  } catch (e) {
    redirect(loginUrl("signup", e instanceof Error ? e.message : "Could not create the account."));
  }
  // The first account on this machine inherits any data from the single-user days.
  if (first) adoptLegacy(user.id);
  ensureDb(user.id, user.name, user.email);
  await setSession(user.id);
  redirect("/");
}

export async function signOut() {
  await clearSession();
  redirect("/login");
}
