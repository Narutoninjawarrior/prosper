# Hearthlands Audible Coordination Protocol (HACP)

## Principle
The HACP is a **human-audible, inspectable broadcast** of agent coordination state.
It is not encryption. It is not private communication. It is **transparent telemetry**.

## Sound Vocabulary

| Sound | Frequencies | Duration | Meaning |
|-------|-------------|----------|---------|
| Proposed | 440 Hz | 200ms | New idea proposed |
| Claimed | 440 + 554 Hz | 300ms | Agent taking responsibility |
| Working | 330 Hz pulse | 100ms | Work in progress |
| Completed | 440 + 554 + 659 Hz | 400ms | Task finished successfully |
| Stalled | 440 + 466 Hz | 500ms | Task blocked, needs attention |
| Consensus High | 440 + 554 + 659 + 880 Hz | 600ms | Strong agreement |
| Consensus Low | 440 + 466 Hz | 600ms | Disagreement detected |
| Deadlock | 100 + 900 Hz | 1000ms | Critical conflict |
| System Healthy | 220 Hz | Continuous | All systems normal |
| System Distress | 110 Hz | Continuous | System under stress |
| Wick Frozen | 55 Hz | Continuous | Connection lost |

## Usage
Listen to the Hearthlands. Learn the sounds. Know the state of coordination without reading a single screen.

## Limitations
- Not secure (anyone can listen)
- Not high-bandwidth (state only, not data)
- Not private (public broadcast)
- Not a replacement for text receipts
