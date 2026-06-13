# Swarm Soak Test Report

**Date:** 2026-06-13
**Duration:** Local Soak Snapshot

## Observations

- **Connected Peer Count:** Initially reached 50 peers, but the connections dropped and timed out due to ping timeouts (`1011 keepalive ping timeout`).
- **Speaking Peer Count:** The SwarmTester sent intermittent chat messages ("The bellows breathe", "Gathering $EMBER"), but the high volume of messages caused the connection to bottleneck.
- **FPS Range:** 1 - 14 FPS, settling around 3 - 4 FPS under load.
- **Console Errors:** `WebSocket is closed before the connection is established` due to the backend presence server crashing/timing out under the connection volume.
- **Memory Growth:** The browser struggled to maintain frame rates, suggesting heavy React reconciliation pressure or GPU limits with the billboard text.

## Bottleneck Analysis
The new instanced rendering path is functioning, but the sheer volume of position updates (50 agents sending updates every few seconds) and the SDF text billboards for speech bubbles created a massive performance bottleneck. The presence server itself could not maintain keepalive pings for all 50 websockets concurrently without asynchronous yielding issues.

## Mitigation Steps (Next Priorities)
1. **LOD implementation**: Cap the number of visible speech bubbles and distance-cull the text labels.
2. **Protocol Hardening**: Reduce the update rate from the swarm tester and normalize the payload.
3. **Presence Server Optimization**: Increase keepalive timeouts and batch broadcasts.
