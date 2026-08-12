"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ArrowLeft, ArrowRight, ExternalLink, RotateCw } from "lucide-react";
import { useI18n } from "@/components/providers/PreferencesProvider";
import type { OnboardingStep } from "@/components/onboarding/tour";

interface ViewportSize {
  width: number;
  height: number;
}

interface TargetRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

type TargetState = "ready" | "missing" | "disabled";

interface TargetSnapshot {
  rect: TargetRect | null;
  state: TargetState;
}

interface TourSpotlightProps {
  step: OnboardingStep;
  stepNumber: number;
  totalSteps: number;
  chapterName: string;
  chapterStepNumber: number;
  chapterTotalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  savingStatus: "skipped" | "completed" | null;
  statusError: string | null;
  onPrevious: () => void;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onRecovery?: () => void;
}

const SPOTLIGHT_PADDING = 7;
const VIEWPORT_MARGIN = 12;
const CALLOUT_GAP = 18;

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function isDisabled(element: HTMLElement) {
  const nativeDisabled =
    ("disabled" in element && Boolean((element as HTMLButtonElement).disabled)) ||
    element.hasAttribute("disabled");
  const ariaDisabled = element.getAttribute("aria-disabled")?.toLowerCase() === "true";
  return nativeDisabled || ariaDisabled;
}

function getTargetRect(element: HTMLElement): TargetRect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function areTargetRectsEqual(
  current: TargetRect | null,
  next: TargetRect | null,
) {
  if (current === next) return true;
  if (!current || !next) return false;
  return (
    current.top === next.top &&
    current.right === next.right &&
    current.bottom === next.bottom &&
    current.left === next.left &&
    current.width === next.width &&
    current.height === next.height
  );
}

function areTargetSnapshotsEqual(
  current: TargetSnapshot,
  next: TargetSnapshot,
) {
  return current.state === next.state && areTargetRectsEqual(current.rect, next.rect);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function TourSpotlight({
  step,
  stepNumber,
  totalSteps,
  chapterName,
  chapterStepNumber,
  chapterTotalSteps,
  isFirstStep,
  isLastStep,
  savingStatus,
  statusError,
  onPrevious,
  onNext,
  onSkip,
  onFinish,
  onRecovery,
}: TourSpotlightProps) {
  const { t } = useI18n();
  const calloutTitle = t(step.titleKey);
  const calloutDescription = t(step.descriptionKey);
  const calloutBenefit = t(step.benefitKey);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const calloutRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const targetSnapshotRef = useRef<TargetSnapshot>({
    rect: null,
    state: "missing",
  });
  const mobileScrollAdjustedRef = useRef(false);
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });
  const [targetSnapshot, setTargetSnapshot] = useState<TargetSnapshot>({
    rect: null,
    state: "missing",
  });
  const [calloutStyle, setCalloutStyle] = useState<CSSProperties>();
  const [retryCount, setRetryCount] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    setRetryCount(0);
    const nextSnapshot: TargetSnapshot = { rect: null, state: "missing" };
    targetSnapshotRef.current = nextSnapshot;
    setTargetSnapshot((current) =>
      areTargetSnapshotsEqual(current, nextSnapshot) ? current : nextSnapshot,
    );
    targetRef.current = null;
    mobileScrollAdjustedRef.current = false;
    setCalloutStyle(undefined);
  }, [step.id]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => setReducedMotion(media.matches);
    onMotionChange();
    media.addEventListener("change", onMotionChange);
    return () => media.removeEventListener("change", onMotionChange);
  }, []);

  useEffect(() => {
    let viewportFrame: number | null = null;

    function updateViewport() {
      if (viewportFrame !== null) return;
      viewportFrame = window.requestAnimationFrame(() => {
        viewportFrame = null;
        const nextViewport = {
          width: window.innerWidth,
          height: window.innerHeight,
        };
        setViewport((current) =>
          current.width === nextViewport.width && current.height === nextViewport.height
            ? current
            : nextViewport,
        );
      });
    }

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
      if (viewportFrame !== null) window.cancelAnimationFrame(viewportFrame);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let scrollRequested = false;
    let measurementFrame: number | null = null;
    let pendingScroll = false;
    const timers: number[] = [];

    function commitTargetSnapshot(nextSnapshot: TargetSnapshot) {
      const currentSnapshot = targetSnapshotRef.current;
      targetSnapshotRef.current = nextSnapshot;
      if (areTargetSnapshotsEqual(currentSnapshot, nextSnapshot)) return;
      setTargetSnapshot(nextSnapshot);
    }

    function locateTarget(shouldScroll: boolean) {
      if (cancelled) return;

      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(step.target),
      );
      const visibleElements = elements.filter(isVisible);
      const element =
        visibleElements.find((candidate) => !isDisabled(candidate)) ??
        visibleElements[0];

      if (!element) {
        targetRef.current = null;
        scrollRequested = false;
        commitTargetSnapshot({ rect: null, state: "missing" });
        return;
      }

      const rect = getTargetRect(element);
      const becameReadyAfterLoading =
        targetSnapshotRef.current.state === "missing" &&
        isOutsideViewport(rect);
      if ((shouldScroll || becameReadyAfterLoading) && !scrollRequested) {
        scrollRequested = true;
        element.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "center",
          inline: "nearest",
        });
      }

      targetRef.current = element;
      commitTargetSnapshot({
        rect,
        state: isDisabled(element) ? "disabled" : "ready",
      });
    }

    function scheduleMeasurement() {
      if (measurementFrame !== null) return;
      measurementFrame = window.requestAnimationFrame(() => {
        measurementFrame = null;
        const shouldScrollNow = pendingScroll;
        pendingScroll = false;
        locateTarget(shouldScrollNow);
      });
    }

    function scheduleMeasurementWithScroll() {
      pendingScroll = true;
      scheduleMeasurement();
    }

    function isOutsideViewport(rect: TargetRect) {
      return rect.top < VIEWPORT_MARGIN || rect.bottom > window.innerHeight - VIEWPORT_MARGIN;
    }

    scheduleMeasurementWithScroll();
    timers.push(window.setTimeout(() => scheduleMeasurement(), 80));
    timers.push(window.setTimeout(() => scheduleMeasurement(), 260));
    timers.push(window.setTimeout(() => scheduleMeasurement(), 900));
    timers.push(window.setTimeout(() => scheduleMeasurement(), 1800));

    const mutationObserver = new MutationObserver((records) => {
      const pageChanged = records.some((record) => {
        const node =
          record.target instanceof Element
            ? record.target
            : record.target.parentElement;
        return !node?.closest("[data-onboarding-layer]");
      });
      if (pageChanged) scheduleMeasurement();
    });
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "disabled", "aria-disabled"],
    });
    window.addEventListener("scroll", scheduleMeasurement, { passive: true });
    window.addEventListener("resize", scheduleMeasurement);

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      mutationObserver.disconnect();
      window.removeEventListener("scroll", scheduleMeasurement);
      window.removeEventListener("resize", scheduleMeasurement);
      if (measurementFrame !== null) window.cancelAnimationFrame(measurementFrame);
    };
  }, [reducedMotion, retryCount, step.id, step.target]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [step.id]);

  useLayoutEffect(() => {
    const callout = calloutRef.current;
    if (!callout) return;

    const narrow = viewport.width > 0 && viewport.width < 768;
    if (narrow) {
      setCalloutStyle({
        left: VIEWPORT_MARGIN,
        right: VIEWPORT_MARGIN,
        bottom: VIEWPORT_MARGIN,
        maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
      });
      return;
    }

    const width = callout.getBoundingClientRect().width;
    const height = callout.getBoundingClientRect().height;
    const rect = targetSnapshot.rect;

    if (!rect || viewport.width === 0 || viewport.height === 0) {
      setCalloutStyle({
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
      });
      return;
    }

    const fitsRight = rect.right + CALLOUT_GAP + width <= viewport.width - VIEWPORT_MARGIN;
    const fitsLeft = rect.left - CALLOUT_GAP - width >= VIEWPORT_MARGIN;
    const fitsBelow = rect.bottom + CALLOUT_GAP + height <= viewport.height - VIEWPORT_MARGIN;
    const fitsAbove = rect.top - CALLOUT_GAP - height >= VIEWPORT_MARGIN;

    if (fitsRight) {
      setCalloutStyle({
        left: rect.right + CALLOUT_GAP,
        top: clamp(rect.top + rect.height / 2 - height / 2, VIEWPORT_MARGIN, viewport.height - height - VIEWPORT_MARGIN),
        maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
      });
    } else if (fitsLeft) {
      setCalloutStyle({
        left: rect.left - CALLOUT_GAP - width,
        top: clamp(rect.top + rect.height / 2 - height / 2, VIEWPORT_MARGIN, viewport.height - height - VIEWPORT_MARGIN),
        maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
      });
    } else if (fitsBelow) {
      setCalloutStyle({
        left: clamp(rect.left, VIEWPORT_MARGIN, viewport.width - width - VIEWPORT_MARGIN),
        top: rect.bottom + CALLOUT_GAP,
        maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
      });
    } else if (fitsAbove) {
      setCalloutStyle({
        left: clamp(rect.left, VIEWPORT_MARGIN, viewport.width - width - VIEWPORT_MARGIN),
        top: rect.top - CALLOUT_GAP - height,
        maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
      });
    } else {
      setCalloutStyle({
        left: clamp(rect.left, VIEWPORT_MARGIN, viewport.width - width - VIEWPORT_MARGIN),
        top: VIEWPORT_MARGIN,
        maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
      });
    }
  }, [calloutBenefit, calloutDescription, calloutTitle, targetSnapshot, viewport]);

  useLayoutEffect(() => {
    if (
      viewport.width >= 768 ||
      !calloutStyle ||
      targetSnapshot.state !== "ready" ||
      mobileScrollAdjustedRef.current
    ) {
      return;
    }

    const callout = calloutRef.current;
    const target = targetRef.current;
    if (!callout || !target) return;

    const targetRect = target.getBoundingClientRect();
    const calloutRect = callout.getBoundingClientRect();
    const overlap = targetRect.bottom + CALLOUT_GAP - calloutRect.top;
    if (overlap <= 0) return;

    mobileScrollAdjustedRef.current = true;
    window.scrollBy({
      top: overlap,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [calloutStyle, reducedMotion, targetSnapshot.state, viewport]);

  const targetReady = targetSnapshot.state === "ready";
  const targetBlocked = targetSnapshot.state === "disabled";
  const targetUnavailable = targetSnapshot.state === "missing";
  const calloutTitleId = `onboarding-callout-title-${step.id}`;
  const calloutDescriptionId = `onboarding-callout-description-${step.id}`;
  const rect = targetSnapshot.rect;
  const blockedKey = "blockedKey" in step ? step.blockedKey : undefined;

  return (
    <div data-onboarding-layer className="contents pointer-events-none">
      {targetReady && rect ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 top-0 z-[80] bg-anthracite/80"
            style={{ height: Math.max(0, rect.top - SPOTLIGHT_PADDING) }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] bg-anthracite/80"
            style={{ top: rect.bottom + SPOTLIGHT_PADDING }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[80] bg-anthracite/80"
            style={{
              top: Math.max(0, rect.top - SPOTLIGHT_PADDING),
              left: 0,
              width: Math.max(0, rect.left - SPOTLIGHT_PADDING),
              height: rect.height + SPOTLIGHT_PADDING * 2,
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed right-0 z-[80] bg-anthracite/80"
            style={{
              top: Math.max(0, rect.top - SPOTLIGHT_PADDING),
              left: rect.right + SPOTLIGHT_PADDING,
              width: Math.max(0, viewport.width - rect.right - SPOTLIGHT_PADDING),
              height: rect.height + SPOTLIGHT_PADDING * 2,
            }}
          />
          <div
            aria-hidden="true"
            className="onboarding-halo-pulse pointer-events-none fixed z-[81] border border-cyan-neon"
            style={{
              top: rect.top - SPOTLIGHT_PADDING,
              left: rect.left - SPOTLIGHT_PADDING,
              width: rect.width + SPOTLIGHT_PADDING * 2,
              height: rect.height + SPOTLIGHT_PADDING * 2,
            }}
          />
        </>
      ) : null}

      <div
        ref={calloutRef}
        role="dialog"
        aria-modal={false}
        aria-labelledby={calloutTitleId}
        aria-describedby={calloutDescriptionId}
        className="onboarding-callout-enter pointer-events-auto fixed z-[90] w-[min(23rem,calc(100vw-1.5rem))] overflow-y-auto border border-cyan-neon/60 bg-surface-container-highest p-4 shadow-[0_0_24px_rgba(0,240,255,0.18)] sm:p-5"
        style={{
          ...calloutStyle,
          visibility: calloutStyle ? "visible" : "hidden",
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/60 pb-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-secondary-container">
              {chapterName}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-outline">
              {t("onboarding.tour.chapterProgress", {
                current: chapterStepNumber,
                total: chapterTotalSteps,
              })}
            </p>
          </div>
          <span className="shrink-0 font-mono text-[10px] text-primary-container">
            {stepNumber}/{totalSteps}
          </span>
        </div>

        <p className="sr-only" aria-live="polite">
          {t("onboarding.tour.liveStep", {
            title: calloutTitle,
            description: calloutDescription,
            chapter: chapterName,
            current: chapterStepNumber,
            total: chapterTotalSteps,
          })}
        </p>

        <h2
          ref={headingRef}
          id={calloutTitleId}
          tabIndex={-1}
          className="mt-4 font-sans text-[21px] font-semibold leading-tight text-on-surface outline-none"
        >
          {calloutTitle}
        </h2>
        <p
          id={calloutDescriptionId}
          className="mt-3 font-sans text-sm leading-relaxed text-on-surface-variant"
        >
          {calloutDescription}
        </p>

        <div className="mt-4 border border-outline-variant/60 bg-anthracite/70 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
            {t("onboarding.tour.benefitLabel")}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-on-surface-variant">
            {calloutBenefit}
          </p>
        </div>

        {targetUnavailable ? (
          <div className="mt-3 border border-primary-container/60 bg-primary-container/10 p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
              {t("onboarding.tour.targetUnavailableTitle")}
            </p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-on-surface-variant">
              {t("onboarding.tour.targetUnavailable", { target: calloutTitle })}
            </p>
          </div>
        ) : null}

        {targetBlocked ? (
          <div className="mt-3 border border-primary-container/60 bg-primary-container/10 p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
              {t("onboarding.tour.targetBlockedTitle")}
            </p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-on-surface-variant">
              {t(blockedKey ?? "onboarding.tour.targetBlocked")}
            </p>
          </div>
        ) : null}

        <p className="mt-4 font-mono text-[10px] leading-relaxed text-outline">
          {t("onboarding.tour.controlHint")}
        </p>

        {statusError ? (
          <p
            role="alert"
            aria-live="assertive"
            className="mt-3 border border-error-bright/50 bg-error-container/20 px-3 py-2 font-mono text-[11px] text-error-bright"
          >
            {statusError}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/60 pt-4">
          <button
            type="button"
            disabled={isFirstStep || Boolean(savingStatus)}
            onClick={onPrevious}
            className="inline-flex min-h-10 items-center gap-1 px-1 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant transition-colors hover:text-secondary-container focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-container disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t("onboarding.tour.previous")}
          </button>
          <button
            type="button"
            disabled={Boolean(savingStatus)}
            onClick={onNext}
            className="inline-flex min-h-10 items-center gap-1 border border-secondary-container/70 px-3 font-mono text-[10px] uppercase tracking-widest text-secondary-container transition-colors hover:bg-secondary-container/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-container disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            {t(isLastStep ? "onboarding.tour.nextLast" : "onboarding.tour.next")}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={Boolean(savingStatus)}
            onClick={() => setRetryCount((count) => count + 1)}
            className="inline-flex min-h-9 items-center gap-1 px-1 font-mono text-[10px] uppercase tracking-widest text-outline transition-colors hover:text-secondary-container focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-container disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            <RotateCw className="h-3 w-3" aria-hidden="true" />
            {t("onboarding.tour.retry")}
          </button>
          {onRecovery && (targetBlocked || targetUnavailable) ? (
            <button
              type="button"
              disabled={Boolean(savingStatus)}
              onClick={onRecovery}
              className="inline-flex min-h-9 items-center gap-1 px-1 font-mono text-[10px] uppercase tracking-widest text-primary transition-colors hover:text-primary-fixed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              {t("onboarding.tour.openProjects")}
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/40 pt-3">
          <button
            type="button"
            disabled={Boolean(savingStatus)}
            onClick={onSkip}
            className="min-h-9 px-1 font-mono text-[10px] uppercase tracking-widest text-outline transition-colors hover:text-error-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-error-bright disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            {savingStatus === "skipped"
              ? t("onboarding.tour.skipping")
              : t("onboarding.tour.skip")}
          </button>
          <button
            type="button"
            disabled={Boolean(savingStatus)}
            onClick={onFinish}
            className="min-h-9 border border-tertiary/70 px-3 font-mono text-[10px] uppercase tracking-widest text-tertiary transition-colors hover:bg-tertiary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-tertiary disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            {savingStatus === "completed"
              ? t("onboarding.tour.finishing")
              : t("onboarding.tour.finish")}
          </button>
        </div>
      </div>
    </div>
  );
}
