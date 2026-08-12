"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronDown, LogOut, User } from "lucide-react";
import {
  useProfile,
  useUpdateOnboardingStatus,
} from "@/hooks/useProfile";
import { useSignOut } from "@/hooks/useSignOut";
import { useI18n } from "@/components/providers/PreferencesProvider";
import { getUserError } from "@/lib/errors";

export function UserMenu({ id }: { id: string }) {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { t } = useI18n();
  const updateOnboarding = useUpdateOnboardingStatus();
  const { signOut, isSigningOut } = useSignOut();
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const triggerPointerDownRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = `${id}-menu`;
  const triggerId = `${id}-trigger`;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        triggerRef.current?.contains(target)
      ) {
        triggerPointerDownRef.current = true;
        return;
      }

      if (
        target instanceof Node &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handlePointerUp() {
      triggerPointerDownRef.current = false;
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const target = event.target;
      if (target === triggerRef.current) {
        if (!triggerPointerDownRef.current) setOpen(false);
        return;
      }

      if (target instanceof Node && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    firstActionRef.current?.focus();

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [open]);

  function focusMenuItem(direction: "next" | "previous" | "first" | "last") {
    const items = menuItemRefs.current.filter(
      (item): item is HTMLButtonElement => item !== null && !item.disabled,
    );
    if (items.length === 0) return;

    const currentIndex = items.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const nextIndex =
      direction === "first"
        ? 0
        : direction === "last"
          ? items.length - 1
          : direction === "next"
            ? (currentIndex + 1) % items.length
            : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItem("next");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItem("previous");
    } else if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem("first");
    } else if (event.key === "End") {
      event.preventDefault();
      focusMenuItem("last");
    }
  }

  async function reopenTutorial() {
    setActionError(null);
    updateOnboarding.reset();
    try {
      await updateOnboarding.mutateAsync("pending");
      setOpen(false);
      router.push("/onboarding");
    } catch (error) {
      setActionError(
        getUserError(error, t, "errors.onboardingUpdateFailed"),
      );
    }
  }

  async function handleSignOut() {
    setActionError(null);
    updateOnboarding.reset();
    const signedOut = await signOut();
    if (signedOut) {
      setOpen(false);
    } else {
      setActionError(t("errors.signOutFailed"));
    }
  }

  const isBusy = updateOnboarding.isPending || isSigningOut;
  const menuError = actionError;

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center gap-1 border border-outline-variant bg-surface-variant text-on-surface-variant transition-colors motion-reduce:transition-none hover:border-secondary-container hover:text-secondary-container focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-container focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        aria-label={open ? t("userMenu.close") : t("userMenu.open")}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        title={open ? t("userMenu.close") : t("userMenu.open")}
        onClick={() => {
          const pointerActivated = triggerPointerDownRef.current;
          triggerPointerDownRef.current = false;
          setActionError(null);
          setOpen(pointerActivated ? false : (current) => !current);
        }}
      >
        <User className="h-4 w-4" aria-hidden="true" />
        <ChevronDown
          className={`hidden h-3 w-3 sm:block ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)]"
        >
          <div
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
            className="border border-outline-variant bg-surface-container-highest p-1 shadow-glow-purple"
          >
            <div role="none" className="border-b border-outline-variant/60 px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-outline">
                {t("userMenu.account")}
              </p>
              <p className="mt-1 break-all font-mono text-data-sm text-on-surface">
                {profile?.email ?? t("userMenu.loadingEmail")}
              </p>
            </div>

            <button
              ref={(element) => {
                firstActionRef.current = element;
                menuItemRefs.current[0] = element;
              }}
              type="button"
              role="menuitem"
              disabled={isBusy}
              aria-busy={updateOnboarding.isPending}
              className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left font-mono text-label-caps text-on-surface-variant transition-colors motion-reduce:transition-none hover:bg-secondary-container/10 hover:text-secondary-container focus:outline-none focus-visible:bg-secondary-container/10 focus-visible:text-secondary-container disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void reopenTutorial()}
            >
              <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {updateOnboarding.isPending
                  ? t("userMenu.reopeningTutorial")
                  : t("userMenu.reopenTutorial")}
              </span>
            </button>
            <button
              ref={(element) => {
                menuItemRefs.current[1] = element;
              }}
              type="button"
              role="menuitem"
              disabled={isBusy}
              aria-busy={isSigningOut}
              className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left font-mono text-label-caps text-error-bright transition-colors motion-reduce:transition-none hover:bg-error-bright/10 focus:outline-none focus-visible:bg-error-bright/10 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {isSigningOut
                  ? t("userMenu.signingOut")
                  : t("userMenu.signOut")}
              </span>
            </button>
          </div>

          {menuError ? (
            <p
              role="alert"
              aria-live="assertive"
              className="border-x border-b border-error-bright/40 bg-error-container/20 px-3 py-2 font-mono text-[11px] text-error-bright"
            >
              {menuError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
