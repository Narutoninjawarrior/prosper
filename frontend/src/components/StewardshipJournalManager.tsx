import React, { useState, useEffect, useMemo } from 'react';
import type { 
  StewardshipJournalEntryV1,
  MeasurementV1,
  CareOptionV1,
  PredictionV1,
  DecisionV1,
  OutcomeV1,
  ModelReplacementRecordV1,
  StewardshipStorageEnvelopeV1
} from '../lib/stewardshipJournal';
import { 
  validateStewardshipJournalEntry, 
  compileStewardshipToWorkCard,
  parseAndValidateEnvelope
} from '../lib/stewardshipJournal';
import { runSqliteSpike, checkOpfsAvailable } from '../lib/sqliteStewardship';
import type { SqliteDiagnosticsResult } from '../lib/sqliteStewardship';
import type { StopConditionV1 } from '../lib/physicalWorkPack';
import { 
  Download, 
  Upload, 
  X, 
  AlertTriangle, 
  BookOpen, 
  HelpCircle,
  Wrench,
  Check
} from 'lucide-react';

const JOURNAL_STORAGE_KEY = 'hearth_stewardship_journal_v1';

const initialExampleEntries: StewardshipJournalEntryV1[] = [
  {
    entry_id: 'example-cacao-entry-1',
    observation_id: 'example-cacao-obs-1',
    living_asset_id: 'example-cacao-habitat-04',
    steward_continuity_id: 'continuity-example-steward',
    data_freshness_seconds: 60,
    observation: {
      timestamp: '2026-07-01T08:00:00Z',
      source: 'cacao-humidity-sensor-04',
      measurements: [
        { metric_name: 'relative_humidity', value: 65, unit: '%' }
      ]
    },
    model_proposal: {
      proposal_id: 'prop-cacao-01',
      model_provider: 'Local AI running on edge node',
      model_name: 'Hermes-2B',
      model_version: 'v1.0.0',
      care_options: [
        {
          option_id: 'cacao-opt-mist',
          label: 'Canopy Misting',
          description: 'Trigger misting loop for 5 minutes to restore relative humidity',
          estimated_labor_hours: 0.1,
          stop_conditions: [
            { condition_id: 'abort_humidity', description: 'Humidity reaches 80%', required_response: 'Halt misting loop' }
          ]
        }
      ],
      suggested_option_id: 'cacao-opt-mist',
      model_reported_uncertainty: 0.12,
      reasoning: 'Humidity falls below the recommended 70-85% band. Prompt misting recommended.'
    },
    prediction: {
      metric_name: 'relative_humidity',
      predicted_value_range_min: 73,
      predicted_value_range_max: 78,
      metric_unit: '%',
      time_horizon: '10 minutes post misting'
    },
    decision: {
      selected_option: 'cacao-opt-mist',
      reasoning: 'Approved. Fits within standard conservatory operating boundaries.',
      approved_by_human: true,
      reviewed_by_steward_id: 'steward-operator-alpha'
    },
    outcome: {
      observed_at: '2026-07-01T08:12:00Z',
      observation_source: 'cacao-humidity-sensor-04',
      metric_name: 'relative_humidity',
      observed_value: 75,
      metric_unit: '%',
      calculated_prediction_error: 0, // falls inside the predicted range [73, 78]
      correction_notes: 'Response curve matches predicted range. No model drift detected.'
    },
    meta: {
      label: 'Cacao Habitat Example Entry (Demonstration Only)'
    }
  },
  {
    entry_id: 'example-aquaponics-entry-2',
    observation_id: 'example-aquaponics-obs-2',
    living_asset_id: 'example-aquaponics-growbed-01',
    steward_continuity_id: 'continuity-example-steward',
    data_freshness_seconds: 120,
    observation: {
      timestamp: '2026-07-01T09:00:00Z',
      source: 'water-nitrate-colorimeter',
      measurements: [
        { metric_name: 'nitrate_level', value: 45, unit: 'ppm' }
      ]
    },
    model_proposal: {
      proposal_id: 'prop-aqua-02',
      model_provider: 'Local AI running on edge node',
      model_name: 'Gemma-2B',
      model_version: 'v1.1.0',
      care_options: [
        {
          option_id: 'aqua-opt-dilution',
          label: 'Nitrate Water Dilution',
          description: 'Dilute the fish tank volume by 10% to reduce total nitrates',
          estimated_labor_hours: 1.5,
          stop_conditions: [
            { condition_id: 'abort_level', description: 'Nitrate drops below 20 ppm', required_response: 'Halt dilution loop' }
          ]
        }
      ],
      suggested_option_id: 'aqua-opt-dilution',
      model_reported_uncertainty: 0.28,
      reasoning: 'Nitrate is high; fish tank biofilter conversion rate is normal but accumulation exceeds safe crop roots threshold.'
    },
    prediction: {
      metric_name: 'nitrate_level',
      predicted_value_range_min: 30,
      predicted_value_range_max: 35,
      metric_unit: 'ppm',
      time_horizon: '2 hours post dilution'
    },
    meta: {
      label: 'Aquaponics Example Entry (Awaiting Outcome Decision)'
    }
  }
];

export default function StewardshipJournalManager() {
  const [entries, setEntries] = useState<StewardshipJournalEntryV1[]>(() => {
    const saved = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (saved) {
      const { envelope, errors } = parseAndValidateEnvelope(saved);
      if (envelope) {
        if (errors.length > 0) {
          console.warn('Stewardship journal loaded with validation errors/warnings:', errors);
        }
        return envelope.entries;
      }
    }
    return initialExampleEntries;
  });

  const [sqliteResult, setSqliteResult] = useState<SqliteDiagnosticsResult | null>(null);
  const [runningSqlite, setRunningSqlite] = useState(false);

  const handleRunSqliteSpike = async () => {
    setRunningSqlite(true);
    setSqliteResult(null);
    try {
      const activeOrDemo = activeEntry || entries[0] || initialExampleEntries[0];
      const res = await runSqliteSpike(activeOrDemo);
      setSqliteResult(res);
    } catch (err: any) {
      setSqliteResult({
        opfsAvailable: checkOpfsAvailable(),
        sqliteInitialized: false,
        errors: [String(err)],
        testOutput: ['Fatal runner exception occurred.'],
        queriedEntriesByAsset: [],
        queriedEntriesWithError: []
      });
    } finally {
      setRunningSqlite(false);
    }
  };

  const [selectedEntryId, setSelectedEntryId] = useState<string>(() => {
    return initialExampleEntries[0]?.entry_id || '';
  });

  // State for forms
  const [newLivingAssetId, setNewLivingAssetId] = useState('example-cacao-habitat-04');
  const [newStewardContinuityId, setNewStewardContinuityId] = useState('steward-continuity-1');
  const [newObsSource, setNewObsSource] = useState('operator-field-manual');
  
  // Measurement dynamic rows
  const [measurements, setMeasurements] = useState<MeasurementV1[]>([
    { metric_name: 'relative_humidity', value: 68, unit: '%' }
  ]);
  const [measName, setMeasName] = useState('');
  const [measValue, setMeasValue] = useState('');
  const [measUnit, setMeasUnit] = useState('');

  // Model Proposal State
  const [proposalProvider, setProposalProvider] = useState('Local AI');
  const [proposalModel, setProposalModel] = useState('Hermes-2B');
  const [proposalVersion, setProposalVersion] = useState('v1.0.0');
  const [proposalUncertainty, setProposalUncertainty] = useState(0.2);
  const [proposalReasoning, setProposalReasoning] = useState('');
  
  // Dynamic Care Options
  const [careOptions, setCareOptions] = useState<CareOptionV1[]>([
    {
      option_id: 'opt-mist-1',
      label: 'Misting Cycle',
      description: 'Activate misting loop for 5 minutes',
      estimated_labor_hours: 0.1,
      stop_conditions: [
        { condition_id: 'abort_humidity', description: 'Humidity reached 80%', required_response: 'Halt misting' }
      ]
    }
  ]);
  const [optLabel, setOptLabel] = useState('');
  const [optDesc, setOptDesc] = useState('');
  const [optLabor, setOptLabor] = useState(0.5);
  const [optStopConds, setOptStopConds] = useState('abort_manual | Manual operator override | Cut power');

  // Predictions State (Optional)
  const [hasPrediction, setHasPrediction] = useState(true);
  const [predMetric, setPredMetric] = useState('relative_humidity');
  const [predMin, setPredMin] = useState(70);
  const [predMax, setPredMax] = useState(80);
  const [predUnit, setPredUnit] = useState('%');
  const [predHorizon, setPredHorizon] = useState('15 minutes');

  // Decision State for current entry edit
  const [selectedCareOption, setSelectedCareOption] = useState('opt-mist-1');
  const [decisionReasoning, setDecisionReasoning] = useState('');
  const [humanApproved, setHumanApproved] = useState(true);
  const [reviewerStewardId, setReviewerStewardId] = useState('steward-operator-1');

  // Outcome State for current entry edit
  const [hasOutcome, setHasOutcome] = useState(false);
  const [outcomeSource, setOutcomeSource] = useState('operator-field-manual');
  const [outcomeMetric, setOutcomeMetric] = useState('relative_humidity');
  const [outcomeValue, setOutcomeValue] = useState(74);
  const [outcomeUnit, setOutcomeUnit] = useState('%');
  const [outcomeNotes, setOutcomeNotes] = useState('');

  // Model replacement record form
  const [showReplacementForm, setShowReplacementForm] = useState(false);
  const [prevModelName, setPrevModelName] = useState('Hermes-2B');
  const [nextModelName, setNextModelName] = useState('Gemma-2B');
  const [replacementReason, setReplacementReason] = useState('Upgraded model version for better prediction precision.');

  // Work card compile modal or preview
  const [compiledWorkCard, setCompiledWorkCard] = useState<any>(null);
  const [isOperatorApproved, setIsOperatorApproved] = useState(false);

  // Save entries to localStorage within a versioned envelope
  useEffect(() => {
    const envelope: StewardshipStorageEnvelopeV1 = {
      schema_version: 1,
      schema: 'stewardship-journal-envelope-v1',
      journal_id: 'local-default-journal',
      storage_scope: 'browser-local',
      entries,
      updated_at: new Date().toISOString()
    };
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(envelope));
  }, [entries]);

  // Handle active selected entry detail loading
  const activeEntry = useMemo(() => {
    return entries.find(e => e.entry_id === selectedEntryId);
  }, [entries, selectedEntryId]);

  // Load active entry decisions & outcomes into local edit state
  useEffect(() => {
    if (activeEntry) {
      if (activeEntry.decision) {
        setSelectedCareOption(activeEntry.decision.selected_option);
        setDecisionReasoning(activeEntry.decision.reasoning);
        setHumanApproved(activeEntry.decision.approved_by_human);
        setReviewerStewardId(activeEntry.decision.reviewed_by_steward_id);
      } else {
        setSelectedCareOption(activeEntry.model_proposal.care_options[0]?.option_id || 'REFUSE_ALL');
        setDecisionReasoning('');
        setHumanApproved(true);
        setReviewerStewardId('steward-operator-1');
      }

      if (activeEntry.outcome) {
        setHasOutcome(true);
        setOutcomeSource(activeEntry.outcome.observation_source);
        setOutcomeMetric(activeEntry.outcome.metric_name);
        setOutcomeValue(activeEntry.outcome.observed_value);
        setOutcomeUnit(activeEntry.outcome.metric_unit);
        setOutcomeNotes(activeEntry.outcome.correction_notes || '');
      } else {
        setHasOutcome(false);
        setOutcomeSource('operator-field-manual');
        setOutcomeMetric(activeEntry.prediction?.metric_name || activeEntry.observation.measurements[0]?.metric_name || '');
        setOutcomeValue(0);
        setOutcomeUnit(activeEntry.prediction?.metric_unit || activeEntry.observation.measurements[0]?.unit || '');
        setOutcomeNotes('');
      }
    }
  }, [activeEntry]);

  // Validation report for selected entry
  const entryValidationReport = useMemo(() => {
    if (!activeEntry) return [];
    return validateStewardshipJournalEntry(activeEntry);
  }, [activeEntry]);

  // Calculate prediction error
  const calculateErrorValue = (val: number, pred: PredictionV1 | undefined): number | null => {
    if (!pred) return null;
    if (val >= pred.predicted_value_range_min && val <= pred.predicted_value_range_max) {
      return 0; // zero error inside the target envelope
    }
    const distMin = Math.abs(val - pred.predicted_value_range_min);
    const distMax = Math.abs(val - pred.predicted_value_range_max);
    return Number(Math.min(distMin, distMax).toFixed(2));
  };

  // Add Measurement Row to form
  const addMeasurementRow = () => {
    if (!measName || !measValue || !measUnit) return;
    setMeasurements([
      ...measurements,
      { metric_name: measName, value: Number(measValue), unit: measUnit }
    ]);
    setMeasName('');
    setMeasValue('');
    setMeasUnit('');
  };

  // Add Care Option to form
  const addCareOptionRow = () => {
    if (!optLabel || !optDesc) return;
    const parseStopConditions = (str: string): StopConditionV1[] => {
      return str.split('\n').map(line => {
        const parts = line.split('|').map(s => s.trim());
        if (parts[0]) {
          return {
            condition_id: parts[0],
            description: parts[1] || '',
            required_response: parts[2] || ''
          };
        }
        return null;
      }).filter((c): c is StopConditionV1 => c !== null);
    };

    setCareOptions([
      ...careOptions,
      {
        option_id: `opt-${Date.now()}`,
        label: optLabel,
        description: optDesc,
        estimated_labor_hours: optLabor,
        stop_conditions: parseStopConditions(optStopConds)
      }
    ]);

    setOptLabel('');
    setOptDesc('');
    setOptLabor(0.5);
    setOptStopConds('abort_manual | Manual operator override | Cut power');
  };

  // Save decision
  const saveActiveDecision = () => {
    if (!activeEntry) return;

    const newDecision: DecisionV1 = {
      selected_option: selectedCareOption,
      reasoning: decisionReasoning,
      approved_by_human: humanApproved,
      reviewed_by_steward_id: reviewerStewardId
    };

    const updated = entries.map(e => {
      if (e.entry_id === activeEntry.entry_id) {
        return {
          ...e,
          decision: newDecision
        };
      }
      return e;
    });

    setEntries(updated);
  };

  // Save outcome
  const saveActiveOutcome = () => {
    if (!activeEntry) return;

    let computedErr: number | null = null;
    if (hasOutcome && activeEntry.prediction) {
      const match = activeEntry.prediction.metric_name === outcomeMetric && activeEntry.prediction.metric_unit === outcomeUnit;
      if (match) {
        computedErr = calculateErrorValue(outcomeValue, activeEntry.prediction);
      }
    }

    const newOutcome: OutcomeV1 = {
      observed_at: new Date().toISOString(),
      observation_source: outcomeSource,
      metric_name: outcomeMetric,
      observed_value: Number(outcomeValue),
      metric_unit: outcomeUnit,
      calculated_prediction_error: computedErr,
      correction_notes: outcomeNotes
    };

    const updated = entries.map(e => {
      if (e.entry_id === activeEntry.entry_id) {
        return {
          ...e,
          outcome: hasOutcome ? newOutcome : undefined
        };
      }
      return e;
    });

    setEntries(updated);
  };

  // Create new entry
  const createJournalEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const entryId = `entry-${Date.now()}`;
    const obsId = `obs-${Date.now()}`;

    const newEntry: StewardshipJournalEntryV1 = {
      entry_id: entryId,
      observation_id: obsId,
      living_asset_id: newLivingAssetId,
      steward_continuity_id: newStewardContinuityId,
      data_freshness_seconds: 60,
      observation: {
        timestamp: new Date().toISOString(),
        source: newObsSource,
        measurements: [...measurements]
      },
      model_proposal: {
        proposal_id: `prop-${Date.now()}`,
        model_provider: proposalProvider,
        model_name: proposalModel,
        model_version: proposalVersion,
        care_options: [...careOptions],
        suggested_option_id: careOptions[0]?.option_id,
        model_reported_uncertainty: Number(proposalUncertainty),
        reasoning: proposalReasoning
      },
      ...(hasPrediction ? {
        prediction: {
          metric_name: predMetric,
          predicted_value_range_min: Number(predMin),
          predicted_value_range_max: Number(predMax),
          metric_unit: predUnit,
          time_horizon: predHorizon
        }
      } : {})
    };

    setEntries([newEntry, ...entries]);
    setSelectedEntryId(entryId);

    // Reset temporary states
    setMeasurements([{ metric_name: 'relative_humidity', value: 68, unit: '%' }]);
    setProposalReasoning('');
  };

  // Handle Model Replacement Handoff
  const executeModelReplacement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEntry) return;

    const replacementRecord: ModelReplacementRecordV1 = {
      previous_model: prevModelName,
      current_model: nextModelName,
      transition_timestamp: new Date().toISOString(),
      reason_for_replacement: replacementReason
    };

    const updated = entries.map(entry => {
      if (entry.entry_id === activeEntry.entry_id) {
        return {
          ...entry,
          model_replacement: replacementRecord
        };
      }
      return entry;
    });

    setEntries(updated);
    setShowReplacementForm(false);
  };

  // Compile Work Card Draft
  const handleCompileWorkCard = (option: CareOptionV1) => {
    if (!activeEntry || !isOperatorApproved) return;
    const card = compileStewardshipToWorkCard(activeEntry, option);
    setCompiledWorkCard(card);
  };

  // Download compiled work card
  const downloadCompiledCard = () => {
    if (!compiledWorkCard || !isOperatorApproved) return;
    const data = JSON.stringify(compiledWorkCard, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${compiledWorkCard.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCompiledWorkCard(null);
  };

  // Export Journal List JSON
  const handleExportJournal = () => {
    const envelope: StewardshipStorageEnvelopeV1 = {
      schema_version: 1,
      schema: 'stewardship-journal-envelope-v1',
      journal_id: 'local-default-journal',
      storage_scope: 'browser-local',
      entries,
      updated_at: new Date().toISOString()
    };
    const data = JSON.stringify(envelope, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stewardship-journal-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import Journal List JSON
  const handleImportJournal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const raw = event.target?.result as string;
      const { envelope, errors, malformed } = parseAndValidateEnvelope(raw);
      if (malformed || !envelope) {
        const errorList = errors.map(err => `[${err.level.toUpperCase()}] ${err.field}: ${err.message}`).join('\n');
        alert(`Failed to import stewardship journal due to schema/validation errors:\n${errorList}`);
        return;
      }
      
      setEntries(envelope.entries);
      if (envelope.entries.length > 0) {
        setSelectedEntryId(envelope.entries[0].entry_id);
      }
      
      if (errors.length > 0) {
        const warnings = errors.filter(e => e.level === 'warning');
        if (warnings.length > 0) {
          alert(`Imported with warnings:\n${warnings.map(w => w.message).join('\n')}`);
        } else {
          alert('Stewardship journal imported successfully.');
        }
      } else {
        alert('Stewardship journal imported successfully.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-6 text-sm text-gray-300 font-sans">
      
      {/* Header and warnings */}
      <div className="border border-[#D4A853]/20 bg-[#D4A853]/5 rounded-lg p-4">
        <h3 className="text-white font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#D4A853]" />
          <span>Sovereign AI Stewardship Journal</span>
        </h3>
        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
          Stewardship Journaling establishes human responsibility, choice, and feedback around care for living habitats. 
          All calculations are client-side. Clearing browser data will delete local copies unless exported.
        </p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] text-gray-400 font-mono">
          <div className="bg-black/20 p-2.5 rounded border border-white/5">
            <span className="text-[#34D399] uppercase block mb-1">What This Can Measure</span>
            - Model suggestion consistency against real-world metrics<br />
            - Long-term sensor response drift<br />
            - Prediction accuracy range intervals (calculated error)
          </div>
          <div className="bg-black/20 p-2.5 rounded border border-white/5">
            <span className="text-[#EF4444] uppercase block mb-1">What This Cannot Establish</span>
            - Machine consciousness or emotional preference<br />
            - Autobiographical model memories or subjective feelings<br />
            - Independent verification of manually reported outcomes
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Column 1: Timeline List */}
        <div className="flex flex-col gap-4 border border-[#2A1F16] bg-black/20 p-4 rounded-xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h4 className="text-white font-mono text-xs uppercase tracking-widest font-bold">
              Entry Timeline ({entries.length})
            </h4>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10px] uppercase text-[#60A5FA] cursor-pointer border border-[#60A5FA]/20 px-2 py-1 rounded bg-[#60A5FA]/5 hover:bg-[#60A5FA]/20">
                <Upload className="w-3 h-3" />
                <span>Import</span>
                <input type="file" onChange={handleImportJournal} className="hidden" accept=".json" />
              </label>
              <button 
                type="button" 
                onClick={handleExportJournal}
                className="flex items-center gap-1 text-[10px] uppercase text-[#7A9E7E] border border-[#7A9E7E]/20 px-2 py-1 rounded bg-[#7A9E7E]/5 hover:bg-[#7A9E7E]/20"
              >
                <Download className="w-3 h-3" />
                <span>Export</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
            {entries.map(e => {
              const hasErr = validateStewardshipJournalEntry(e).length > 0;
              const hasD = !!e.decision;
              const hasO = !!e.outcome;
              return (
                <button
                  key={e.entry_id}
                  onClick={() => setSelectedEntryId(e.entry_id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1.5 ${e.entry_id === selectedEntryId ? 'bg-[#7A9E7E]/10 border-[#7A9E7E] text-white' : 'bg-black/20 border-white/5 text-gray-400 hover:border-white/20'}`}
                >
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="text-gray-500">{e.entry_id}</span>
                    <div className="flex items-center gap-1">
                      {hasErr && <AlertTriangle className="w-3 h-3 text-red-400" />}
                      <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase ${hasO ? 'bg-[#34D399]/20 text-[#34D399]' : hasD ? 'bg-[#D4A853]/20 text-[#D4A853]' : 'bg-blue-500/20 text-blue-400'}`}>
                        {hasO ? 'outcome' : hasD ? 'decision' : 'proposal'}
                      </span>
                    </div>
                  </div>
                  <div className="font-bold text-xs truncate text-[#FAF6EF]">
                    Asset: {e.living_asset_id}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    Observed: {new Date(e.observation.timestamp).toLocaleString()}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Column 2: Entry Details & Stewardship Operations */}
        <div className="xl:col-span-2 flex flex-col gap-4 border border-[#2A1F16] bg-black/20 p-5 rounded-xl">
          {activeEntry ? (
            <div className="flex flex-col gap-5">
              
              {/* Header Details */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 pb-3">
                <div>
                  <h3 className="text-white font-bold text-base flex items-center gap-2">
                    <span>Stewardship Record Detail</span>
                    {activeEntry.meta?.label && <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-400 font-mono font-normal">{activeEntry.meta.label}</span>}
                  </h3>
                  <div className="text-xs text-gray-500 mt-1 font-mono">
                    Living Asset: <span className="text-white font-bold">{activeEntry.living_asset_id}</span> | Continuity ID: <span className="text-white">{activeEntry.steward_continuity_id}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReplacementForm(!showReplacementForm)}
                    className="text-[10px] font-mono border border-white/15 bg-black/30 hover:bg-black/50 px-3 py-1.5 rounded text-gray-300"
                  >
                    Record Model Handoff
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (entries.length <= 1) {
                        alert('Cannot delete the final entry.');
                        return;
                      }
                      const updated = entries.filter(e => e.entry_id !== activeEntry.entry_id);
                      setEntries(updated);
                      setSelectedEntryId(updated[0].entry_id);
                    }}
                    className="text-[10px] font-mono border border-red-900/30 bg-red-950/20 hover:bg-red-950/40 px-3 py-1.5 rounded text-red-400"
                  >
                    Delete Entry
                  </button>
                </div>
              </div>

              {/* Validation panel */}
              {entryValidationReport.length > 0 && (
                <div className="border border-red-900/40 bg-red-950/20 p-3 rounded-lg flex flex-col gap-2">
                  <span className="text-xs font-mono font-bold text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Scientific or Schema Mismatch ({entryValidationReport.length})</span>
                  </span>
                  <ul className="list-disc list-inside text-[11px] text-red-300 font-mono space-y-1">
                    {entryValidationReport.map((err, idx) => (
                      <li key={idx}><strong>{err.field}</strong>: {err.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Model Handoff Form overlay */}
              {showReplacementForm && (
                <form onSubmit={executeModelReplacement} className="border border-[#60A5FA]/30 bg-[#60A5FA]/5 p-4 rounded-lg flex flex-col gap-3">
                  <h4 className="text-white font-mono text-xs uppercase font-bold">Record Model Handoff</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-[#b7c9be]">Previous Model</span>
                      <input type="text" value={prevModelName} onChange={e => setPrevModelName(e.target.value)} className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-[#b7c9be]">Current Model</span>
                      <input type="text" value={nextModelName} onChange={e => setNextModelName(e.target.value)} className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs" />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase text-[#b7c9be]">Reason for Handoff (Scientific Bounds Apply)</span>
                    <textarea value={replacementReason} onChange={e => setReplacementReason(e.target.value)} rows={2} className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs" placeholder="Do not claim memory persistence" />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowReplacementForm(false)} className="text-[10px] uppercase border border-white/10 px-2 py-1 rounded">Cancel</button>
                    <button type="submit" className="text-[10px] uppercase bg-[#60A5FA] text-black px-2 py-1 rounded font-bold">Record</button>
                  </div>
                </form>
              )}

              {/* model replacement notice if present */}
              {activeEntry.model_replacement && (
                <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-lg p-3 text-xs text-[#BFDBFE]">
                  <div className="font-bold font-mono text-[10px] uppercase text-[#60A5FA] mb-1">Model Replacement Recorded</div>
                  <div>Transitioned from <strong>{activeEntry.model_replacement.previous_model}</strong> to <strong>{activeEntry.model_replacement.current_model}</strong></div>
                  <div className="text-[10px] text-gray-400 mt-1">Reason: {activeEntry.model_replacement.reason_for_replacement}</div>
                </div>
              )}

              {/* Grid split: Left (Observation & Proposal), Right (Human decisions & outcome) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Left side: Historical observation & model proposals */}
                <div className="flex flex-col gap-4">
                  <div className="border border-white/5 bg-black/10 p-4 rounded-lg flex flex-col gap-3">
                    <h4 className="text-white font-mono text-xs uppercase border-b border-white/5 pb-1 flex items-center justify-between">
                      <span>1. Observation</span>
                      <span className="text-[10px] text-gray-500 font-normal">{new Date(activeEntry.observation.timestamp).toLocaleTimeString()}</span>
                    </h4>
                    <div className="text-xs text-gray-400">
                      Source: <span className="text-white font-bold">{activeEntry.observation.source}</span>
                    </div>
                    <div className="space-y-1.5 mt-1">
                      {activeEntry.observation.measurements.map((m, idx) => (
                        <div key={idx} className="flex justify-between bg-black/30 px-3 py-1.5 rounded font-mono text-xs border border-white/5">
                          <span className="text-gray-400">{m.metric_name}</span>
                          <span className="text-white font-bold">{m.value} {m.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-white/5 bg-black/10 p-4 rounded-lg flex flex-col gap-3">
                    <h4 className="text-white font-mono text-xs uppercase border-b border-white/5 pb-1 flex items-center justify-between">
                      <span>2. Model Proposal</span>
                      <span className="text-[9px] bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-400 font-normal">{activeEntry.model_proposal.model_provider} / {activeEntry.model_proposal.model_name} ({activeEntry.model_proposal.model_version})</span>
                    </h4>
                    <div className="text-xs text-gray-400 italic">
                      " {activeEntry.model_proposal.reasoning} "
                    </div>
                    <div className="text-xs text-gray-500 font-mono flex items-center gap-1.5 bg-black/30 p-2 rounded">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                      <span>Model-reported uncertainty: <strong className="text-white">{activeEntry.model_proposal.model_reported_uncertainty}</strong></span>
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                      <div className={`border rounded-lg p-3 flex flex-col gap-1.5 mb-2 ${isOperatorApproved ? 'border-[#7A9E7E]/30 bg-[#7A9E7E]/5' : 'border-[#D4A853]/30 bg-[#D4A853]/5'}`}>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isOperatorApproved}
                            onChange={(e) => setIsOperatorApproved(e.target.checked)}
                            className="mt-0.5 rounded border-[#7A9E7E]/20 bg-black/40 text-[#7A9E7E]"
                          />
                          <span className="text-[11px] text-white font-bold">Confirm Operator Approval Gate (isOperatorApproved)</span>
                        </label>
                        <p className="text-[10px] text-gray-400">
                          Confirm manual verification of constraints, dependencies, and safety limits to enable compilation of DRAFT Work Cards.
                        </p>
                        {!isOperatorApproved && (
                          <div className="text-[10px] text-[#D4A853] font-mono font-bold mt-0.5">
                            [MANUAL_CONFIRMATION_REQUIRED]
                          </div>
                        )}
                      </div>

                      <span className="text-[10px] font-mono uppercase text-[#D4A853]">Proposed Action Plans:</span>
                      {activeEntry.model_proposal.care_options.map((opt) => (
                        <div key={opt.option_id} className="border border-[#7A9E7E]/30 bg-black/20 p-2.5 rounded flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white font-bold">{opt.label}</span>
                            <span className="text-gray-500 font-mono text-[10px]">{opt.estimated_labor_hours} hrs</span>
                          </div>
                          <div className="text-[11px] text-gray-400">{opt.description}</div>
                          <div className="flex justify-between items-center gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => handleCompileWorkCard(opt)}
                              disabled={!isOperatorApproved}
                              className={`text-[9px] uppercase tracking-wider px-2 py-1 rounded bg-black/30 flex items-center gap-1 border transition-all ${!isOperatorApproved ? 'opacity-40 cursor-not-allowed border-gray-700 text-gray-500' : 'text-[#D4A853] hover:text-white border-[#D4A853]/30 hover:bg-[#D4A853]/20'}`}
                            >
                              <Wrench className="w-3 h-3" />
                              <span>Draft Work Card</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right side: human decision & outcomes */}
                <div className="flex flex-col gap-4">
                  
                  {/* Decision Panel */}
                  <div className="border border-[#D4A853]/20 bg-black/10 p-4 rounded-lg flex flex-col gap-3">
                    <h4 className="text-white font-mono text-xs uppercase border-b border-white/5 pb-1 flex items-center justify-between">
                      <span>3. Human Decision</span>
                      <span className="text-[10px] text-gray-500 font-normal">Step 3 of 4</span>
                    </h4>
                    
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-[#b7c9be]">Selected Action</span>
                      <select
                        value={selectedCareOption}
                        onChange={e => setSelectedCareOption(e.target.value)}
                        className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1.5 text-white font-mono text-xs"
                      >
                        {activeEntry.model_proposal.care_options.map(opt => (
                          <option key={opt.option_id} value={opt.option_id}>{opt.label}</option>
                        ))}
                        <option value="REFUSE_ALL">REFUSE ALL PROPOSALS</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-[#b7c9be]">Stated Reasoning (Required on Refusal)</span>
                      <textarea
                        value={decisionReasoning}
                        onChange={e => setDecisionReasoning(e.target.value)}
                        rows={2}
                        className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs resize-none"
                        placeholder="Provide details about why you chose this action or refused the proposals."
                      />
                    </label>

                    <div className="flex items-center justify-between gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={humanApproved}
                          onChange={e => setHumanApproved(e.target.checked)}
                          className="rounded border-[#7A9E7E]/20 bg-black/40"
                        />
                        <span className="text-xs text-gray-300">Approve Proposal</span>
                      </label>
                      <label className="flex flex-col gap-1 flex-1">
                        <input
                          type="text"
                          value={reviewerStewardId}
                          onChange={e => setReviewerStewardId(e.target.value)}
                          className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs"
                          placeholder="Steward ID"
                        />
                      </label>
                    </div>

                    <div className="flex flex-col gap-2 mt-2">
                      <button
                        type="button"
                        onClick={saveActiveDecision}
                        className="w-full text-center text-[10px] uppercase tracking-wider text-black bg-[#D4A853] hover:bg-[#D4A853]/90 py-1.5 rounded font-bold"
                      >
                        Record Decision Locally
                      </button>

                      <div className="pt-3 border-t border-[#D4A853]/20 flex flex-col gap-2">
                        <p className="text-[9px] text-gray-500 uppercase tracking-widest text-center leading-relaxed">
                          Local operator review only.<br/>Export or hand off this decision to the local ops runtime.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const payload = {
                              work_card_id: `wc-${activeEntry.entry_id}`,
                              operator_approved: humanApproved,
                              reasoning: decisionReasoning,
                              reviewed_by: reviewerStewardId
                            };
                            const data = JSON.stringify(payload, null, 2);
                            const blob = new Blob([data], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `decision-${activeEntry.entry_id}.json`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="w-full text-center text-[10px] uppercase tracking-wider text-white bg-black border border-[#D4A853]/50 hover:bg-[#D4A853]/10 py-1.5 rounded font-bold flex justify-center items-center gap-2"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Export Decision Payload
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Outcome Panel */}
                  <div className="border border-[#7A9E7E]/20 bg-black/10 p-4 rounded-lg flex flex-col gap-3">
                    <h4 className="text-white font-mono text-xs uppercase border-b border-white/5 pb-1 flex items-center justify-between">
                      <span>4. Later Observed Outcome</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasOutcome}
                          onChange={e => setHasOutcome(e.target.checked)}
                          className="rounded border-[#7A9E7E]/20 bg-black/40"
                        />
                        <span className="text-[10px] text-gray-500 font-normal">Provide outcome</span>
                      </label>
                    </h4>

                    {hasOutcome ? (
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase text-[#b7c9be]">Observed Value</span>
                            <input
                              type="number"
                              value={outcomeValue}
                              onChange={e => setOutcomeValue(Number(e.target.value))}
                              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase text-[#b7c9be]">Metric Name</span>
                            <input
                              type="text"
                              value={outcomeMetric}
                              onChange={e => setOutcomeMetric(e.target.value)}
                              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs"
                            />
                          </label>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase text-[#b7c9be]">Observed Unit</span>
                            <input
                              type="text"
                              value={outcomeUnit}
                              onChange={e => setOutcomeUnit(e.target.value)}
                              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase text-[#b7c9be]">Outcome Source</span>
                            <input
                              type="text"
                              value={outcomeSource}
                              onChange={e => setOutcomeSource(e.target.value)}
                              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs"
                            />
                          </label>
                        </div>

                        {/* Error Calculation preview if possible */}
                        {activeEntry.prediction && (
                          <div className="bg-black/30 p-2 rounded border border-white/5 text-[11px] font-mono">
                            {activeEntry.prediction.metric_name === outcomeMetric && activeEntry.prediction.metric_unit === outcomeUnit ? (
                              <div className="flex justify-between text-[#86efac]">
                                <span>Calculated Prediction Error:</span>
                                <strong>{calculateErrorValue(outcomeValue, activeEntry.prediction)} {outcomeUnit}</strong>
                              </div>
                            ) : (
                              <div className="text-red-400 flex items-start gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Cannot calculate error (prediction metric/unit mismatch).</span>
                              </div>
                            )}
                          </div>
                        )}

                        <label className="flex flex-col gap-1">
                          <span className="text-[9px] uppercase text-[#b7c9be]">Correction Notes</span>
                          <textarea
                            value={outcomeNotes}
                            onChange={e => setOutcomeNotes(e.target.value)}
                            rows={2}
                            className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs resize-none"
                            placeholder="Describe any corrections, model adjustments or follow-up notes."
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 italic p-3 text-center">
                        Toggle check to enter actual real-world outcome and run comparison checks.
                      </div>
                    )}

                    <div className="flex flex-col gap-2 mt-2">
                      <button
                        type="button"
                        onClick={saveActiveOutcome}
                        className="w-full text-center text-[10px] uppercase tracking-wider text-black bg-[#7A9E7E] hover:bg-[#7A9E7E]/95 py-1.5 rounded font-bold"
                      >
                        Record Outcome Locally
                      </button>
                      
                      <div className="pt-3 border-t border-[#7A9E7E]/20 flex flex-col gap-2">
                        <p className="text-[9px] text-gray-500 uppercase tracking-widest text-center leading-relaxed">
                          Local outcome report only.<br/>Export or hand off to the local ops runtime after field observation.
                        </p>
                        <button
                          type="button"
                          disabled={!(hasOutcome && activeEntry?.decision?.approved_by_human && outcomeMetric && outcomeUnit && typeof outcomeValue === 'number' && !isNaN(outcomeValue))}
                          onClick={() => {
                            let computedErr: number | null = null;
                            if (activeEntry.prediction && activeEntry.prediction.metric_name === outcomeMetric && activeEntry.prediction.metric_unit === outcomeUnit) {
                              computedErr = calculateErrorValue(outcomeValue, activeEntry.prediction);
                            }
                            const payload = {
                              work_card_id: `wc-${activeEntry.entry_id}`,
                              metric_name: outcomeMetric,
                              metric_unit: outcomeUnit,
                              observed_value: outcomeValue,
                              calculated_prediction_error: computedErr,
                              notes: outcomeNotes || null
                            };
                            const data = JSON.stringify(payload, null, 2);
                            const blob = new Blob([data], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `outcome-${activeEntry.entry_id}.json`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="w-full text-center text-[10px] uppercase tracking-wider text-white bg-black border border-[#7A9E7E]/50 hover:bg-[#7A9E7E]/10 py-1.5 rounded font-bold flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Export Outcome Payload
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="text-center py-20 text-gray-500 italic">
              No journal entry selected. Add a new record or select one from the timeline.
            </div>
          )}
        </div>

      </div>

      {/* Compiler work card dialog/preview overlay if compiled */}
      {compiledWorkCard && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0a0806] border border-[#D4A853]/30 rounded-xl p-6 max-w-2xl w-full flex flex-col gap-4 font-mono">
            <h4 className="text-white font-mono text-xs uppercase font-bold border-b border-white/5 pb-2 flex items-center justify-between">
              <span>Handoff: DRAFT Operational Work Card compiled</span>
              <button onClick={() => setCompiledWorkCard(null)}><X className="w-4 h-4 text-gray-500 hover:text-white" /></button>
            </h4>
            <div className="text-[11px] text-gray-400 leading-relaxed bg-[#D4A853]/5 p-3 rounded border border-[#D4A853]/15">
              <strong>Notice:</strong> This compiled contract has been generated in <strong>DRAFT</strong> status with <strong>no approvals</strong>, 
              carrying the live-asset reference and observation dependencies. It cannot trigger execution.
            </div>
            {/* Operator Approval Confirmation */}
            <div className="border border-[#7A9E7E]/30 bg-[#7A9E7E]/5 rounded-lg p-3 text-xs text-[#86efac] font-mono flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-[#86efac]" />
              <span>Operator Approval Gate Confirmed (isOperatorApproved: true)</span>
            </div>

            <pre className="text-[#b89c82] text-[10px] overflow-auto max-h-[200px] border border-white/5 bg-black/40 p-3 rounded">
              {JSON.stringify(compiledWorkCard, null, 2)}
            </pre>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setCompiledWorkCard(null)}
                className="text-[10px] uppercase border border-white/10 px-3 py-1.5 rounded"
              >
                Close
              </button>
              <button
                type="button"
                onClick={downloadCompiledCard}
                className="bg-[#D4A853] text-black border-transparent hover:bg-[#D4A853]/90 text-[10px] uppercase px-3 py-1.5 rounded font-bold flex items-center gap-1 border transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Observation Entry Form */}
      <form onSubmit={createJournalEntry} className="border border-[#2A1F16] bg-black/20 p-5 rounded-xl flex flex-col gap-4">
        <h4 className="text-white font-mono text-xs uppercase tracking-widest font-bold border-b border-white/5 pb-2">
          New Observation & AI Stewardship Intake Form
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Living Asset ID</span>
            <input
              type="text"
              value={newLivingAssetId}
              onChange={e => setNewLivingAssetId(e.target.value)}
              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Steward Continuity ID</span>
            <input
              type="text"
              value={newStewardContinuityId}
              onChange={e => setNewStewardContinuityId(e.target.value)}
              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Observation Source</span>
            <input
              type="text"
              value={newObsSource}
              onChange={e => setNewObsSource(e.target.value)}
              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs"
            />
          </label>
        </div>

        {/* Dynamic measurements */}
        <div className="border border-white/5 bg-black/10 p-3 rounded flex flex-col gap-2">
          <span className="text-[10px] font-mono uppercase text-[#7A9E7E]">Add Measurements:</span>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Metric Name (e.g. nitrate)"
              value={measName}
              onChange={e => setMeasName(e.target.value)}
              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs flex-1 min-w-[120px]"
            />
            <input
              type="number"
              placeholder="Value"
              value={measValue}
              onChange={e => setMeasValue(e.target.value)}
              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs w-20"
            />
            <input
              type="text"
              placeholder="Unit"
              value={measUnit}
              onChange={e => setMeasUnit(e.target.value)}
              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs w-16"
            />
            <button
              type="button"
              onClick={addMeasurementRow}
              className="text-[10px] uppercase border border-[#7A9E7E]/30 text-[#7A9E7E] px-2 py-1 rounded hover:bg-[#7A9E7E]/10"
            >
              Add Row
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {measurements.map((m, idx) => (
              <span key={idx} className="bg-black/40 border border-white/5 px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1.5">
                <span className="text-gray-400">{m.metric_name}:</span>
                <span className="text-white font-bold">{m.value} {m.unit}</span>
                <button type="button" onClick={() => setMeasurements(measurements.filter((_, i) => i !== idx))} className="text-red-400 hover:text-white">✕</button>
              </span>
            ))}
          </div>
        </div>

        {/* Model proposal section */}
        <div className="border border-white/5 bg-black/10 p-3 rounded flex flex-col gap-3">
          <span className="text-[10px] font-mono uppercase text-blue-400">Add AI Proposal Specs:</span>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[9px] uppercase text-[#b7c9be]">Provider</span>
              <input type="text" value={proposalProvider} onChange={e => setProposalProvider(e.target.value)} className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] uppercase text-[#b7c9be]">Model Name</span>
              <input type="text" value={proposalModel} onChange={e => setProposalModel(e.target.value)} className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] uppercase text-[#b7c9be]">Model Version</span>
              <input type="text" value={proposalVersion} onChange={e => setProposalVersion(e.target.value)} className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] uppercase text-[#b7c9be]">Model uncertainty</span>
              <input type="number" step="0.01" min="0" max="1" value={proposalUncertainty} onChange={e => setProposalUncertainty(Number(e.target.value))} className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs" />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[9px] uppercase text-[#b7c9be]">Model Stated Reasoning</span>
            <input type="text" value={proposalReasoning} onChange={e => setProposalReasoning(e.target.value)} className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-1.5 text-white font-mono text-xs" placeholder="Describe the AI model reasoning output..." />
          </label>

          {/* Dynamic Care Options */}
          <div className="border border-white/5 bg-black/20 p-2.5 rounded flex flex-col gap-2">
            <span className="text-[9px] font-mono uppercase text-[#D4A853]">Compile Proposed Option Plan:</span>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Option Label (e.g. Misting)"
                value={optLabel}
                onChange={e => setOptLabel(e.target.value)}
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs flex-1 min-w-[120px]"
              />
              <input
                type="text"
                placeholder="Detailed Description"
                value={optDesc}
                onChange={e => setOptDesc(e.target.value)}
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs flex-[2] min-w-[180px]"
              />
              <input
                type="number"
                placeholder="Labor"
                value={optLabor}
                onChange={e => setOptLabor(Number(e.target.value))}
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs w-16"
              />
              <button
                type="button"
                onClick={addCareOptionRow}
                className="text-[9px] uppercase border border-[#D4A853]/30 text-[#D4A853] px-2 py-1 rounded hover:bg-[#D4A853]/10"
              >
                Add Option
              </button>
            </div>
            <textarea
              placeholder="Stop conditions (format: id | description | response per line)"
              value={optStopConds}
              onChange={e => setOptStopConds(e.target.value)}
              rows={2}
              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-[11px] resize-none"
            />
            <div className="flex flex-col gap-1.5 mt-1">
              {careOptions.map((opt, idx) => (
                <div key={idx} className="bg-black/30 border border-white/5 p-2 rounded flex items-center justify-between text-xs font-mono">
                  <div>
                    <strong className="text-white">{opt.label}</strong> ({opt.estimated_labor_hours} hrs) - <span className="text-gray-400">{opt.description}</span>
                  </div>
                  <button type="button" onClick={() => setCareOptions(careOptions.filter((_, i) => i !== idx))} className="text-red-400 hover:text-white">Remove</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Prediction section */}
        <div className="border border-white/5 bg-black/10 p-3 rounded flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-purple-400">Add AI Prediction (Optional):</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={hasPrediction} onChange={e => setHasPrediction(e.target.checked)} className="rounded border-[#7A9E7E]/20 bg-black/40" />
              <span className="text-[10px] text-gray-500">Enable prediction</span>
            </label>
          </div>

          {hasPrediction && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[9px] uppercase text-[#b7c9be]">Metric</span>
                <input type="text" value={predMetric} onChange={e => setPredMetric(e.target.value)} className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] uppercase text-[#b7c9be]">Min value</span>
                <input type="number" value={predMin} onChange={e => setPredMin(Number(e.target.value))} className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] uppercase text-[#b7c9be]">Max value</span>
                <input type="number" value={predMax} onChange={e => setPredMax(Number(e.target.value))} className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] uppercase text-[#b7c9be]">Unit</span>
                <input type="text" value={predUnit} onChange={e => setPredUnit(e.target.value)} className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] uppercase text-[#b7c9be]">Time Horizon</span>
                <input type="text" value={predHorizon} onChange={e => setPredHorizon(e.target.value)} className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs" />
              </label>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full text-center text-xs uppercase tracking-wider text-black bg-[#7A9E7E] hover:bg-[#7A9E7E]/90 py-2.5 rounded font-bold"
        >
          Create Stewardship Journal Entry
        </button>
      </form>

      {/* SQLite WASM + OPFS Spike Diagnostics */}
      <div className="border border-[#7A9E7E]/30 bg-[#7A9E7E]/5 rounded-xl p-5 flex flex-col gap-4 mt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#7A9E7E]/20 pb-3 gap-3">
          <div>
            <h3 className="text-white font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#7A9E7E]" />
              <span>SQLite WASM + OPFS Feasibility Spike</span>
            </h3>
            <p className="text-[10px] text-gray-400 mt-1">
              Test browser-local relational database operations in the Origin Private File System (OPFS) sandbox.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunSqliteSpike}
            disabled={runningSqlite}
            className="px-4 py-2 bg-[#7A9E7E] hover:bg-[#7A9E7E]/90 disabled:bg-gray-700 text-black font-bold uppercase tracking-wider text-[10px] rounded transition-all whitespace-nowrap self-start md:self-auto"
          >
            {runningSqlite ? 'Executing PoC...' : 'Run SQLite OPFS PoC'}
          </button>
        </div>

        {sqliteResult && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs font-mono">
            {/* Left Panel: Initialization Status & Logs */}
            <div className="flex flex-col gap-3 bg-black/40 p-4 rounded border border-white/5">
              <div className="text-white uppercase font-bold text-[10px] tracking-wider border-b border-white/5 pb-1">
                Diagnostic Status & Log Trace
              </div>
              
              <div className="flex flex-wrap gap-2 text-[9px] uppercase font-bold">
                <span className={`px-2 py-0.5 rounded ${sqliteResult.opfsAvailable ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                  OPFS Support: {sqliteResult.opfsAvailable ? 'AVAILABLE' : 'UNSUPPORTED'}
                </span>
                <span className={`px-2 py-0.5 rounded ${sqliteResult.sqliteInitialized ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                  SQLite WASM: {sqliteResult.sqliteInitialized ? `INITIALIZED (${sqliteResult.libraryVersion})` : 'UNINITIALIZED'}
                </span>
              </div>

              {sqliteResult.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded text-[10px]">
                  <div className="font-bold mb-1">ERRORS DETECTED:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {sqliteResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-[10px] text-gray-400 font-mono mt-1">
                <div className="font-bold text-white uppercase text-[9px] mb-1">Execution Steps:</div>
                <div className="max-h-[200px] overflow-y-auto bg-black/60 p-2 rounded border border-white/5 space-y-1">
                  {sqliteResult.testOutput.map((log, i) => (
                    <div key={i} className="text-[#8cd095]">&gt; {log}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Panel: Query Proofs */}
            <div className="flex flex-col gap-3 bg-black/40 p-4 rounded border border-white/5">
              <div className="text-white uppercase font-bold text-[10px] tracking-wider border-b border-white/5 pb-1">
                Relational Query Proof Outputs
              </div>

              <div>
                <div className="text-gray-400 font-bold uppercase text-[9px] mb-1">
                  Query 1: SELECT * FROM journal_entries WHERE living_asset_id = ?
                </div>
                <pre className="bg-black/60 p-2.5 rounded border border-white/5 text-[9px] text-[#FAF6EF] overflow-x-auto max-h-[120px]">
                  {sqliteResult.queriedEntriesByAsset.length > 0
                    ? JSON.stringify(sqliteResult.queriedEntriesByAsset, null, 2)
                    : '[] (No matching records or query not executed)'}
                </pre>
              </div>

              <div>
                <div className="text-gray-400 font-bold uppercase text-[9px] mb-1">
                  Query 2: SELECT entry_id, living_asset_id, calculated_prediction_error FROM outcomes
                </div>
                <pre className="bg-black/60 p-2.5 rounded border border-white/5 text-[9px] text-[#FAF6EF] overflow-x-auto max-h-[120px]">
                  {sqliteResult.queriedEntriesWithError.length > 0
                    ? JSON.stringify(sqliteResult.queriedEntriesWithError, null, 2)
                    : '[] (No matching records with outcomes/prediction error)'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}
