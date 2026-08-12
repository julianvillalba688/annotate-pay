import type { MessageKey } from "@/lib/i18n/messages";

export const ONBOARDING_QUERY = "onboarding";
export const ONBOARDING_QUERY_VALUE = "tour";
export const ONBOARDING_STEP_QUERY = "step";
export const ONBOARDING_SESSION_KEY = "annotatepay.onboarding.step";

export const ONBOARDING_CHAPTERS = [
  {
    id: "rate",
    titleKey: "onboarding.chapterRateTitle",
    descriptionKey: "onboarding.chapterRateDescription",
  },
  {
    id: "projects",
    titleKey: "onboarding.chapterProjectsTitle",
    descriptionKey: "onboarding.chapterProjectsDescription",
  },
  {
    id: "tasks",
    titleKey: "onboarding.chapterTasksTitle",
    descriptionKey: "onboarding.chapterTasksDescription",
  },
  {
    id: "preferences",
    titleKey: "onboarding.chapterPreferencesTitle",
    descriptionKey: "onboarding.chapterPreferencesDescription",
  },
  {
    id: "analytics",
    titleKey: "onboarding.chapterAnalyticsTitle",
    descriptionKey: "onboarding.chapterAnalyticsDescription",
  },
] as const satisfies readonly {
  id: string;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
}[];

export type OnboardingChapterId = (typeof ONBOARDING_CHAPTERS)[number]["id"];

export const ONBOARDING_STEPS = [
  {
    id: "rate-field",
    chapter: "rate",
    route: "/projects",
    target: '[data-onboarding-target="rate-field"]',
    titleKey: "onboarding.tour.rateFieldTitle",
    descriptionKey: "onboarding.tour.rateFieldDescription",
    benefitKey: "onboarding.tour.rateFieldBenefit",
  },
  {
    id: "rate-sync",
    chapter: "rate",
    route: "/projects",
    target: '[data-onboarding-target="rate-sync"]',
    titleKey: "onboarding.tour.rateSyncTitle",
    descriptionKey: "onboarding.tour.rateSyncDescription",
    benefitKey: "onboarding.tour.rateSyncBenefit",
  },
  {
    id: "project-name",
    chapter: "projects",
    route: "/projects",
    target: '[data-onboarding-target="project-name"]',
    titleKey: "onboarding.tour.projectNameTitle",
    descriptionKey: "onboarding.tour.projectNameDescription",
    benefitKey: "onboarding.tour.projectNameBenefit",
  },
  {
    id: "project-aht-attempter",
    chapter: "projects",
    route: "/projects",
    target: '[data-onboarding-target="project-aht-attempter"]',
    titleKey: "onboarding.tour.projectAttempterTitle",
    descriptionKey: "onboarding.tour.projectAttempterDescription",
    benefitKey: "onboarding.tour.projectAttempterBenefit",
  },
  {
    id: "project-aht-reviewer",
    chapter: "projects",
    route: "/projects",
    target: '[data-onboarding-target="project-aht-reviewer"]',
    titleKey: "onboarding.tour.projectReviewerTitle",
    descriptionKey: "onboarding.tour.projectReviewerDescription",
    benefitKey: "onboarding.tour.projectReviewerBenefit",
  },
  {
    id: "project-status",
    chapter: "projects",
    route: "/projects",
    target: '[data-onboarding-target="project-status"]',
    titleKey: "onboarding.tour.projectStatusTitle",
    descriptionKey: "onboarding.tour.projectStatusDescription",
    benefitKey: "onboarding.tour.projectStatusBenefit",
  },
  {
    id: "project-create",
    chapter: "projects",
    route: "/projects",
    target: '[data-onboarding-target="project-create"]',
    titleKey: "onboarding.tour.projectCreateTitle",
    descriptionKey: "onboarding.tour.projectCreateDescription",
    benefitKey: "onboarding.tour.projectCreateBenefit",
  },
  {
    id: "task-project",
    chapter: "tasks",
    route: "/logs",
    target: '[data-onboarding-target="task-project"]',
    titleKey: "onboarding.tour.taskProjectTitle",
    descriptionKey: "onboarding.tour.taskProjectDescription",
    benefitKey: "onboarding.tour.taskProjectBenefit",
    blockedKey: "onboarding.tour.taskProjectBlocked",
    recoveryStep: "project-name",
  },
  {
    id: "task-date",
    chapter: "tasks",
    route: "/logs",
    target: '[data-onboarding-target="task-date"]',
    titleKey: "onboarding.tour.taskDateTitle",
    descriptionKey: "onboarding.tour.taskDateDescription",
    benefitKey: "onboarding.tour.taskDateBenefit",
  },
  {
    id: "task-payment",
    chapter: "tasks",
    route: "/logs",
    target: '[data-onboarding-target="task-payment"]',
    titleKey: "onboarding.tour.taskPaymentTitle",
    descriptionKey: "onboarding.tour.taskPaymentDescription",
    benefitKey: "onboarding.tour.taskPaymentBenefit",
  },
  {
    id: "task-attempter",
    chapter: "tasks",
    route: "/logs",
    target: '[data-onboarding-target="task-attempter"]',
    titleKey: "onboarding.tour.taskAttempterTitle",
    descriptionKey: "onboarding.tour.taskAttempterDescription",
    benefitKey: "onboarding.tour.taskAttempterBenefit",
  },
  {
    id: "task-reviewer",
    chapter: "tasks",
    route: "/logs",
    target: '[data-onboarding-target="task-reviewer"]',
    titleKey: "onboarding.tour.taskReviewerTitle",
    descriptionKey: "onboarding.tour.taskReviewerDescription",
    benefitKey: "onboarding.tour.taskReviewerBenefit",
  },
  {
    id: "task-commit",
    chapter: "tasks",
    route: "/logs",
    target: '[data-onboarding-target="task-commit"]',
    titleKey: "onboarding.tour.taskCommitTitle",
    descriptionKey: "onboarding.tour.taskCommitDescription",
    benefitKey: "onboarding.tour.taskCommitBenefit",
  },
  {
    id: "preferences-currency",
    chapter: "preferences",
    route: "/projects",
    target: '[data-onboarding-target="preferences-currency"]',
    titleKey: "onboarding.tour.currencyTitle",
    descriptionKey: "onboarding.tour.currencyDescription",
    benefitKey: "onboarding.tour.currencyBenefit",
  },
  {
    id: "preferences-language",
    chapter: "preferences",
    route: "/projects",
    target: '[data-onboarding-target="preferences-language"]',
    titleKey: "onboarding.tour.languageTitle",
    descriptionKey: "onboarding.tour.languageDescription",
    benefitKey: "onboarding.tour.languageBenefit",
  },
  {
    id: "analytics-project",
    chapter: "analytics",
    route: "/analytics",
    target: '[data-onboarding-target="analytics-project"]',
    titleKey: "onboarding.tour.analyticsProjectTitle",
    descriptionKey: "onboarding.tour.analyticsProjectDescription",
    benefitKey: "onboarding.tour.analyticsProjectBenefit",
  },
  {
    id: "analytics-group",
    chapter: "analytics",
    route: "/analytics",
    target: '[data-onboarding-target="analytics-group"]',
    titleKey: "onboarding.tour.analyticsGroupTitle",
    descriptionKey: "onboarding.tour.analyticsGroupDescription",
    benefitKey: "onboarding.tour.analyticsGroupBenefit",
  },
  {
    id: "analytics-start-date",
    chapter: "analytics",
    route: "/analytics",
    target: '[data-onboarding-target="analytics-start-date"]',
    titleKey: "onboarding.tour.analyticsStartDateTitle",
    descriptionKey: "onboarding.tour.analyticsStartDateDescription",
    benefitKey: "onboarding.tour.analyticsStartDateBenefit",
  },
  {
    id: "analytics-end-date",
    chapter: "analytics",
    route: "/analytics",
    target: '[data-onboarding-target="analytics-end-date"]',
    titleKey: "onboarding.tour.analyticsEndDateTitle",
    descriptionKey: "onboarding.tour.analyticsEndDateDescription",
    benefitKey: "onboarding.tour.analyticsEndDateBenefit",
  },
  {
    id: "analytics-export",
    chapter: "analytics",
    route: "/analytics",
    target: '[data-onboarding-target="analytics-export"]',
    titleKey: "onboarding.tour.analyticsExportTitle",
    descriptionKey: "onboarding.tour.analyticsExportDescription",
    benefitKey: "onboarding.tour.analyticsExportBenefit",
  },
  {
    id: "analytics-results",
    chapter: "analytics",
    route: "/analytics",
    target: '[data-onboarding-target="analytics-results"]',
    titleKey: "onboarding.tour.analyticsResultsTitle",
    descriptionKey: "onboarding.tour.analyticsResultsDescription",
    benefitKey: "onboarding.tour.analyticsResultsBenefit",
  },
] as const satisfies readonly {
  id: string;
  chapter: OnboardingChapterId;
  route: string;
  target: string;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  benefitKey: MessageKey;
  blockedKey?: MessageKey;
  recoveryStep?: string;
}[];

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function isOnboardingStepId(
  value: string | null,
): value is OnboardingStepId {
  return ONBOARDING_STEPS.some((step) => step.id === value);
}

export function getOnboardingStep(stepId: OnboardingStepId) {
  return ONBOARDING_STEPS.find((step) => step.id === stepId) ?? ONBOARDING_STEPS[0];
}

export function getChapterSteps(chapter: OnboardingChapterId) {
  return ONBOARDING_STEPS.filter((step) => step.chapter === chapter);
}

export function getTourHref(stepId: OnboardingStepId) {
  const step = getOnboardingStep(stepId);
  const params = new URLSearchParams({
    [ONBOARDING_QUERY]: ONBOARDING_QUERY_VALUE,
    [ONBOARDING_STEP_QUERY]: step.id,
  });
  return `${step.route}?${params.toString()}`;
}
