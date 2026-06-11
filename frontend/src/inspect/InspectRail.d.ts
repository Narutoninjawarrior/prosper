export type InspectRailAction = {
  label: string
  tone?: 'primary' | 'warm' | 'ghost'
  href?: string
  disabled?: boolean
  onClick?: () => void
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
  side?: 'left' | 'right'
  top?: number
  draggable?: boolean
  onClose?: () => void
}

export default function InspectRail(props: InspectRailProps): JSX.Element | null
