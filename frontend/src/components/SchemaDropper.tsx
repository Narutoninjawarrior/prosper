import React, { useState, useCallback } from 'react';
import { Upload, AlertCircle } from 'lucide-react';

interface SchemaDropperProps {
  onHydrate: (payload: any, type: string) => void;
  acceptedTypes?: string[];
}

export function SchemaDropper({ onHydrate, acceptedTypes = ['allonic', 'facility', 'biosystem'] }: SchemaDropperProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = (file: File) => {
    setError(null);
    if (!file.name.endsWith('.json')) {
      setError('[FILE_INGESTION_FAILED // UNSUPPORTED_LOCAL_SCHEMA]');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        
        let type = 'unknown';
        let actualPayload: any = null;
        let isLegacy = false;

        try {
          // Attempt to parse strictly first (for new v1 envelope)
          const parsed = JSON.parse(text);
          if (
            parsed && typeof parsed === 'object' &&
            parsed.schema_version === 'v1' && 
            parsed.planner_type && 
            parsed.payload && 
            parsed.content_hash
          ) {
            type = parsed.planner_type;
            actualPayload = parsed.payload;
          } else {
            // Valid JSON, but not a v1 envelope. Treat as legacy.
            actualPayload = parsed;
            isLegacy = true;
          }
        } catch (jsonErr) {
          // Legacy handling: strip trailing text and parse
          const cleanText = text.split('\n\ncontent_hash:')[0];
          try {
            actualPayload = JSON.parse(cleanText);
            isLegacy = true;
          } catch (legacyErr) {
            setError('[FILE_INGESTION_FAILED // CORRUPT_SCHEMA_PROPERTIES]');
            return;
          }
        }

        // If it's legacy, apply heuristics to guess planner type
        if (isLegacy && actualPayload) {
          if (actualPayload.schema === 'allonic-blueprint-v1' || (actualPayload.blueprint && actualPayload.summary && actualPayload.summary.total_mass_kg !== undefined)) {
            type = 'allonic';
          } else if (actualPayload.facility_type && actualPayload.estimated_power_needs !== undefined) {
            type = 'facility';
          } else if (actualPayload.reservoirCapacityGallons !== undefined && actualPayload.pumpFlowRateGpm !== undefined) {
            type = 'biosystem';
          } else {
            setError('[FILE_INGESTION_FAILED // INVALID_LOCAL_ENVELOPE]');
            return;
          }
        }

        if (acceptedTypes.includes(type) && actualPayload) {
          onHydrate(actualPayload, type);
        } else {
          setError('[FILE_INGESTION_FAILED // INVALID_LOCAL_ENVELOPE]');
        }
      } catch (err) {
        setError('[FILE_INGESTION_FAILED // CORRUPT_SCHEMA_PROPERTIES]');
      }
    };
    reader.onerror = () => {
      setError('[FILE_INGESTION_FAILED // FILE_READ_ERROR]');
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [acceptedTypes, onHydrate]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  return (
    <div className="mt-4 mb-4">
      <div 
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-dashed border-2 rounded-xl p-4 flex flex-col items-center justify-center transition-colors cursor-pointer text-center relative ${dragOver ? 'border-[#34D399] bg-[#34D399]/10' : 'border-slate-800 bg-slate-950/40 hover:bg-slate-900/50'}`}
        onClick={() => document.getElementById('schema-upload')?.click()}
      >
        <Upload size={20} className={dragOver ? 'text-[#34D399] mb-2' : 'text-slate-500 mb-2'} />
        <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-slate-300">
          Load local export
        </div>
        <div className="text-[10px] mt-1 text-slate-500 font-sans max-w-[200px] leading-snug">
          Reopen a previously exported local planner file in this browser session.
        </div>
        <input 
          type="file" 
          id="schema-upload" 
          className="hidden" 
          accept=".json"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              processFile(e.target.files[0]);
            }
          }}
        />
      </div>
      {error && (
        <div className="mt-2 text-[10px] font-mono text-red-400 flex items-center gap-1.5 bg-red-500/10 px-3 py-1.5 rounded border border-red-500/20">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
    </div>
  );
}
