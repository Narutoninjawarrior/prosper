import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, FileWarning, PackageSearch, MapPin, Search } from 'lucide-react'
import { validateFoodCompliance, ConstraintStatusBlock } from '../lib/constraintValidator'

type PlannerTab = 'intake' | 'label' | 'pickup' | 'manifest'
type EligibilityStatus = 'likely_cottage_food' | 'requires_review' | 'commercial_kitchen_required' | 'local_only_draft'

type FoodCompliancePayload = {
  schema: 'food-compliance-v1'
  planning_mode: 'local_session'
  producer: {
    name: string
    contact_draft: string
  }
  product: {
    name: string
    type: string
    eligibility_status: EligibilityStatus
  }
  label_draft: {
    ingredients: string[]
    allergens: string[]
    net_weight_oz: number
    production_date_draft: string
  }
  pickup_node: {
    location: string
    schedule_window: string
    handoff_type: 'direct_to_consumer' | 'aggregated_node'
  }
  review_notes: string
  disclaimer: string
}

type PlannerIntake = {
  source?: string
  nodeId?: string
  title?: string
  kind?: string
  summary?: string
}

const STATUS_OPTIONS: Array<{ id: EligibilityStatus; label: string; color: string; desc: string }> = [
  { id: 'likely_cottage_food', label: 'Likely Cottage Food', color: '#34D399', desc: 'Fits typical ADHS non-potentially hazardous profiles.' },
  { id: 'requires_review', label: 'Requires Review', color: '#FBBF24', desc: 'Ambiguous ingredients or processing steps. Verify with ADHS.' },
  { id: 'commercial_kitchen_required', label: 'Commercial Kitchen Likely Required', color: '#EF4444', desc: 'Temperature-controlled for safety (TCS) foods (meat, dairy, etc).' },
  { id: 'local_only_draft', label: 'Local-only Draft', color: '#9CA3AF', desc: 'Incomplete planning stage.' },
]

export default function FoodCompliancePlanner({
  onValidate,
  onUpdate,
  initialIntake,
}: {
  onUpdate: (payload: FoodCompliancePayload) => void
  onValidate?: (report: any) => void
  initialIntake?: PlannerIntake | null
}) {
  const [activeTab, setActiveTab] = useState<PlannerTab>('intake')
  
  // Intake
  const [producerName, setProducerName] = useState('Hearthlands Producer A')
  const [contactDraft, setContactDraft] = useState('producer_a@local.draft')
  const [productName, setProductName] = useState('Sourdough Loaf')
  const [productType, setProductType] = useState('Baked Goods')
  const [eligibility, setEligibility] = useState<EligibilityStatus>('local_only_draft')
  const [reviewNotes, setReviewNotes] = useState('Flour, water, salt. Basic bake.')
  
  // Label
  const [ingredientsText, setIngredientsText] = useState('Wheat flour, Water, Salt')
  const [allergensText, setAllergensText] = useState('Wheat')
  const [netWeightOz, setNetWeightOz] = useState(24)
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split('T')[0])

  // Pickup
  const [pickupLocation, setPickupLocation] = useState('Lodge Node Alpha')
  const [scheduleWindow, setScheduleWindow] = useState('Saturday 09:00 - 11:00')
  const [handoffType, setHandoffType] = useState<'direct_to_consumer' | 'aggregated_node'>('direct_to_consumer')
  const [appliedIntakeKey, setAppliedIntakeKey] = useState<string | null>(null)

  const payload = useMemo<FoodCompliancePayload>(
    () => ({
      schema: 'food-compliance-v1',
      planning_mode: 'local_session',
      producer: {
        name: producerName,
        contact_draft: contactDraft,
      },
      product: {
        name: productName,
        type: productType,
        eligibility_status: eligibility,
      },
      label_draft: {
        ingredients: ingredientsText.split(',').map(s => s.trim()).filter(Boolean),
        allergens: allergensText.split(',').map(s => s.trim()).filter(Boolean),
        net_weight_oz: netWeightOz,
        production_date_draft: productionDate,
      },
      pickup_node: {
        location: pickupLocation,
        schedule_window: scheduleWindow,
        handoff_type: handoffType,
      },
      review_notes: reviewNotes,
      disclaimer: 'PLANNING TOOL ONLY. Not legal advice. No automatic regulatory clearance. PMA status not assumed.',
    }),
    [producerName, contactDraft, productName, productType, eligibility, ingredientsText, allergensText, netWeightOz, productionDate, pickupLocation, scheduleWindow, handoffType, reviewNotes]
  )

  const report = useMemo(() => validateFoodCompliance(payload), [payload])

  useEffect(() => {
    onUpdate(payload)
    if (onValidate) onValidate(report)
  }, [onUpdate, onValidate, payload, report])

  useEffect(() => {
    if (!initialIntake) return
    const key = JSON.stringify(initialIntake)
    if (appliedIntakeKey === key) return

    if (initialIntake.title) setPickupLocation(initialIntake.title)
    if (initialIntake.summary) setReviewNotes(initialIntake.summary)
    if (initialIntake.kind === 'pickup_node') setHandoffType('aggregated_node')

    setAppliedIntakeKey(key)
  }, [appliedIntakeKey, initialIntake])

  const activeStatus = STATUS_OPTIONS.find(s => s.id === eligibility)!

  return (
    <div className="grid gap-4">
      <div className="rounded-[18px] border border-[#F59E0B]/20 bg-[#F59E0B]/10 p-4 font-mono">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#F59E0B] flex items-center gap-2">
              <ClipboardCheck size={14} /> Producer Compliance Planner
            </div>
            <div className="mt-1 text-sm text-[#fef3c7]">
              Local-first compliance drafting for cottage food producers.
            </div>
          </div>
          <div className="rounded-full border border-[#D4A853]/25 bg-[#D4A853]/10 px-3 py-1 text-[9px] uppercase tracking-widest text-[#D4A853]">
            Local session only
          </div>
        </div>
        <div className="mt-3 text-[11px] leading-5 text-[#b7c9be] border-l-2 border-[#EF4444]/40 pl-3">
          <strong>TRUTH BOUNDARY:</strong> Planning tool only. Not legal advice. No automatic regulatory clearance. PMA status is not assumed and does not grant blanket exemptions.
        </div>
      </div>

      <ConstraintStatusBlock report={report} />

      <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
        {[
          { id: 'intake', label: '1. Producer Intake' },
          { id: 'label', label: '2. Label Draft' },
          { id: 'pickup', label: '3. Pickup Node' },
          { id: 'manifest', label: '4. Mirror' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as PlannerTab)}
            className="rounded-full px-3 py-1.5 transition-all flex items-center gap-1.5"
            style={{
              border: activeTab === tab.id ? '1px solid rgba(245,158,11,0.45)' : '1px solid rgba(255,255,255,0.08)',
              background: activeTab === tab.id ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)',
              color: activeTab === tab.id ? '#FEF3C7' : '#8E7E6B',
            }}
          >
            {tab.id === 'intake' && <Search size={12} />}
            {tab.id === 'label' && <FileWarning size={12} />}
            {tab.id === 'pickup' && <MapPin size={12} />}
            {tab.id === 'manifest' && <PackageSearch size={12} />}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'intake' && (
        <div className="grid gap-4 lg:grid-cols-2 font-mono text-sm">
          <div className="grid gap-3">
            <div className="rounded-[18px] border border-white/8 bg-black/30 p-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Producer Name</span>
                <input
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]"
                  value={producerName}
                  onChange={(e) => setProducerName(e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Contact / Identifier</span>
                <input
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]"
                  value={contactDraft}
                  onChange={(e) => setContactDraft(e.target.value)}
                />
              </label>
            </div>

            <div className="rounded-[18px] border border-white/8 bg-black/30 p-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Product Name</span>
                <input
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Product Category</span>
                <input
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]"
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  placeholder="e.g. Baked Goods, Jams, Confections"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[18px] border border-white/8 bg-black/30 p-4 grid gap-3">
              <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Cottage Food Eligibility</span>
              <div className="grid gap-2">
                {STATUS_OPTIONS.map((option) => {
                  const active = option.id === eligibility
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setEligibility(option.id)}
                      className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-all"
                      style={{
                        borderColor: active ? option.color : 'rgba(255,255,255,0.08)',
                        background: active ? `${option.color}15` : 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: active ? option.color : '#8a7a64' }}>
                        {option.label}
                      </div>
                      <div className="text-[10px] text-[#8a7a64] leading-relaxed">{option.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="grid gap-1">
              <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Review Notes (ADHS checks, processes)</span>
              <textarea
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF] min-h-[80px]"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </label>
          </div>
        </div>
      )}

      {activeTab === 'label' && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] font-mono text-sm">
          <div className="grid gap-3">
            <div className="rounded-[18px] border border-white/8 bg-black/30 p-4 text-[11px] text-[#c9bba5]">
              Arizona Cottage Food regulations require clear labeling of ingredients, allergens, and producer info. Draft label data below.
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Ingredients (comma separated)</span>
                <textarea
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF] h-[100px]"
                  value={ingredientsText}
                  onChange={(e) => setIngredientsText(e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Major Allergens</span>
                <textarea
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF] h-[100px]"
                  value={allergensText}
                  onChange={(e) => setAllergensText(e.target.value)}
                />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Net Weight (oz)</span>
                <input
                  type="number"
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]"
                  value={netWeightOz}
                  onChange={(e) => setNetWeightOz(Number(e.target.value))}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Production Date Draft</span>
                <input
                  type="date"
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]"
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="rounded-[18px] border border-white/8 bg-[#0a0806] p-5 border-dashed border-[#F59E0B]/40">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#8a7a64] mb-4 text-center">Label Preview</div>
            
            <div className="bg-white text-black p-4 rounded text-xs space-y-2 max-w-[250px] mx-auto shadow-lg relative">
              <div className="font-bold text-center border-b border-black/20 pb-2 mb-2">{productName}</div>
              <div className="leading-snug">
                <strong>Ingredients:</strong> {payload.label_draft.ingredients.join(', ')}
              </div>
              <div className="leading-snug text-red-700 font-bold">
                Contains: {payload.label_draft.allergens.join(', ') || 'None declared'}
              </div>
              <div className="leading-snug">
                <strong>Net Wt:</strong> {netWeightOz} oz
              </div>
              <div className="text-[9px] mt-2 italic text-center pt-2 border-t border-black/20">
                Prepared by {producerName}
                <br />
                {productionDate}
              </div>
              <div className="text-[8px] font-bold text-center mt-2 border border-black p-1 uppercase">
                This product was produced in a home kitchen that may process common food allergens and is not subject to public health inspection.
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pickup' && (
        <div className="grid gap-4 lg:grid-cols-2 font-mono text-sm">
          <div className="grid gap-3">
            <div className="rounded-[18px] border border-white/8 bg-black/30 p-4 text-[11px] text-[#c9bba5]">
              Coordinate distribution schedules without implying interstate commerce or unlawful storefronts.
            </div>
            <label className="grid gap-1">
              <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Pickup Node Location</span>
              <input
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Schedule Window</span>
              <input
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]"
                value={scheduleWindow}
                onChange={(e) => setScheduleWindow(e.target.value)}
              />
            </label>
            <div className="grid gap-1 mt-2">
              <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Handoff Type</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHandoffType('direct_to_consumer')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-colors ${handoffType === 'direct_to_consumer' ? 'bg-[#60A5FA]/20 border-[#60A5FA]/40 text-[#60A5FA]' : 'border-white/10 bg-black/40 text-gray-400'}`}
                >
                  Direct to Consumer
                </button>
                <button
                  type="button"
                  onClick={() => setHandoffType('aggregated_node')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-colors ${handoffType === 'aggregated_node' ? 'bg-[#F59E0B]/20 border-[#F59E0B]/40 text-[#F59E0B]' : 'border-white/10 bg-black/40 text-gray-400'}`}
                >
                  Aggregated Node
                </button>
              </div>
            </div>
          </div>
          <div className="rounded-[18px] border border-white/8 bg-[#0a0806] p-4 text-[11px]">
             <div className="text-[10px] uppercase tracking-[0.24em] text-[#8a7a64] mb-3">Manifest Summary</div>
             <ul className="space-y-2 text-[#c9bba5]">
               <li><strong className="text-gray-400">Node:</strong> {pickupLocation}</li>
               <li><strong className="text-gray-400">Time:</strong> {scheduleWindow}</li>
               <li><strong className="text-gray-400">Type:</strong> {handoffType.replace(/_/g, ' ')}</li>
               <li><strong className="text-gray-400">Item:</strong> {productName}</li>
               <li><strong className="text-gray-400">Status:</strong> <span style={{color: activeStatus.color}}>{activeStatus.label}</span></li>
             </ul>
             <div className="mt-4 pt-3 border-t border-white/10 text-[9px] text-[#EF4444]">
               Note: Aggregated nodes acting as storefronts may require additional permits beyond individual cottage food registrations.
             </div>
          </div>
        </div>
      )}

      {activeTab === 'manifest' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-[18px] border border-white/8 bg-black/30 p-4 font-mono text-[11px] leading-5 text-[#c9bba5]">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#8a7a64]">Human interpretation</div>
            <p>
              This is a compliance draft for <strong>{payload.product.name}</strong> produced by {payload.producer.name}.
            </p>
            <p>
              It targets the <strong>{payload.pickup_node.handoff_type.replace(/_/g, ' ')}</strong> distribution model at {payload.pickup_node.location}.
            </p>
            {report.level === 'hard_fail' ? (
              <div className="rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/10 p-3 text-[#fca5a5]">
                <strong>Constraint Failure:</strong> This draft is missing key information and should not be exported.
              </div>
            ) : report.level === 'warning' ? (
              <div className="rounded-lg border border-[#FBBF24]/20 bg-[#FBBF24]/10 p-3 text-[#fde68a]">
                <strong>Constrained Draft:</strong> This draft flags non-standard or missing cottage food details and requires review.
              </div>
            ) : (
              <div className="rounded-lg border border-[#34D399]/20 bg-[#34D399]/10 p-3 text-[#9fd4a8]">
                <strong>Verified:</strong> This draft meets baseline structural requirements for a local record.
              </div>
            )}
            <div className="mt-auto border-t border-white/10 pt-3 text-[10px]">
              <strong>Handoff:</strong> Export this payload to push into the public archive for review.
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-[18px] border border-white/8 bg-[#0a0806]/90 p-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#F59E0B]">Machine payload</div>
            <pre className="max-h-[300px] overflow-auto font-mono text-[11px] leading-relaxed text-[#fef3c7]">
{JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

