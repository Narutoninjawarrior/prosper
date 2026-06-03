;; ============================================================
;; BOUNTY 002 — Generative Seed Engine
;; Hearthlands Forge · fellowship-of-the-hearth
;; ============================================================
;;
;; PURPOSE:
;;   Takes $heat (the Hearth's economic signal) and runs it
;;   through a cascade of deterministic transforms to produce
;;   a high-entropy 32-bit seed.
;;
;;   That seed is bound to this module's chain_hash and passed
;;   to ArtFrame's mulberry32 renderer — same heat level always
;;   produces the same art. Different heat = different piece.
;;
;; ECONOMICS:
;;   Returns seed value > 0  → earns $EMBER (useful work)
;;   Returns 0               → no reward (degenerate input)
;;
;; OUTPUT FORMAT (for ThreeForge ForgeNode):
;;   {
;;     object_type: "lodge",
;;     chain_hash:  <stamped by Forge>,
;;     seed:        <return value of $forge>,
;;     heat_level:  <input $heat>,
;;     algo:        <derived 0-3, selects ArtFrame algorithm>
;;   }
;;
;; ALGORITHM: XorShift32 cascade seeded by heat
;;   Three-round xorshift produces good avalanche — small
;;   changes in $heat flip roughly half the output bits.
;;   The final step mixes in a Fibonacci-derived constant
;;   to break symmetry at heat=0 and heat=1.
;;
;; MEMORY:
;;   Uses 1 page (64KB) of linear memory for intermediate state.
;;   Slots 0-4 store the xorshift state across the cascade.
;; ============================================================

(module

  ;; 1 page = 64KB of linear memory for intermediate xorshift state
  (memory 1)

  ;; ── XorShift32 ────────────────────────────────────────────────
  ;; Classic Marsaglia xorshift. Period = 2^32 - 1.
  ;; Input must be non-zero; we guard below.
  (func $xorshift32 (param $x i32) (result i32)
    (local $t i32)

    ;; t = x ^ (x << 13)
    local.get $x
    local.get $x
    i32.const 13
    i32.shl
    i32.xor
    local.set $t

    ;; t = t ^ (t >> 17)
    local.get $t
    local.get $t
    i32.const 17
    i32.shr_u
    i32.xor
    local.set $t

    ;; t = t ^ (t << 5)
    local.get $t
    local.get $t
    i32.const 5
    i32.shl
    i32.xor
  )

  ;; ── Mix constant ──────────────────────────────────────────────
  ;; Mixes a Fibonacci-derived prime (0x9E3779B9) into the state.
  ;; Breaks symmetry and ensures heat=0 still produces useful output.
  (func $mix (param $x i32) (result i32)
    local.get $x
    i32.const 0x9E3779B9   ;; 2654435769 — golden ratio * 2^32
    i32.add
    local.get $x
    i32.const 0x9E3779B9
    i32.add
    i32.const 15
    i32.rotl
    i32.mul
  )

  ;; ── Clamp heat to safe seed range ────────────────────────────
  ;; XorShift requires non-zero seed.
  ;; If heat is 0 we substitute the genesis hash prefix (0xe1476e38).
  (func $safe_seed (param $heat i32) (result i32)
    local.get $heat
    i32.eqz
    if (result i32)
      i32.const 0xe1476e38   ;; genesis tile chain_hash prefix
    else
      local.get $heat
    end
  )

  ;; ── Algorithm selector ────────────────────────────────────────
  ;; Extracts bits 28-29 of the final seed to pick the render algo:
  ;;   0 → Concentric polygons
  ;;   1 → Flow fields
  ;;   2 → Geometric tiles
  ;;   3 → Radial burst
  (func $algo (param $seed i32) (result i32)
    local.get $seed
    i32.const 28
    i32.shr_u
    i32.const 3
    i32.and
  )

  ;; ── Store cascade state to memory ────────────────────────────
  ;; Writes intermediate values so the Forge inspector can read them.
  ;; Address layout:
  ;;   0x00 — round 1 output
  ;;   0x04 — round 2 output
  ;;   0x08 — round 3 output (post-mix)
  ;;   0x0C — algo selector
  ;;   0x10 — original heat
  (func $store_state
    (param $r1 i32)
    (param $r2 i32)
    (param $r3 i32)
    (param $algo_val i32)
    (param $heat i32)

    i32.const 0x00
    local.get $r1
    i32.store

    i32.const 0x04
    local.get $r2
    i32.store

    i32.const 0x08
    local.get $r3
    i32.store

    i32.const 0x0C
    local.get $algo_val
    i32.store

    i32.const 0x10
    local.get $heat
    i32.store
  )

  ;; ── Main forge function ───────────────────────────────────────
  ;; Exported as "forge" — entry point called by the Hearth.
  ;; Takes $heat (i32), returns seed (i32).
  (func $forge (param $heat i32) (result i32)
    (local $s i32)   ;; working seed
    (local $r1 i32)  ;; round 1
    (local $r2 i32)  ;; round 2
    (local $r3 i32)  ;; round 3 (final)
    (local $a i32)   ;; algo selector

    ;; Ensure non-zero seed
    local.get $heat
    call $safe_seed
    local.set $s

    ;; Round 1: xorshift
    local.get $s
    call $xorshift32
    local.set $r1

    ;; Round 2: xorshift again (from r1)
    local.get $r1
    call $xorshift32
    local.set $r2

    ;; Round 3: mix in golden ratio constant
    local.get $r2
    call $mix
    local.set $r3

    ;; Derive algo selector from final seed
    local.get $r3
    call $algo
    local.set $a

    ;; Store cascade state to memory for inspector
    local.get $r1
    local.get $r2
    local.get $r3
    local.get $a
    local.get $heat
    call $store_state

    ;; Return final seed — this value drives ArtFrame's mulberry32
    local.get $r3
  )

  ;; ── Memory read helper ────────────────────────────────────────
  ;; Lets the JS bridge read the cascade state after execution.
  (func $read_state (param $offset i32) (result i32)
    local.get $offset
    i32.load
  )

  ;; ── Exports ───────────────────────────────────────────────────
  (export "forge"      (func $forge))
  (export "read_state" (func $read_state))
  (export "memory"     (memory 0))
)
