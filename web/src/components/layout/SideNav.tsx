"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Database,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/providers/PreferencesProvider";

const NAV = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/analytics", key: "nav.analytics", icon: BarChart3 },
  { href: "/logs", key: "nav.logs", icon: Database },
  { href: "/projects", key: "nav.projects", icon: FolderKanban },
] as const;

export function SideNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="h-screen w-64 fixed left-0 top-0 hidden md:flex flex-col border-r border-outline-variant bg-surface-container-lowest z-40">
      <div className="flex flex-col h-full py-6">
        <div className="px-6 mb-8 flex flex-col gap-1">
          <div className="font-mono text-data-lg text-secondary-container tracking-tighter">
            ANNOTATE_PAY
          </div>
          <div className="font-mono text-data-sm text-outline-variant">
            V2.0.4-STABLE
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-0.5 px-2">
          {NAV.map(({ href, key, icon: Icon }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors group",
                  active
                    ? "nav-link-active"
                    : "text-on-surface-variant hover:bg-surface-variant/30 hover:text-secondary-fixed-dim",
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active
                      ? "text-secondary-container"
                      : "text-outline group-hover:text-secondary-fixed-dim",
                  )}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span
                  className={cn(
                    active
                      ? "font-semibold text-[15px]"
                      : "font-sans text-body-md",
                  )}
                >
                  {t(key)}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="px-4 flex flex-col gap-2 mt-auto border-t border-outline-variant pt-4">
          <Link
            href="/logs"
            className="btn-primary w-full py-2.5 text-center"
          >
            {t("nav.logTasks")}
          </Link>
          <a
            href="https://github.com/julianvillalba688/annotate-pay"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-secondary-fixed-dim transition-colors"
          >
            <BookOpen className="h-4 w-4 text-outline" />
            <span className="font-mono text-data-sm">{t("nav.docs")}</span>
          </a>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-error-bright transition-colors text-left"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-mono text-data-sm">{t("nav.signOut")}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
