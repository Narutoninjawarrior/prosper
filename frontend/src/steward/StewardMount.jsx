import StewardBubble from './StewardBubble'
import { readStewardAgentHandle, readStewardPlotId } from './stewardContext'

export default function StewardMount({
  emberBalance = 0,
  realm = 'biosphere',
  anchor = 'right',
  openSignal = 0,
}) {
  const agentHandle = readStewardAgentHandle()
  const plotId = readStewardPlotId()

  return (
    <StewardBubble
      agentHandle={agentHandle}
      plotId={plotId}
      emberBalance={emberBalance}
      realm={realm}
      anchor={anchor}
      openSignal={openSignal}
    />
  )
}
