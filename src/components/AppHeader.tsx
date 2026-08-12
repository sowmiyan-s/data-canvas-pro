import { Link, useNavigate } from "@tanstack/react-router";
import { Sheet, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
      <div className="flex h-14 items-center gap-4 px-4">
        <Link to="/vault" className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Sheet className="size-3.5" />
          </span>
          <span className="text-sm font-semibold tracking-tight">GridVault</span>
        </Link>
        <div className="min-w-0 flex-1">{children}</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await supabase.auth.signOut();
            void navigate({ to: "/auth" });
          }}
        >
          <LogOut className="mr-1.5 size-3.5" /> Sign out
        </Button>
      </div>
    </header>
  );
}
