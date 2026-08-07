"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TerminalInput } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Zap } from "lucide-react";

type Mode = "login" | "register";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const supabase = createClient();

    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        router.push(next);
        router.refresh();
      } else {
        if (password.length < 6) {
          throw new Error("Passkey must be at least 6 characters");
        }
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setInfo(
            "Account created. Check email to confirm, or EXECUTE_LOGIN if confirmations are disabled.",
          );
          setMode("login");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card w-full shadow-2xl">
      <div className="h-8 zebra-header border-b border-primary-container/20 flex items-center px-4 justify-between">
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-error/50" />
          <div className="w-2 h-2 rounded-full bg-surface-variant" />
          <div className="w-2 h-2 rounded-full bg-tertiary/50" />
        </div>
        <span className="font-mono text-[10px] text-on-surface-variant">
          SECURE_NODE
        </span>
      </div>

      <div className="p-8">
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 py-2 font-mono text-label-caps uppercase tracking-widest border transition-colors ${
              mode === "login"
                ? "border-secondary-container text-secondary-container bg-secondary-container/10"
                : "border-outline-variant/40 text-on-surface-variant"
            }`}
          >
            LOGIN
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`flex-1 py-2 font-mono text-label-caps uppercase tracking-widest border transition-colors ${
              mode === "register"
                ? "border-secondary-container text-secondary-container bg-secondary-container/10"
                : "border-outline-variant/40 text-on-surface-variant"
            }`}
          >
            REGISTER
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
          <TerminalInput
            label="Identity [Email]"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="annotator@mainframe.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TerminalInput
            label="Passkey"
            id="password"
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
          />

          {error ? (
            <div className="border-l-2 border-error-bright bg-error-container/20 px-3 py-2">
              <p className="font-mono text-[12px] text-error-bright">{error}</p>
            </div>
          ) : null}
          {info ? (
            <div className="border-l-2 border-tertiary bg-tertiary/10 px-3 py-2">
              <p className="font-mono text-[12px] text-tertiary">{info}</p>
            </div>
          ) : null}

          <Button
            type="submit"
            loading={loading}
            className="w-full py-3 tracking-widest"
          >
            {mode === "login" ? "EXECUTE_LOGIN" : "CREATE_IDENTITY"}
          </Button>
        </form>
      </div>

      <div className="bg-surface-container-lowest border-t border-primary-container/20 p-4 flex justify-center items-center gap-2">
        <span className="font-mono text-[10px] text-on-surface-variant">
          POWERED BY
        </span>
        <div className="flex items-center gap-1 text-tertiary opacity-70">
          <Zap className="h-3.5 w-3.5" />
          <span className="font-sans text-[12px] font-bold tracking-tight">
            Supabase Auth
          </span>
        </div>
      </div>
    </div>
  );
}
