import { lazy, Suspense, useEffect, useState } from 'react';
import './index.css';
import PublicShell from './PublicShell';
import Gate from './Gate';
import { registerAgentTools } from './lib/agentTools';

const LandingPage = lazy(() => import('./LandingPage'));
const InternalAppShell = lazy(() => import('./InternalAppShell'));
const HallOfHonor = lazy(() => import('./HallOfHonor'));
const ReviewPage = lazy(() => import('./ReviewPage'));
const ProjectsPage = lazy(() => import('./ProjectsPage'));
const DossierRoute = lazy(() => import('./DossierRoute'));
const HandoffPublicPage = lazy(() => import('./HandoffPublicPage'));

function LoadingSurface({ label = 'Loading workspace...' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center bg-[#020804] px-6 text-center text-sm uppercase tracking-[0.28em] text-[#8a7a64]">
      {label}
    </div>
  );
}

function SuspendedPublicShell({
  children,
  className,
  label,
  showAudio = true,
}: {
  children: React.ReactNode;
  className: string;
  label: string;
  showAudio?: boolean;
}) {
  return (
    <PublicShell className={className} showAudio={showAudio}>
      <Suspense fallback={<LoadingSurface label={label} />}>
        {children}
      </Suspense>
    </PublicShell>
  );
}

function App() {
  const [unlocked, setUnlocked] = useState(() => {
    return sessionStorage.getItem('hearth_unlocked') === 'true';
  });
  const pathname = window.location.pathname;

  useEffect(() => {
    registerAgentTools();
  }, []);

  const handleUnlock = () => {
    sessionStorage.setItem('hearth_unlocked', 'true');
    setUnlocked(true);
  };

  if (pathname === '/projects') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading projects..." showAudio={false}>
        <div className="h-full overflow-y-auto">
          <ProjectsPage />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/hall') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#020804] text-gray-200" label="Loading directory...">
        <div className="h-full overflow-y-auto">
          <HallOfHonor />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/review') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#050806] text-gray-200" label="Loading review..." showAudio={false}>
        <div className="h-full overflow-y-auto">
          <ReviewPage />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/' || pathname === '/explore') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806]" label="Loading Prosper...">
        <div className="min-h-full overflow-y-auto">
          <LandingPage />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname.startsWith('/handoff/')) {
    return (
      <Suspense fallback={<LoadingSurface label="Loading published update..." />}>
        <HandoffPublicPage />
      </Suspense>
    );
  }

  if (pathname === '/handoff') {
    return (
      <Suspense fallback={<LoadingSurface label="Loading published updates..." />}>
        <DossierRoute />
      </Suspense>
    );
  }

  // The rest of the routes, if not matched, go to the internal workspace (/hearth or fallback)
  if (!unlocked) {
    return <Gate onUnlock={handleUnlock} />;
  }

  return (
    <Suspense fallback={<LoadingSurface label="Loading workspace..." />}>
      <InternalAppShell />
    </Suspense>
  );
}

export default App;
