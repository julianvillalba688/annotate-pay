"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  getChapterSteps,
  getTourHref,
  ONBOARDING_CHAPTERS,
  ONBOARDING_SESSION_KEY,
  ONBOARDING_STEPS,
  type OnboardingChapterId,
} from "@/components/onboarding/tour";
import {
  useProfile,
  useUpdateOnboardingStatus,
} from "@/hooks/useProfile";
import type { OnboardingStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { ErrorBlock, LoadingBlock } from "@/components/ui/Card";
import { useI18n } from "@/components/providers/PreferencesProvider";
import { getUserError } from "@/lib/errors";

export function OnboardingGuide() {
  const router = useRouter();
  const profileQuery = useProfile();
  const updateOnboarding = useUpdateOnboardingStatus();
  const { t } = useI18n();
  const [selectedChapter, setSelectedChapter] =
    useState<OnboardingChapterId>("rate");
  const [savingStatus, setSavingStatus] = useState<OnboardingStatus | null>(
    null,
  );
  const [statusError, setStatusError] = useState<string | null>(null);

  const chapter =
    ONBOARDING_CHAPTERS.find((candidate) => candidate.id === selectedChapter) ??
    ONBOARDING_CHAPTERS[0];
  const chapterSteps = useMemo(
    () => getChapterSteps(chapter.id),
    [chapter.id],
  );

  async function saveStatus(status: OnboardingStatus) {
    if (savingStatus) return;

    setStatusError(null);
    setSavingStatus(status);
    try {
      await updateOnboarding.mutateAsync(status);
      window.sessionStorage.removeItem(ONBOARDING_SESSION_KEY);
      router.replace("/dashboard");
    } catch (error) {
      setStatusError(
        getUserError(error, t, "errors.onboardingUpdateFailed"),
      );
      setSavingStatus(null);
    }
  }

  function startAt(stepId: (typeof ONBOARDING_STEPS)[number]["id"]) {
    router.push(getTourHref(stepId));
  }

  if (profileQuery.isPending) {
    return <LoadingBlock label={t("onboarding.loading")} />;
  }

  if (profileQuery.error) {
    return (
      <ErrorBlock
        message={getUserError(profileQuery.error, t, "errors.loadFailed")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col justify-between gap-6 border-b border-outline-variant/30 pb-7 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="font-mono text-label-caps tracking-widest text-secondary-container">
            {t("onboarding.eyebrow")}
          </p>
          <h1 className="mt-3 font-sans text-headline-lg-mobile text-primary-fixed md:text-headline-lg">
            {t("onboarding.title")}
          </h1>
          <p className="mt-3 max-w-2xl font-sans text-body-md leading-relaxed text-on-surface-variant">
            {t("onboarding.description")}
          </p>
        </div>

        <div
          className="w-full border border-outline-variant/70 bg-surface-container-low p-4 sm:max-w-xs"
          role="status"
          aria-live="polite"
        >
          <p className="font-mono text-label-caps tracking-widest text-outline">
            {t("onboarding.summaryLabel")}
          </p>
          <p className="mt-2 font-mono text-data-lg text-secondary-container">
            {t("onboarding.totalStops", { count: ONBOARDING_STEPS.length })}
          </p>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-outline">
            {t("onboarding.progressHint")}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.35fr)]">
        <nav
          aria-label={t("onboarding.chaptersLabel")}
          className="border border-outline-variant/60 bg-surface-card p-3"
        >
          <p className="px-3 py-2 font-mono text-label-caps tracking-widest text-outline">
            {t("onboarding.chaptersLabel")}
          </p>
          <ol className="mt-2 space-y-1">
            {ONBOARDING_CHAPTERS.map((item, index) => {
              const active = item.id === chapter.id;
              const steps = getChapterSteps(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={active ? "step" : undefined}
                    className={`flex min-h-[76px] w-full items-start gap-3 px-3 py-3 text-left transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-container ${
                      active
                        ? "bg-secondary-container/10 text-secondary-container"
                        : "text-on-surface-variant hover:bg-surface-variant/30 hover:text-on-surface"
                    }`}
                    onClick={() => setSelectedChapter(item.id)}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border font-mono text-data-sm ${
                        active
                          ? "border-secondary-container text-secondary-container"
                          : "border-outline-variant text-outline"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-sans text-sm font-semibold">
                        {t(item.titleKey)}
                      </span>
                      <span className="mt-1 block font-mono text-[10px] text-outline">
                        {t("onboarding.chapterStops", { count: steps.length })}
                      </span>
                    </span>
                    {active ? (
                      <Check
                        className="mt-1 h-4 w-4 shrink-0 text-secondary-container"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section
          aria-labelledby="onboarding-chapter-title"
          className="relative overflow-hidden border border-electric/40 bg-surface-card p-5 shadow-glow-purple sm:p-7"
        >
          <div className="absolute inset-x-0 top-0 h-12 zebra-stripe opacity-60" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/40 pb-4">
              <p className="font-mono text-label-caps tracking-widest text-primary-container">
                {t("onboarding.chapterProgress", {
                  current:
                    ONBOARDING_CHAPTERS.findIndex(
                      (item) => item.id === chapter.id,
                    ) + 1,
                  total: ONBOARDING_CHAPTERS.length,
                })}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-outline">
                {t("onboarding.interactiveMode")}
              </p>
            </div>

            <h2
              id="onboarding-chapter-title"
              className="mt-7 font-sans text-headline-md text-on-surface sm:text-[30px]"
            >
              {t(chapter.titleKey)}
            </h2>
            <p className="mt-3 max-w-2xl font-sans text-body-md leading-relaxed text-on-surface-variant">
              {t(chapter.descriptionKey)}
            </p>

            <ol className="mt-7 divide-y divide-outline-variant/30 border-y border-outline-variant/40">
              {chapterSteps.map((step, index) => (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => startAt(step.id)}
                    className="group flex min-h-[70px] w-full items-center gap-3 py-3 text-left transition-colors hover:bg-secondary-container/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-container motion-reduce:transition-none"
                  >
                    <span className="font-mono text-data-sm text-secondary-container">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-sans text-sm font-semibold text-on-surface group-hover:text-secondary-container">
                        {t(step.titleKey)}
                      </span>
                      <span className="mt-1 block font-mono text-[10px] leading-relaxed text-outline">
                        {t(step.descriptionKey)}
                      </span>
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-outline group-hover:text-secondary-container"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ol>

            <div className="mt-7 flex flex-col gap-3 border-t border-outline-variant/30 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <p className="max-w-xl font-mono text-[10px] leading-relaxed text-outline">
                {t("onboarding.interactiveHint")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => startAt(ONBOARDING_STEPS[0].id)}
                  className="min-h-11"
                >
                  {t("onboarding.startFull")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  onClick={() => startAt(chapterSteps[0].id)}
                  className="min-h-11"
                >
                  {t("onboarding.startChapter")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {statusError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="border border-error-bright/50 bg-error-container/20 px-4 py-3"
        >
          <p className="font-mono text-label-caps tracking-widest text-error-bright">
            {t("onboarding.errorTitle")}
          </p>
          <p className="mt-1 font-mono text-data-sm text-error-bright">
            {statusError}
          </p>
        </div>
      ) : null}

      <footer className="flex flex-col justify-between gap-4 border-t border-outline-variant/30 pt-6 sm:flex-row sm:items-center">
        <p className="max-w-xl font-mono text-[10px] leading-relaxed text-outline">
          {t("onboarding.persisted")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            loading={savingStatus === "skipped"}
            disabled={Boolean(savingStatus)}
            onClick={() => void saveStatus("skipped")}
            className="min-h-11"
          >
            {savingStatus === "skipped"
              ? t("onboarding.skipping")
              : t("onboarding.skip")}
          </Button>
          <Button
            type="button"
            loading={savingStatus === "completed"}
            disabled={Boolean(savingStatus)}
            onClick={() => void saveStatus("completed")}
            className="min-h-11"
          >
            {savingStatus === "completed"
              ? t("onboarding.finishing")
              : t("onboarding.finish")}
          </Button>
        </div>
      </footer>
    </div>
  );
}
