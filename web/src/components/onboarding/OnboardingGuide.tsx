"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Database,
  FolderKanban,
  Languages,
  Wallet,
} from "lucide-react";
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
  const [activeStep, setActiveStep] = useState(0);
  const [savingStatus, setSavingStatus] = useState<OnboardingStatus | null>(
    null,
  );
  const [statusError, setStatusError] = useState<string | null>(null);

  const steps = [
    {
      title: t("onboarding.stepRateTitle"),
      description: t("onboarding.stepRateDescription"),
      href: "/projects#global-rate-panel",
      cta: t("onboarding.stepRateCta"),
      icon: Wallet,
    },
    {
      title: t("onboarding.stepProjectTitle"),
      description: t("onboarding.stepProjectDescription"),
      href: "/projects#project-form",
      cta: t("onboarding.stepProjectCta"),
      icon: FolderKanban,
    },
    {
      title: t("onboarding.stepTasksTitle"),
      description: t("onboarding.stepTasksDescription"),
      href: "/logs#task-log-form",
      cta: t("onboarding.stepTasksCta"),
      icon: Database,
    },
    {
      title: t("onboarding.stepPreferencesTitle"),
      description: t("onboarding.stepPreferencesDescription"),
      href: "/projects#header-preferences",
      cta: t("onboarding.stepPreferencesCta"),
      icon: Languages,
    },
    {
      title: t("onboarding.stepAnalyticsTitle"),
      description: t("onboarding.stepAnalyticsDescription"),
      href: "/analytics",
      cta: t("onboarding.stepAnalyticsCta"),
      icon: BarChart3,
    },
  ] as const;

  async function saveStatus(status: OnboardingStatus) {
    if (savingStatus) return;

    setStatusError(null);
    setSavingStatus(status);
    try {
      await updateOnboarding.mutateAsync(status);
      router.replace("/dashboard");
    } catch (error) {
      setStatusError(
        getUserError(error, t, "errors.onboardingUpdateFailed"),
      );
      setSavingStatus(null);
    }
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

  const current = steps[activeStep];
  const CurrentIcon = current.icon;
  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === steps.length - 1;
  const progress = ((activeStep + 1) / steps.length) * 100;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col justify-between gap-6 border-b border-outline-variant/30 pb-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="font-mono text-label-caps tracking-widest text-secondary-container">
            {t("onboarding.eyebrow")}
          </p>
          <h1 className="mt-3 font-sans text-headline-lg-mobile text-primary-fixed md:text-headline-lg">
            {t("onboarding.title")}
          </h1>
          <p className="mt-3 max-w-2xl font-sans text-body-md text-on-surface-variant">
            {t("onboarding.description")}
          </p>
        </div>

        <div
          className="w-full max-w-xs border border-outline-variant/70 bg-surface-container-low p-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-label-caps tracking-widest text-outline">
              {t("onboarding.progress", {
                current: activeStep + 1,
                total: steps.length,
              })}
            </span>
            <span className="font-mono text-data-sm text-secondary-container">
              {String(activeStep + 1).padStart(2, "0")}/
              {String(steps.length).padStart(2, "0")}
            </span>
          </div>
          <div
            className="mt-3 h-1 bg-surface-container-highest"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={activeStep + 1}
            aria-label={t("onboarding.progress", {
              current: activeStep + 1,
              total: steps.length,
            })}
          >
            <div
              className="h-full bg-secondary-container transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] text-outline">
            {t("onboarding.progressHint")}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
        <nav
          aria-label={t("onboarding.stepsLabel")}
          className="border border-outline-variant/60 bg-surface-card p-3"
        >
          <p className="px-3 py-2 font-mono text-label-caps tracking-widest text-outline">
            {t("onboarding.stepsLabel")}
          </p>
          <ol className="mt-2 space-y-1">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const active = index === activeStep;
              return (
                <li key={step.href}>
                  <button
                    type="button"
                    aria-current={active ? "step" : undefined}
                    className={`flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-container ${
                      active
                        ? "bg-secondary-container/10 text-secondary-container"
                        : "text-on-surface-variant hover:bg-surface-variant/30 hover:text-on-surface"
                    }`}
                    onClick={() => setActiveStep(index)}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center border font-mono text-data-sm ${
                        active
                          ? "border-secondary-container text-secondary-container"
                          : "border-outline-variant text-outline"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <StepIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate font-sans text-sm font-semibold">
                        {step.title}
                      </span>
                    </span>
                    {active ? (
                      <span className="font-mono text-[9px] tracking-widest text-secondary-container">
                        {t("onboarding.active")}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section
          aria-labelledby="onboarding-step-title"
          className="relative overflow-hidden border border-electric/40 bg-surface-card p-6 shadow-glow-purple sm:p-8"
        >
          <div className="absolute inset-x-0 top-0 h-12 zebra-stripe opacity-60" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/40 pb-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-data-sm tracking-widest text-secondary-container">
                  {String(activeStep + 1).padStart(2, "0")}
                </span>
                <CurrentIcon
                  className="h-5 w-5 text-primary-container"
                  aria-hidden="true"
                />
              </div>
              <span className="font-mono text-label-caps tracking-widest text-outline">
                {t("onboarding.progress", {
                  current: activeStep + 1,
                  total: steps.length,
                })}
              </span>
            </div>

            <h2
              id="onboarding-step-title"
              className="mt-8 max-w-xl font-sans text-headline-md text-on-surface sm:text-[30px]"
            >
              {current.title}
            </h2>
            <p className="mt-4 max-w-2xl font-sans text-body-md leading-relaxed text-on-surface-variant">
              {current.description}
            </p>

            <div className="mt-8 border border-outline-variant/60 bg-anthracite p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-outline">
                {t("onboarding.route")} {"//"} {current.href}
              </p>
              <Link
                href={current.href}
                className="btn-primary mt-4 inline-flex min-h-11 items-center gap-2 px-4 py-3 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-container focus-visible:ring-offset-2 focus-visible:ring-offset-anthracite"
              >
                <span>{current.cta}</span>
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/30 pt-5">
              <Button
                type="button"
                variant="ghost"
                disabled={isFirstStep}
                onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
                className="min-h-11 px-2"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {t("onboarding.previous")}
              </Button>
              {!isLastStep ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setActiveStep((step) => Math.min(steps.length - 1, step + 1))
                  }
                  className="min-h-11 px-2 text-secondary-container hover:text-secondary-container"
                >
                  {t("onboarding.next")}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : (
                <span className="inline-flex min-h-11 items-center gap-2 px-2 font-mono text-label-caps tracking-widest text-outline">
                  {t("onboarding.finish")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
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

      <div className="flex flex-col justify-between gap-4 border-t border-outline-variant/30 pt-6 sm:flex-row sm:items-center">
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
      </div>
    </div>
  );
}
