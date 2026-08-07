import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-anthracite">
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-container/20 via-surface to-anthracite" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-container to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-secondary-container to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-sans text-headline-lg-mobile md:text-headline-lg text-secondary-container tracking-tighter uppercase">
            AnnotatePay
          </h1>
          <p className="font-mono text-data-sm text-on-surface-variant mt-2">
            TERMINAL_AUTH_V2.0.4
          </p>
        </div>

        <Suspense
          fallback={
            <div className="glass-card p-8 text-center font-mono text-data-sm text-secondary-container">
              BOOTING_AUTH...
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <div className="mt-8 font-mono text-[10px] text-on-surface-variant opacity-50 space-y-1">
          <p>&gt; Awaiting credentials...</p>
          <p>&gt; Connection established via wss://auth.annotatepay.local</p>
          <p className="text-secondary-container animate-pulse">&gt; Ready.</p>
        </div>
      </div>
    </div>
  );
}
