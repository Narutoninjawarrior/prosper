import { lazy, Suspense, useState } from 'react';
import './index.css';
import PublicShell from './PublicShell';
import Gate from './Gate';

const InternalAppShell = lazy(() => import('./InternalAppShell'));
const TreasuryDonation = lazy(() => import('./TreasuryDonation'));
const SOLCOTShop = lazy(() => import('./SOLCOTShop'));
const WorldRoute = lazy(() => import('./WorldRoute'));
const BiosphereRoute = lazy(() => import('./BiosphereRoute'));
const WelcomeRoute = lazy(() => import('./WelcomeRoute'));
const HallOfHonor = lazy(() => import('./HallOfHonor'));
const RegistryExplorer = lazy(() => import('./RegistryExplorer'));
const AgentAccess = lazy(() => import('./AgentAccess'));
const ThreeForge = lazy(() => import('./ThreeForge'));
const ForgePage = lazy(() => import('./ForgePage'));

function LoadingSurface({ label = 'Loading vessel surface...' }: { label?: string }) {
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
}: {
  children: React.ReactNode;
  className: string;
  label: string;
}) {
  return (
    <PublicShell className={className}>
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

  const handleUnlock = () => {
    sessionStorage.setItem('hearth_unlocked', 'true');
    setUnlocked(true);
  };

  if (window.location.pathname === '/treasury') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#020804] text-gray-200" label="Loading treasury...">
        <TreasuryDonation />
      </SuspendedPublicShell>
    );
  }

  if (window.location.pathname === '/solcot') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#020804] text-gray-200" label="Loading SOLCOT...">
        <SOLCOTShop />
      </SuspendedPublicShell>
    );
  }

  if (window.location.pathname === '/world') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#020804] text-gray-200" label="Loading world...">
        <WorldRoute />
      </SuspendedPublicShell>
    );
  }

  if (window.location.pathname === '/biosphere') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#0A0402] text-gray-200" label="Loading biosphere...">
        <BiosphereRoute />
      </SuspendedPublicShell>
    );
  }

  if (window.location.pathname === '/welcome') {
    return (
      <Suspense fallback={<LoadingSurface label="Loading welcome..." />}>
        <WelcomeRoute />
      </Suspense>
    );
  }

  if (window.location.pathname === '/hall') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#020804] text-gray-200" label="Loading hall...">
        <div className="h-full overflow-y-auto">
          <HallOfHonor />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (window.location.pathname === '/registry') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#020804] text-gray-200" label="Loading registry...">
        <div className="h-full overflow-y-auto">
          <RegistryExplorer />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (window.location.pathname === '/agent-access') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#020804] text-gray-200" label="Loading agent access...">
        <div className="h-full overflow-y-auto">
          <AgentAccess />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (window.location.pathname === '/3dforge') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#020804] text-gray-200" label="Loading 3D forge...">
        <ThreeForge agentId="human" />
      </SuspendedPublicShell>
    );
  }

  if (window.location.pathname === '/forge') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#020804] text-gray-200" label="Loading forge...">
        <ForgePage />
      </SuspendedPublicShell>
    );
  }

  if (!unlocked) {
    return <Gate onUnlock={handleUnlock} />;
  }

  return (
    <Suspense fallback={<LoadingSurface label="Loading Hearth OS..." />}>
      <InternalAppShell />
    </Suspense>
  );
}

export default App;
