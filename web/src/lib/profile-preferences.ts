import { createClient } from "@/lib/supabase/client";

type PreferenceField = "preferred_locale" | "preferred_currency";

/** Profile preferences are optional until the matching migration is deployed. */
export async function persistProfilePreference(
  field: PreferenceField,
  value: string,
): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ [field]: value })
      .eq("id", user.id);
  } catch {
    // Local preferences remain the source of truth when the profile column is absent.
  }
}
