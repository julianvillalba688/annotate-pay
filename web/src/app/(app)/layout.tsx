import { SideNav } from "@/components/layout/SideNav";
import { MobileNav } from "@/components/layout/MobileNav";
import { AppHeader } from "@/components/layout/AppHeader";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) { 
  return (
    <div className="min-h-screen bg-anthracite">
      <SideNav />
      <div className="md:ml-64 flex flex-col min-h-screen pb-20 md:pb-0">
        <AppHeader />
        <main className="flex-1 w-full p-margin-mobile md:p-margin-desktop max-w-container-max mx-auto">
          {children}
        </main>
      </div>
      <MobileNav />
      <Suspense fallback={null}>
        <OnboardingTour />
      </Suspense>
    </div>
  );
}
