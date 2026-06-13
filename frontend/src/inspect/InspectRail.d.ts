export type InspectRailAction = {
  label: string
  tone?: 'primary' | 'warm' | 'ghost'
  href?: string
  disabled?: boolean
  onClick?: () => void
}

export type InspectRailPotentialAction = {
  action_id: string
  title?: string
  status?: string
  effect?: string
  inputs?: string
  entrypoint?: string
  write_policy?: string
  receipt?: string
}

export type InspectRailProps = {
  visible?: boolean
  accent?: string
  eyebrow?: string
  title?: string
  summary?: string
  details?: Array<{ label: string; value: string }>
  code?: string | null
  footer?: string
  actions?: InspectRailAction[]
  potentialActions?: InspectRailPotentialAction[]
  side?: 'left' | 'right'
  top?: number
  draggable?: boolean
  onClose?: () => void
}

export default function InspectRail(props: InspectRailProps): JSX.Element | null
