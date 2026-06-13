/**
 * MultiplayerPresence — renders remote + local avatars inside R3F Canvas.
 */
import { Suspense } from 'react'
import Avatar from './Avatar'
import InstancedRemotePeers from './InstancedRemotePeers'

export default function MultiplayerPresence({
  localId,
  localName,
  localTarget,
  localModelUrl,
  localRole = null,
  localMoving = false,
  localAnim = 'idle',
  localMessage = null,
  localMessageUntil = null,
  remotePeers = [],
}) {
  return (
    <Suspense fallback={null}>
      <Avatar
        id={localId}
        displayName={localName}
        modelUrl={localModelUrl}
        target={localTarget}
        role={localRole}
        moving={localMoving}
        anim={localAnim}
        isLocal
        message={localMessage}
        messageUntil={localMessageUntil}
      />
      <InstancedRemotePeers remotePeers={remotePeers} />
    </Suspense>
  )
}
