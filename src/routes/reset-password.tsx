import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Choose a new password — GridVault" },
    { name: "description", content: "Set a new password for your GridVault account." },
    { property: "og:title", content: "Choose a new password — GridVault" },
    { property: "og:description", content: "Securely restore access to your GridVault account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      if (hash.get("type") !== "recovery") throw new Error("This reset link is invalid or has expired. Request a new one.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      await navigate({ to: "/vault" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-8"><div className="panel w-full max-w-sm p-7"><div className="mb-6 grid size-10 place-items-center rounded-md bg-accent text-accent-foreground"><KeyRound className="size-5" /></div><h1 className="text-xl font-semibold">Choose a new password</h1><p className="mt-1 text-sm text-muted-foreground">Enter a new password to secure your account.</p><form onSubmit={submit} className="mt-6 space-y-4"><div className="space-y-1.5"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></div><Button className="w-full" disabled={busy}>{busy ? "Updating…" : "Update password"}</Button></form></div></main>;
}