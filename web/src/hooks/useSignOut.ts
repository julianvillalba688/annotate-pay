"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useSignOut() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function signOut(): Promise<boolean> {
    if (isSigningOut) return false;

    setIsSigningOut(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError(signOutError);
        return false;
      }

      router.push("/login");
      router.refresh();
      return true;
    } catch (signOutError) {
      setError(signOutError);
      return false;
    } finally {
      setIsSigningOut(false);
    }
  }

  return { signOut, isSigningOut, error };
}
