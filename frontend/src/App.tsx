import { lazy, Suspense, useEffect, useState } from 'react';
import './index.css';
import PublicShell from './PublicShell';
import Gate from './Gate';
import { registerAgentTools } from './lib/agentTools';

const LandingPage = lazy(() => import('./LandingPage'));
const InternalAppShell = lazy(() => import('./InternalAppShell'));
const TreasuryDonation = lazy(() => import('./TreasuryDonation'));
const SOLCOTShop = lazy(() => import('./SOLCOTShop'));
const Exchange = lazy(() => import('./Exchange'));
const WorldRoute = lazy(() => import('./WorldRoute'));
const BiosphereRoute = lazy(() => import('./BiosphereRoute'));
const WelcomeRoute = lazy(() => import('./WelcomeRoute'));
const HallOfHonor = lazy(() => import('./HallOfHonor'));
const RegistryExplorer = lazy(() => import('./RegistryExplorer'));
const AgentAccess = lazy(() => import('./AgentAccess'));
const AgentProfile = lazy(() => import('./AgentProfile'));
const LodgeMindRoute = lazy(() => import('./LodgeMindRoute'));
const ActivityDashboard = lazy(() => import('./ActivityDashboard'));
const GenerativeWorkbench = lazy(() => import('./GenerativeWorkbench'));
const ThreeForge = lazy(() => import('./ThreeForge'));
const ForgePage = lazy(() => import('./ForgePage'));
const CouncilBoard = lazy(() => import('./CouncilBoard'));
const ObservatoryRoute = lazy(() => import('./ObservatoryRoute'));
const CommonsRoute = lazy(() => import('./CommonsRoute'));
const BotCapabilityCatalog = lazy(() => import('./components/BotCapabilityCatalog'));
const RouteHealthPage = lazy(() => import('./RouteHealthPage'));
const ProofLogPage = lazy(() => import('./ProofLogPage'));
const ReviewPage = lazy(() => import('./ReviewPage'));
const OperationsPage = lazy(() => import('./OperationsPage'));
const ProjectsPage = lazy(() => import('./ProjectsPage'));
const SovereignGallery = lazy(() => import('./components/SovereignGallery'));
const DossierRoute = lazy(() => import('./DossierRoute'));
const HandoffPublicPage = lazy(() => import('./HandoffPublicPage'));

const HiveTester = lazy(() => import('./HiveTester'));
const WitnessPage = lazy(() => import('./WitnessPage').then(m => ({ default: m.WitnessPage })));
const PricingPage = lazy(() => import('./PricingPage').then(m => ({ default: m.PricingPage })));
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

  if (pathname === '/treasury') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#020804] text-gray-200" label="Loading treasury...">
        <TreasuryDonation />
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/solcot') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#020804] text-gray-200" label="Loading SOLCOT...">
        <SOLCOTShop />
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/exchange') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#050806] text-gray-200" label="Loading Patronage Gateway...">
        <div className="h-full overflow-y-auto">
          <Exchange />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/world') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#020804] text-gray-200" label="Loading world..." showAudio={false}>
        <WorldRoute />
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/observatory') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#020804] text-gray-200" label="Loading observatory...">
        <ObservatoryRoute />
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/commons') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#050806] text-gray-200" label="Loading commons..." showAudio={false}>
        <CommonsRoute />
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/biosphere') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#0A0402] text-gray-200" label="Loading biosphere...">
        <BiosphereRoute />
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/welcome') {
    return (
      <Suspense fallback={<LoadingSurface label="Loading welcome..." />}>
        <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading welcome...">
          <div className="min-h-full overflow-y-auto">
            <WelcomeRoute />
          </div>
        </SuspendedPublicShell>
      </Suspense>
    );
  }

  if (pathname === '/route-health') {
    return (
      <Suspense fallback={<LoadingSurface label="Loading health metrics..." />}>
        <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading health metrics..." showAudio={false}>
          <div className="min-h-full overflow-y-auto">
            <RouteHealthPage />
          </div>
        </SuspendedPublicShell>
      </Suspense>
    );
  }

  if (pathname === '/proof-log') {
    return (
      <Suspense fallback={<LoadingSurface label="Loading proof log..." />}>
        <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading proof log..." showAudio={false}>
          <div className="min-h-full overflow-y-auto">
            <ProofLogPage />
          </div>
        </SuspendedPublicShell>
      </Suspense>
    );
  }

  if (pathname === '/operations') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading operations..." showAudio={false}>
        <div className="h-full overflow-y-auto">
          <OperationsPage />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/projects') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading projects..." showAudio={false}>
        <div className="h-full overflow-y-auto">
          <ProjectsPage />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/gallery') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading sovereign gallery..." showAudio={false}>
        <div className="h-full overflow-y-auto">
          <SovereignGallery />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/hall') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#020804] text-gray-200" label="Loading hall...">
        <div className="h-full overflow-y-auto">
          <HallOfHonor />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/registry') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#020804] text-gray-200" label="Loading registry...">
        <div className="h-full overflow-y-auto">
          <RegistryExplorer />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/review') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#050806] text-gray-200" label="Loading Review Guide..." showAudio={false}>
        <div className="h-full overflow-y-auto">
          <ReviewPage />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/agent-access') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#020804] text-gray-200" label="Loading agent access...">
        <div className="h-full overflow-y-auto">
          <AgentAccess />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/activity') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading activity..." showAudio={false}>
        <div className="h-full overflow-y-auto">
          <ActivityDashboard />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname.startsWith('/agent/')) {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading agent profile...">
        <div className="h-full overflow-y-auto">
          <AgentProfile />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/workbench') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading workbench...">
        <div className="h-full overflow-y-auto">
          <GenerativeWorkbench />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/lodge-mind') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#020804] text-gray-200" label="Loading lodge mind...">
        <div className="h-full overflow-y-auto">
          <LodgeMindRoute />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/3dforge') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#020804] text-gray-200" label="Loading 3D forge..." showAudio={false}>
        <ThreeForge agentId="human" />
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/forge') {
    return (
      <SuspendedPublicShell className="h-screen w-screen bg-[#020804] text-gray-200" label="Loading forge..." showAudio={false}>
        <ForgePage />
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/council') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading council chamber...">
        <div className="h-full overflow-y-auto">
          <CouncilBoard />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/entitlements') {
    return (
      <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading entitlements console..." showAudio={false}>
        <div className="h-full overflow-y-auto p-4 max-w-5xl mx-auto">
          <BotCapabilityCatalog />
        </div>
      </SuspendedPublicShell>
    );
  }

  if (pathname === '/os/hive') {
    return (
      <Suspense fallback={<LoadingSurface label="Loading Hive Tester..." />}>
        <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading Hive Tester...">
          <div className="min-h-full overflow-y-auto">
            <HiveTester />
          </div>
        </SuspendedPublicShell>
      </Suspense>
    );
  }

  if (pathname === '/witness') {
    return (
      <Suspense fallback={<LoadingSurface label="Loading Record Trail..." />}>
        <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading Record Trail...">
          <div className="min-h-full overflow-y-auto">
            <WitnessPage />
          </div>
        </SuspendedPublicShell>
      </Suspense>
    );
  }

  if (pathname === '/pricing') {
    return (
      <Suspense fallback={<LoadingSurface label="Loading Pricing..." />}>
        <SuspendedPublicShell className="min-h-screen w-screen bg-[#050806] text-gray-200" label="Loading Pricing...">
          <div className="min-h-full overflow-y-auto">
            <PricingPage />
          </div>
        </SuspendedPublicShell>
      </Suspense>
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
      <Suspense fallback={<LoadingSurface label="Loading handoff..." />}>
        <HandoffPublicPage />
      </Suspense>
    );
  }

  if (pathname === '/handoff') {
    return (
      <Suspense fallback={<LoadingSurface label="Decrypting Dossier..." />}>
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
