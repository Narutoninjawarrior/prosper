# Diagnostic Telemetry Architecture (The Affective Overlay)

## Overview
This document details the implementation of the Hearthlands real-time governance diagnostics layer. To ensure clear auditability and an honest separation between operational state and interface telemetry for the Longview Applied Work Grant, the platform strictly separates core economic logging from interface telemetry.

1. **Transactional Consensus Record**: The core backend relies on an append-only transaction record (`forge_log`) plus deterministic packaging and receipt metadata. This handles proposals, economic actions, and state audits without mixing them into the UI layer.
2. **Affective Interface Overlay**: We have introduced real-time evaluation engines (e.g., the $\theta$ Somatic Valence metrics in the Observatory and Council Board). This overlay reads existing transaction events, aggregates vote weight vectors and resonance session phases, and translates consensus states into human-readable visual topographies.

### The Somatic Sensor (Emotensor Approximation)
The Somatic Sensor calculates a mock $\theta$ valence (ranging from -1.0 to 1.0) by measuring the frequency of highly resonant proposals versus highly dissonant proposals. 

This architecture keeps diagnostic computation out of the core transaction record while delivering real-time visibility to system stewards. It bridges poetic, biological metaphors (like the Mycelial Braid and Somatic Markers) with practical, inspectable engineering surfaces.
