"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Database,
  FolderKanban,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/PreferencesProvider";

const NAV = [
  { href: "/dashboard", key: "nav.home", icon: LayoutDashboard },
  { href: "/analytics", key: "nav.stats", icon: BarChart3 },
  { href: "/logs", key: "nav.logs", icon: Database },
  { href: "/projects", key: "nav.projects", icon: FolderKanban },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-outline-variant bg-surface-container-lowest/95 backdrop-blur-xl">
      <div className="grid grid-cols-4 h-16">
        {NAV.map(({ href, key, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-colors",
                active
                  ? "text-secondary-container"
                  : "text-on-surface-variant",
              )}
            >
              <Icon
                className="h-5 w-5"
                strokeWidth={active ? 2.25 : 1.75}
              />
              <span className="font-mono text-[9px] tracking-wider uppercase">
                {t(key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
