"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/providers/PreferencesProvider";
import { getUserError } from "@/lib/errors";
import {
  getChapterSteps,
  getOnboardingStep,
  getTourHref,
  isOnboardingStepId,
  ONBOARDING_CHAPTERS,
  ONBOARDING_QUERY,
  ONBOARDING_QUERY_VALUE,
  ONBOARDING_SESSION_KEY,
  ONBOARDING_STEP_QUERY,
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from "@/components/onboarding/tour";
import { TourSpotlight } from "@/components/onboarding/TourSpotlight";
import {
  useUpdateOnboardingStatus,
} from "@/hooks/useProfile";
import type { OnboardingStatus } from "@/types";

export function OnboardingTour() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const updateOnboarding = useUpdateOnboardingStatus();
  const [savingStatus, setSavingStatus] = useState<OnboardingStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const requestedStep = searchParams.get(ONBOARDING_STEP_QUERY);
  const active = searchParams.get(ONBOARDING_QUERY) === ONBOARDING_QUERY_VALUE;
  const invalidTourStep = active && !isOnboardingStepId(requestedStep);
  const stepId = active && isOnboardingStepId(requestedStep) ? requestedStep : null;
  const step = stepId ? getOnboardingStep(stepId) : null;

  const currentIndex = useMemo(
    () => (step ? ONBOARDING_STEPS.findIndex((candidate) => candidate.id === step.id) : -1),
    [step],
  );
  const chapterSteps = step ? getChapterSteps(step.chapter) : [];
  const chapterIndex = step
    ? chapterSteps.findIndex((candidate) => candidate.id === step.id)
    : -1;
  const chapter = step
    ? ONBOARDING_CHAPTERS.find((candidate) => candidate.id === step.chapter)
    : null;

  useEffect(() => {
    if (!step) return;
    window.sessionStorage.setItem(ONBOARDING_SESSION_KEY, step.id);
  }, [step]);

  useEffect(() => {
    if (!invalidTourStep) return;
    router.replace("/onboarding");
  }, [invalidTourStep, router]);

  useEffect(() => {
    if (!step || pathname === step.route) return;
    router.replace(getTourHref(step.id));
  }, [pathname, router, step]);

  function goToStep(nextStepId: OnboardingStepId) {
    setStatusError(null);
    window.sessionStorage.setItem(ONBOARDING_SESSION_KEY, nextStepId);
    router.push(getTourHref(nextStepId));
  }

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

  if (!step || !chapter || pathname !== step.route || currentIndex < 0) {
    return null;
  }

  const previousStep = ONBOARDING_STEPS[currentIndex - 1];
  const nextStep = ONBOARDING_STEPS[currentIndex + 1];
  const recoveryStep = "recoveryStep" in step ? step.recoveryStep : undefined;

  return (
    <TourSpotlight
      step={step}
      stepNumber={currentIndex + 1}
      totalSteps={ONBOARDING_STEPS.length}
      chapterName={t(chapter.titleKey)}
      chapterStepNumber={chapterIndex + 1}
      chapterTotalSteps={chapterSteps.length}
      isFirstStep={!previousStep}
      isLastStep={!nextStep}
      savingStatus={
        savingStatus === "skipped" || savingStatus === "completed"
          ? savingStatus
          : null
      }
      statusError={statusError}
      onPrevious={() => {
        if (previousStep) goToStep(previousStep.id);
      }}
      onNext={() => {
        if (nextStep) {
          goToStep(nextStep.id);
        } else {
          void saveStatus("completed");
        }
      }}
      onSkip={() => void saveStatus("skipped")}
      onFinish={() => void saveStatus("completed")}
      onRecovery={
        recoveryStep && isOnboardingStepId(recoveryStep)
          ? () => goToStep(recoveryStep)
          : undefined
      }
    />
  );
}
