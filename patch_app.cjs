const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.tsx', 'utf8');

// 1. LoadingSurface
code = code.replace(
  "function LoadingSurface({ label = 'Loading vessel surface...' }: { label?: string }) {",
  "function LoadingSurface({ label = 'Loading route module...' }: { label?: string }) {"
);
code = code.replace(
  "text-sm uppercase tracking-[0.28em] text-[#8a7a64]",
  "text-[10px] uppercase tracking-[0.28em] text-[#6b5d4b]"
);

// 2. SuspendedPublicShell signature
code = code.replace(
  /function SuspendedPublicShell\(\{\s+children,\s+className,\s+label,\s+\}: \{\s+children: React\.ReactNode;\s+className: string;\s+label: string;\s+\}\) \{/m,
  `function SuspendedPublicShell({
  children,
  className,
  label,
  showAudio = true,
}: {
  children: React.ReactNode;
  className: string;
  label: string;
  showAudio?: boolean;
}) {`
);

// 3. SuspendedPublicShell return
code = code.replace(
  /<PublicShell className=\{className\}>/g,
  '<PublicShell className={className} showAudio={showAudio}>'
);

// 4. Update AgentAccess
code = code.replace(
  /label="Loading agent access...">/g,
  'label="Loading agent access..." showAudio={false}>'
);

// 5. Update CottageAssemblyLine
code = code.replace(
  /label="Loading cottage assembly line...">/g,
  'label="Loading cottage assembly line..." showAudio={false}>'
);

// 6. Update GenerativeWorkbench
code = code.replace(
  /label="Loading workbench...">/g,
  'label="Loading workbench..." showAudio={false}>'
);

fs.writeFileSync('frontend/src/App.tsx', code);
console.log('App.tsx updated');
