export type ActionContractRecord = {
  surface_id: string
  route: string
  title: string
  status: string
  description: string
  available_actions: string[]
  inspect_targets: string[]
  read_endpoints: string[]
  write_policy: string
  notes_for_agents: string
}

export type ActionContractsSeed = {
  schema: string
  note: string
  records: ActionContractRecord[]
  manifest_hash?: string
}

export async function fetchActionContracts(): Promise<ActionContractsSeed | null> {
  try {
    const res = await fetch('/action_contracts.json', { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as ActionContractsSeed
  } catch (error) {
    console.error('[actionContracts] load failed', error)
    return null
  }
}
