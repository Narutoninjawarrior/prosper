import type { ReactNode } from 'react';
import LegalFooter from './LegalFooter';
import PublicNav from './shell/PublicNav';
import { AudioInspector } from './components/AudioInspector';

/** Full-screen public routes (/biosphere, /world, etc.) with nav + compliance footer. */
export default function PublicShell({
  children,
  className = 'h-screen w-screen',
  showNav = true,
  showFooter = true,
  showAudio = true,
  navCompact = false,
}: {
  children: ReactNode;
  className?: string;
  showNav?: boolean;
  showFooter?: boolean;
  showAudio?: boolean;
  navCompact?: boolean;
}) {
  return (
    <div className={`${className} relative flex flex-col`}>
      {showNav && <PublicNav compact={navCompact} />}
      <div className="flex-1 relative overflow-hidden">{children}</div>
      {showFooter && (
        <div className="pointer-events-auto shrink-0 py-2 bg-black/40 backdrop-blur-sm border-t border-white/5">
          <LegalFooter className="!text-gray-500" />
        </div>
      )}
      {showAudio && <AudioInspector />}
    </div>
  );
}
