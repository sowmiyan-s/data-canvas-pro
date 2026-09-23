import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sheet, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — GridVault" },
      { name: "description", content: "Sign in or create a GridVault account to manage spreadsheet projects." },
      { property: "og:title", content: "Sign in — GridVault" },
      { property: "og:description", content: "Secure access to your spreadsheet projects." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "verify" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        setMode("verify");
        toast.success("Enter the verification code sent to your email.");
      } else if (mode === "verify") {
        const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
        if (error) throw error;
        if (data.user) {
          const { error: profileError } = await supabase.from("profiles").upsert({
            user_id: data.user.id,
            display_name: name.trim() || String(data.user.user_metadata.display_name ?? ""),
          });
          if (profileError) throw profileError;
        }
        await navigate({ to: "/vault" });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("If an account exists, a password reset email is on its way.");
        setMode("signin");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          await supabase.from("profiles").upsert({
            user_id: data.user.id,
            display_name: String(data.user.user_metadata.display_name ?? ""),
          }, { onConflict: "user_id", ignoreDuplicates: true });
        }
        await navigate({ to: "/vault" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete that request.");
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "signup" ? "Create your account" : mode === "verify" ? "Check your email" : mode === "forgot" ? "Reset your password" : "Welcome back";

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <div className="panel w-full max-w-sm p-7">
        <div className="mb-7 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground"><Sheet className="size-4" /></span>
          <span className="font-semibold">GridVault</span>
        </div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "verify" ? `Enter the 6-digit code sent to ${email}.` : mode === "forgot" ? "We’ll email you a secure link to choose a new password." : "Your spreadsheet projects, private to your account."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {(mode === "signup" || mode === "verify" || mode === "forgot") && mode !== "verify" && (
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          )}
          {mode === "signin" && <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>}
          {mode === "signup" && <div className="space-y-1.5"><Label htmlFor="name">Display name</Label><Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} /></div>}
          {(mode === "signin" || mode === "signup") && <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>}
          {mode === "verify" && <div className="space-y-2"><Label htmlFor="verification-code">Verification code</Label><InputOTP id="verification-code" maxLength={6} value={code} onChange={setCode}><InputOTPGroup>{Array.from({ length: 6 }, (_, i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup></InputOTP></div>}
          {mode === "forgot" && <Button className="w-full" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset email"}</Button>}
          {(mode === "signin" || mode === "signup") && <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Button>}
          {mode === "verify" && <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify email"}</Button>}
        </form>

        <div className="mt-5 flex flex-col items-center gap-3 text-sm">
          {mode === "signin" && <><button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode("forgot")}>Forgot password?</button><button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode("signup")}>New here? Create an account</button></>}
          {mode === "signup" && <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>Already registered? Sign in</button>}
          {mode !== "signin" && <button type="button" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}><ArrowLeft className="size-3.5" /> Back to sign in</button>}
        </div>
      </div>
    </main>
  );
}