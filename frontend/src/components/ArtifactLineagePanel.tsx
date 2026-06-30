import React from 'react';
import { GitCommit, GitBranch, ArrowRight, Clock, ShieldCheck, Database, HardDrive, Info } from 'lucide-react';
import type { FacilityManifest } from './FacilityBuildPlanner';

export interface ArtifactLineageStage {
  id: string;
  stage_type: 'draft' | 'export' | 'staging' | 'commons' | 'proof';
  title: string;
  status: 'active' | 'completed' | 'pending' | 'mocked';
  scope: 'local' | 'operator' | 'public';
  truthBadge: string;
  hasEvidence: boolean;
  evidenceLabel?: string;
  timestamp?: string;
  metadata?: string;
  linkAction?: () => void;
}

export interface ArtifactLineagePanelProps {
  manifest: FacilityManifest;
  hasExports: boolean;
  lastExportTime?: string;
  isStaged?: boolean;
  isCommonsHandoff?: boolean;
  proofReceiptHash?: string;
}

function scopeColor(scope: ArtifactLineageStage['scope']) {
  switch (scope) {
    case 'local': return 'text-[#60A5FA] border-[#60A5FA]/30 bg-[#60A5FA]/10';
    case 'operator': return 'text-[#D4A853] border-[#D4A853]/30 bg-[#D4A853]/10';
    case 'public': return 'text-[#34D399] border-[#34D399]/30 bg-[#34D399]/10';
  }
}

function stageIcon(type: ArtifactLineageStage['stage_type']) {
  switch (type) {
    case 'draft': return <GitBranch className="w-4 h-4" />;
    case 'export': return <HardDrive className="w-4 h-4" />;
    case 'staging': return <Database className="w-4 h-4" />;
    case 'commons': return <GitCommit className="w-4 h-4" />;
    case 'proof': return <ShieldCheck className="w-4 h-4" />;
  }
}

export default function ArtifactLineagePanel({
  manifest,
  hasExports,
  lastExportTime,
  isStaged = false,
  isCommonsHandoff = false,
  proofReceiptHash,
}: ArtifactLineagePanelProps) {

  // Build the logical chain
  const stages: ArtifactLineageStage[] = [
    {
      id: 'draft',
      stage_type: 'draft',
      title: 'Current Draft',
      status: 'active',
      scope: 'local',
      truthBadge: 'LOCAL: browser-only',
      hasEvidence: true,
      evidenceLabel: 'View Metadata',
      timestamp: manifest.updated_at,
      metadata: `${manifest.materials.filter(m => m.trim()).length} materials`,
    },
    {
      id: 'export',
      stage_type: 'export',
      title: 'Package Export',
      status: hasExports ? 'completed' : 'pending',
      scope: 'local',
      truthBadge: 'LOCAL: exported package',
      hasEvidence: hasExports,
      evidenceLabel: hasExports ? 'View Snapshot' : 'No evidence yet',
      timestamp: lastExportTime,
      metadata: hasExports ? 'Exported to local session' : 'Awaiting export',
    },
    {
      id: 'staging',
      stage_type: 'staging',
      title: 'Inventory Staged',
      status: isStaged ? 'completed' : 'pending',
      scope: 'operator',
      truthBadge: 'OPERATOR: system reservation',
      hasEvidence: isStaged,
      evidenceLabel: isStaged ? 'View Locker State' : 'No evidence yet',
      metadata: isStaged ? 'Resources reserved in locker' : 'Not staged',
    },
    {
      id: 'commons',
      stage_type: 'commons',
      title: 'Commons Handoff',
      status: isCommonsHandoff ? 'completed' : 'pending',
      scope: 'operator',
      truthBadge: 'OPERATOR: review intent',
      hasEvidence: isCommonsHandoff,
      evidenceLabel: isCommonsHandoff ? 'View Proposal' : 'No evidence yet',
      metadata: isCommonsHandoff ? 'Proposed to Commons' : 'Not proposed',
    },
  ];

  // Only append proof if a hash exists to maintain truth boundary
  if (proofReceiptHash) {
    stages.push({
      id: 'proof',
      stage_type: 'proof',
      title: 'Public Proof Log',
      status: 'completed',
      scope: 'public',
      truthBadge: 'PUBLIC: read-only event',
      hasEvidence: true,
      evidenceLabel: 'View Log Entry',
      metadata: `Hash: ${proofReceiptHash.substring(0, 8)}...`,
    });
  }

  return (
    <div className="border border-[#1A1410] rounded-lg overflow-hidden bg-black/20 font-mono text-sm">
      <div className="border-b border-[#2A1F16] p-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[#c9bba5]" />
          <h3 className="text-[#c9bba5] text-xs uppercase tracking-widest font-bold">Artifact Lineage</h3>
        </div>
        <div className="text-[9px] text-gray-500 uppercase tracking-widest bg-black/40 border border-[#2A1F16] px-2 py-1 rounded">
          Event history. Not a witness service. Local state shown.
        </div>
      </div>

      <div className="p-4 overflow-x-auto">
        <div className="flex items-start min-w-[600px] py-2">
          {stages.map((stage, idx) => {
            const isActiveOrCompleted = stage.status === 'active' || stage.status === 'completed';
            
            return (
              <React.Fragment key={stage.id}>
                <div className={`relative flex flex-col w-48 ${!isActiveOrCompleted ? 'opacity-40 grayscale' : ''}`}>
                  {/* Scope badge */}
                  <div className="mb-2">
                    <span className={`text-[8px] uppercase tracking-widest px-1.5 py-0.5 border rounded ${scopeColor(stage.scope)}`}>
                      {stage.truthBadge}
                    </span>
                  </div>
                  
                  {/* Node */}
                  <div className={`border rounded p-3 ${isActiveOrCompleted ? 'border-[#E8842A]/30 bg-[#E8842A]/5' : 'border-[#2A1F16] bg-black/40'}`}>
                    <div className="flex items-center gap-2 mb-2 border-b border-[#2A1F16]/50 pb-2">
                      <div className={isActiveOrCompleted ? 'text-[#E8842A]' : 'text-gray-600'}>
                        {stageIcon(stage.stage_type)}
                      </div>
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${isActiveOrCompleted ? 'text-white' : 'text-gray-500'}`}>
                        {stage.title}
                      </span>
                    </div>
                    
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest space-y-1 mb-2">
                      {stage.timestamp && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(stage.timestamp).toLocaleTimeString()}
                        </div>
                      )}
                      <div>{stage.metadata}</div>
                    </div>
                    
                    {/* Evidence Link */}
                    <div className="pt-2 border-t border-[#2A1F16]/50">
                      {stage.hasEvidence ? (
                        <button className="text-[9px] uppercase tracking-widest text-[#E8842A] hover:text-white transition-colors flex items-center gap-1">
                          ↳ {stage.evidenceLabel}
                        </button>
                      ) : (
                        <span className="text-[9px] uppercase tracking-widest text-gray-600 italic flex items-center gap-1">
                          ↳ {stage.evidenceLabel || 'No evidence yet'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Connector */}
                {idx < stages.length - 1 && (
                  <div className="flex items-center justify-center w-8 pt-10">
                    <ArrowRight className={`w-4 h-4 ${stages[idx + 1].status === 'pending' ? 'text-[#2A1F16]' : 'text-[#E8842A]/50'}`} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="bg-black/40 border-t border-[#2A1F16] p-3 text-[10px] text-gray-500 italic flex items-start gap-2">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div>
          Lineage shows the structured evolution of the current artifact. Local exports and staging are browser-only. 
          Commons handoffs and Proof Log events require explicit operator transmission.
        </div>
      </div>
    </div>
  );
}
