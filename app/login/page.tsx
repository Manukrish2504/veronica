import { redirect } from "next/navigation";
import { Ambient } from "@/components/home/ambient";
import { Icon } from "@/components/mt/icon";
import { currentUser } from "@/lib/auth";
import { signIn, signUp } from "@/lib/auth-actions";

const input = "h-10 w-full rounded-full border border-outline-variant bg-card px-4 text-[0.875rem] outline-none focus:border-primary/40 placeholder:text-muted-foreground";
const button = "inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-[0.875rem] font-medium text-primary-foreground shadow-sm transition hover:opacity-90";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string; error?: string }> }) {
  if (await currentUser()) redirect("/");
  const { mode, error } = await searchParams;
  const signup = mode === "signup";
  return (
    <main className="landing-hero relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-12">
      <Ambient />
      <div className="landing-enter relative w-full max-w-[400px] space-y-5 rounded-3xl border border-outline-variant bg-card/95 p-7 shadow-xl backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground"><Icon name="smart_toy" size={18} filled /></span>
          <span className="font-display text-[1.125rem] font-medium">Veronica</span>
        </div>
        <div className="space-y-1">
          <h1 style={{ fontSize: "var(--text-headline-md)" }}>{signup ? "Create your account" : "Welcome back"}</h1>
          <p className="text-sm text-muted-foreground">{signup ? "Your own job search: your CV, your postings, your drafts. Nobody else sees them." : "Sign in to your job search."}</p>
        </div>
        {error && <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-[0.8125rem] text-destructive">{error}</p>}
        <form action={signup ? signUp : signIn} className="space-y-3">
          {signup && <input name="name" placeholder="Your name" autoComplete="name" required className={input} />}
          <input name="email" type="email" placeholder="Email" autoComplete="email" required className={input} />
          <input name="password" type="password" placeholder={signup ? "Password (8+ characters)" : "Password"} autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 8 : undefined} className={input} />
          <button type="submit" className={button}><Icon name={signup ? "person_add" : "login"} size={18} />{signup ? "Create account" : "Sign in"}</button>
        </form>
        <p className="text-center text-[0.8125rem] text-muted-foreground">
          {signup ? <>Already have an account? <a href="/login" className="text-primary">Sign in</a></> : <>New here? <a href="/login?mode=signup" className="text-primary">Create an account</a></>}
        </p>
      </div>
    </main>
  );
}
