export type ProposalState = 'draft' | 'standing' | 'witnessed' | 'stale'
export type ProposalSource = 'local-council' | 'steward-fallback' | 'planner-fallback'
export type ProposalDomain = 'world' | 'quests' | 'artifacts' | 'onboarding'

export type CouncilProposal = {
  id: string
  title: string
  domain: ProposalDomain
  state: ProposalState
  source: ProposalSource
  generated_at: string
  synthesis: string
  steward_voice: string
  planner_voice: string
  context_tags: string[]
  timeline: Array<{
    step: 'sensed' | 'planned' | 'synthesized' | 'awaiting-review'
    label: string
  }>
}

export const COUNCIL_PROPOSALS: CouncilProposal[] = [
  {
    id: 'first-seed-ceremony',
    title: 'First Seed Ceremony',
    domain: 'onboarding',
    state: 'standing',
    source: 'planner-fallback',
    generated_at: '2026-06-08T19:34:00Z',
    synthesis:
      'The Lodge proposes: shape the Fellowship’s first witnessed planting rite so new arrivals gather around one visible act instead of dispersing into private drift.',
    steward_voice:
      'The fire is lit but the warmth still clings to the center, leaving new arrivals circling the edge without a place to settle. The commons is drawn toward its first shared moment: one person planting while others witness and remember.',
    planner_voice:
      'Gap: joined members outnumber active plots, so onboarding energy dissipates before root formation. Action: stage a first-plot ceremony and bind it to a visible quest milestone. Risk: if witnessing stays informal, the ritual will feel symbolic but not legible in the civic record.',
    context_tags: [
      'Context: 14 active members',
      'Context: 3 open quests',
      'Context: 0 active plots',
      'Context: Planner fallback',
    ],
    timeline: [
      { step: 'sensed', label: 'arrival energy observed' },
      { step: 'planned', label: 'first-plot milestone identified' },
      { step: 'synthesized', label: 'ceremony named by Lodge voice' },
      { step: 'awaiting-review', label: 'awaiting steward review' },
    ],
  },
  {
    id: 'firebase-context-restoration',
    title: 'Restore Civic Sight',
    domain: 'world',
    state: 'draft',
    source: 'planner-fallback',
    generated_at: '2026-06-08T19:41:00Z',
    synthesis:
      'The Lodge proposes: restore Firebase context visibility first, so every later council judgment is anchored in the real state of the Hearthlands rather than spiritual guesswork.',
    steward_voice:
      'The room speaks in echoes when the walls cannot remember. The Fellowship is drawn toward clearing the fog between what is felt and what is truly there.',
    planner_voice:
      'Gap: Firebase context is unavailable, leaving the council blind to live civic state. Action: configure GOOGLE_APPLICATION_CREDENTIALS for the local hive session and re-run health before further proposals. Risk: if context stays absent, every future suggestion will drift toward generic ritual instead of grounded governance.',
    context_tags: [
      'Context: Firebase unavailable',
      'Context: planner fallback active',
      'Context: local hive only',
    ],
    timeline: [
      { step: 'sensed', label: 'context fog named' },
      { step: 'planned', label: 'credential path identified' },
      { step: 'synthesized', label: 'restoration proposal formed' },
      { step: 'awaiting-review', label: 'awaiting steward review' },
    ],
  },
  {
    id: 'artifact-chamber-opening',
    title: 'Open the Artifact Chamber',
    domain: 'artifacts',
    state: 'witnessed',
    source: 'local-council',
    generated_at: '2026-06-08T15:14:00Z',
    synthesis:
      'The Lodge proposes: treat the archive not as a shop shelf but as a chamber of witnessed capabilities, so every future artifact enters civic memory before it enters commerce.',
    steward_voice:
      'The shelves are no longer empty, but they still feel like they are waiting for stories to settle into them. The Fellowship is drawn toward naming its works in a way that lets them be kept, honored, and returned to.',
    planner_voice:
      'Gap: artifacts exist in a curated prototype but not yet in a live registry workflow. Action: keep the registry read-only while defining provenance, seal state, and display status as the canonical first schema. Risk: if commerce arrives before witness rules, the archive becomes a storefront before it becomes a culture.',
    context_tags: [
      'Context: Artifact registry prototype',
      'Context: 12 curated artifacts',
      'Context: no world writes',
    ],
    timeline: [
      { step: 'sensed', label: 'archive identity named' },
      { step: 'planned', label: 'schema-first path chosen' },
      { step: 'synthesized', label: 'artifact chamber framed' },
      { step: 'awaiting-review', label: 'witnessed in prototype' },
    ],
  },
]
