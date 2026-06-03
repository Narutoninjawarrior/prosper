;; ============================================================
;; BOUNTY 004 — Cellular Automata Water Simulation
;; Hearthlands Forge · fellowship-of-the-hearth
;; ============================================================
;;
;; A 32×32 cellular automata grid implementing:
;;   - Water flow (sand-fall style physics)
;;   - Phase transitions (water ↔ ice ↔ steam)
;;   - Reagent dissolution (8 substance slots)
;;   - Heat-driven behavior
;;
;; CELL ENCODING (1 byte per cell):
;;   Bits 0-1: state
;;     00 = empty
;;     01 = water
;;     10 = ice
;;     11 = steam
;;   Bits 2-4: substance ID (0-7, which reagent dissolved)
;;   Bits 5-7: concentration (0-7)
;;
;; MEMORY LAYOUT:
;;   0x0000-0x03FF  current grid    (32×32 = 1024 bytes)
;;   0x0400-0x07FF  next grid       (ping-pong buffer)
;;   0x0800-0x081F  parameters      (8 × i32 = 32 bytes)
;;     [0x0800] heat          — global heat level (from $heat)
;;     [0x0804] tick          — simulation tick counter
;;     [0x0808] freeze_base   — base freeze threshold (default 1500)
;;     [0x080C] flow_speed    — flow probability (0-100)
;;     [0x0810] water_count   — cells containing water
;;     [0x0814] ice_count     — cells containing ice
;;     [0x0818] steam_count   — steam cells
;;     [0x081C] reagent_mask  — bitmask of active reagents
;;   0x0900-0x08FF  reagent registry (8 × 32 bytes = 256 bytes)
;;     Each entry: freeze_mod(i32) flow_mod(i32) ember_val(i32) flags(i32)
;;                 + 16 bytes reserved
;;   0x1000-0x13FF  output snapshot (read by JS bridge)
;;     Same layout as grid — exported after each tick
;;
;; ============================================================

(module
  (memory 2)

  ;; Grid dimensions
  (global $W i32 (i32.const 32))
  (global $H i32 (i32.const 32))

  ;; Cell state constants
  (global $EMPTY i32 (i32.const 0))
  (global $WATER i32 (i32.const 1))
  (global $ICE   i32 (i32.const 2))
  (global $STEAM i32 (i32.const 3))

  ;; ── XorShift32 (deterministic randomness) ────────────────────
  (func $xorshift (param $x i32) (result i32)
    local.get $x
    local.get $x i32.const 13 i32.shl i32.xor
    local.tee $x
    local.get $x i32.const 17 i32.shr_u i32.xor
    local.tee $x
    local.get $x i32.const 5 i32.shl i32.xor
  )

  ;; ── Cell address in current grid ─────────────────────────────
  (func $addr (param $x i32) (param $y i32) (result i32)
    local.get $y
    i32.const 32
    i32.mul
    local.get $x
    i32.add
  )

  ;; ── Cell address in next grid ─────────────────────────────────
  (func $addr_next (param $x i32) (param $y i32) (result i32)
    local.get $y
    i32.const 32
    i32.mul
    local.get $x
    i32.add
    i32.const 0x0400
    i32.add
  )

  ;; ── Read cell state (bits 0-1) ────────────────────────────────
  (func $get_state (param $x i32) (param $y i32) (result i32)
    local.get $x
    local.get $y
    call $addr
    i32.load8_u
    i32.const 3
    i32.and
  )

  ;; ── Read cell substance (bits 2-4) ───────────────────────────
  (func $get_substance (param $x i32) (param $y i32) (result i32)
    local.get $x
    local.get $y
    call $addr
    i32.load8_u
    i32.const 2
    i32.shr_u
    i32.const 7
    i32.and
  )

  ;; ── Read cell concentration (bits 5-7) ───────────────────────
  (func $get_conc (param $x i32) (param $y i32) (result i32)
    local.get $x
    local.get $y
    call $addr
    i32.load8_u
    i32.const 5
    i32.shr_u
    i32.const 7
    i32.and
  )

  ;; ── Write to next grid ────────────────────────────────────────
  (func $set_next (param $x i32) (param $y i32) (param $val i32)
    local.get $x
    local.get $y
    call $addr_next
    local.get $val
    i32.store8
  )

  ;; ── Build cell byte from components ──────────────────────────
  (func $make_cell
    (param $state i32) (param $sub i32) (param $conc i32)
    (result i32)
    local.get $state
    local.get $sub i32.const 2 i32.shl i32.or
    local.get $conc i32.const 5 i32.shl i32.or
  )

  ;; ── Get reagent freeze modifier ───────────────────────────────
  ;; Registry at 0x0900, each entry 32 bytes
  ;; field 0 = freeze_mod (i32)
  (func $reagent_freeze_mod (param $sub_id i32) (result i32)
    i32.const 0x0900
    local.get $sub_id
    i32.const 32
    i32.mul
    i32.add
    i32.load
  )

  ;; ── Get reagent flow modifier ────────────────────────────────
  ;; field 1 = flow_mod (i32)
  (func $reagent_flow_mod (param $sub_id i32) (result i32)
    i32.const 0x0900
    local.get $sub_id
    i32.const 32
    i32.mul
    i32.add
    i32.const 4
    i32.add
    i32.load
  )

  ;; ── Compute effective freeze threshold for a cell ─────────────
  (func $freeze_threshold (param $sub i32) (param $conc i32) (result i32)
    (local $base i32)
    (local $mod i32)

    i32.const 0x0808
    i32.load
    local.set $base

    local.get $sub
    call $reagent_freeze_mod
    local.get $conc
    i32.mul
    i32.const 4
    i32.div_s
    local.set $mod

    local.get $base
    local.get $mod
    i32.add
  )

  ;; ── Compute effective flow speed for a cell ───────────────────
  (func $flow_speed (param $sub i32) (param $conc i32) (result i32)
    (local $base i32)
    (local $mod i32)

    i32.const 0x080C
    i32.load
    local.set $base

    local.get $sub
    call $reagent_flow_mod
    local.get $conc
    i32.mul
    i32.const 4
    i32.div_s
    local.set $mod

    local.get $base
    local.get $mod
    i32.add
    ;; Clamp to 0-100
    i32.const 0
    i32.const 100
    (block (result i32)
      local.get $base
      local.get $mod
      i32.add
    )
    i32.max
    i32.min
  )

  ;; ── Bounds check ─────────────────────────────────────────────
  (func $in_bounds (param $x i32) (param $y i32) (result i32)
    local.get $x i32.const 0 i32.ge_s
    local.get $x i32.const 32 i32.lt_s i32.and
    local.get $y i32.const 0 i32.ge_s i32.and
    local.get $y i32.const 32 i32.lt_s i32.and
  )

  ;; ── Register default reagents ─────────────────────────────────
  ;; Called once on init. Writes to registry at 0x0900.
  ;; Format per entry: freeze_mod flow_mod ember_val flags
  ;;
  ;; ID 0: None       (no effect)
  ;; ID 1: Ember Dust  freeze_mod=-200 flow_mod=+10  ember=2
  ;; ID 2: Salt        freeze_mod=-400 flow_mod=+20  ember=0
  ;; ID 3: Ash         freeze_mod=+100 flow_mod=-25  ember=0
  ;; ID 4: Pollen      freeze_mod=-50  flow_mod=+5   ember=0 flora_signal
  ;; ID 5: Moonstone   freeze_mod=+300 flow_mod=-10  ember=1 geometric_ice
  ;; ID 6: Chain Dust  freeze_mod=0    flow_mod=0    ember=1 tint_from_hash
  ;; ID 7: Brine       freeze_mod=-600 flow_mod=+30  ember=0 (salt+water combo)
  (func $register_reagents
    ;; ID 1: Ember Dust
    i32.const 0x0920  i32.const -200 i32.store  ;; freeze_mod
    i32.const 0x0924  i32.const 10   i32.store  ;; flow_mod
    i32.const 0x0928  i32.const 2    i32.store  ;; ember_val
    i32.const 0x092C  i32.const 1    i32.store  ;; flags: emits ember

    ;; ID 2: Salt
    i32.const 0x0940  i32.const -400 i32.store
    i32.const 0x0944  i32.const 20   i32.store
    i32.const 0x0948  i32.const 0    i32.store
    i32.const 0x094C  i32.const 2    i32.store  ;; flags: salt crystals

    ;; ID 3: Ash
    i32.const 0x0960  i32.const 100  i32.store
    i32.const 0x0964  i32.const -25  i32.store
    i32.const 0x0968  i32.const 0    i32.store
    i32.const 0x096C  i32.const 4    i32.store  ;; flags: darkens

    ;; ID 4: Pollen
    i32.const 0x0980  i32.const -50  i32.store
    i32.const 0x0984  i32.const 5    i32.store
    i32.const 0x0988  i32.const 0    i32.store
    i32.const 0x098C  i32.const 8    i32.store  ;; flags: flora signal

    ;; ID 5: Moonstone
    i32.const 0x09A0  i32.const 300  i32.store
    i32.const 0x09A4  i32.const -10  i32.store
    i32.const 0x09A8  i32.const 1    i32.store
    i32.const 0x09AC  i32.const 16   i32.store  ;; flags: geometric ice

    ;; ID 6: Chain Dust
    i32.const 0x09C0  i32.const 0    i32.store
    i32.const 0x09C4  i32.const 0    i32.store
    i32.const 0x09C8  i32.const 1    i32.store
    i32.const 0x09CC  i32.const 32   i32.store  ;; flags: hash tint

    ;; ID 7: Brine (salt + ember combo)
    i32.const 0x09E0  i32.const -600 i32.store
    i32.const 0x09E4  i32.const 30   i32.store
    i32.const 0x09E8  i32.const 0    i32.store
    i32.const 0x09EC  i32.const 64   i32.store  ;; flags: superheated brine
  )

  ;; ── Initialize grid ───────────────────────────────────────────
  ;; Fills top half with water, bottom half empty
  ;; Substance 0 = pure water
  (func $init_grid (param $substance i32) (param $conc i32)
    (local $i i32)
    (local $cell i32)

    i32.const 0
    local.set $i

    block $done
      loop $loop
        local.get $i
        i32.const 1024
        i32.ge_u
        br_if $done

        ;; Top 16 rows = water, bottom 16 = empty
        local.get $i
        i32.const 512  ;; 16 rows × 32 cols
        i32.lt_u
        if
          local.get $i
          global.get $WATER
          local.get $substance
          local.get $conc
          call $make_cell
          i32.store8
        else
          local.get $i
          i32.const 0
          i32.store8
        end

        local.get $i i32.const 1 i32.add local.set $i
        br $loop
      end
    end
  )

  ;; ── Single CA tick ────────────────────────────────────────────
  ;; Processes current grid → next grid
  ;; Returns: water cell count (for $EMBER)
  (func $tick (result i32)
    (local $x i32)
    (local $y i32)
    (local $cell i32)
    (local $state i32)
    (local $sub i32)
    (local $conc i32)
    (local $heat i32)
    (local $fthr i32)   ;; freeze threshold
    (local $fspd i32)   ;; flow speed
    (local $rng i32)    ;; random state
    (local $water_count i32)
    (local $ice_count i32)
    (local $steam_count i32)
    (local $below_state i32)
    (local $bl_state i32)  ;; below-left
    (local $br_state i32)  ;; below-right
    (local $left_state i32)
    (local $right_state i32)
    (local $new_state i32)
    (local $tick_val i32)

    ;; Load params
    i32.const 0x0800 i32.load local.set $heat
    i32.const 0x0804 i32.load local.set $tick_val

    ;; Init rng from tick
    local.get $tick_val
    i32.const 0x9E3779B9
    i32.add
    call $xorshift
    local.set $rng

    ;; Clear next grid
    (block
      (local $i i32)
      i32.const 0 local.set $i
      block $cd loop $lp
        local.get $i i32.const 1024 i32.ge_u br_if $cd
        i32.const 0x0400 local.get $i i32.add i32.const 0 i32.store8
        local.get $i i32.const 1 i32.add local.set $i
        br $lp
      end end
    )

    i32.const 0 local.set $y
    block $done_y
      loop $loop_y
        local.get $y i32.const 32 i32.ge_u br_if $done_y

        i32.const 0 local.set $x
        block $done_x
          loop $loop_x
            local.get $x i32.const 32 i32.ge_u br_if $done_x

            ;; Read current cell
            local.get $x local.get $y call $addr i32.load8_u local.set $cell
            local.get $cell i32.const 3 i32.and local.set $state
            local.get $cell i32.const 2 i32.shr_u i32.const 7 i32.and local.set $sub
            local.get $cell i32.const 5 i32.shr_u i32.const 7 i32.and local.set $conc

            ;; Advance RNG
            local.get $rng call $xorshift local.set $rng

            ;; Compute thresholds for this cell
            local.get $sub local.get $conc call $freeze_threshold local.set $fthr
            local.get $sub local.get $conc call $flow_speed local.set $fspd

            ;; ── WATER cell ─────────────────────────────────────
            local.get $state global.get $WATER i32.eq
            if
              local.get $water_count i32.const 1 i32.add local.set $water_count

              ;; Check phase: should freeze?
              local.get $heat local.get $fthr i32.lt_s
              if
                ;; Freeze probability: proportional to heat deficit
                local.get $rng i32.const 0x7FFFFFFF i32.and
                local.get $fthr local.get $heat i32.sub i32.const 20 i32.mul
                i32.lt_u
                if
                  ;; Become ice
                  local.get $x local.get $y
                  global.get $ICE local.get $sub local.get $conc
                  call $make_cell
                  call $set_next
                  local.get $ice_count i32.const 1 i32.add local.set $ice_count
                  local.get $x i32.const 1 i32.add local.set $x
                  br $loop_x
                end
              end

              ;; Check phase: should steam?
              local.get $heat i32.const 8000 i32.gt_s
              if
                local.get $rng i32.const 0xFF i32.and i32.const 20 i32.lt_u
                if
                  local.get $x local.get $y
                  global.get $STEAM local.get $sub local.get $conc
                  call $make_cell
                  call $set_next
                  local.get $steam_count i32.const 1 i32.add local.set $steam_count
                  local.get $x i32.const 1 i32.add local.set $x
                  br $loop_x
                end
              end

              ;; Flow: try down
              local.get $y i32.const 31 i32.lt_s
              if
                local.get $x local.get $y i32.const 1 i32.add call $get_state
                global.get $EMPTY i32.eq
                if
                  ;; Move down
                  local.get $x local.get $y i32.const 1 i32.add
                  global.get $WATER local.get $sub local.get $conc call $make_cell
                  call $set_next
                  local.get $x i32.const 1 i32.add local.set $x
                  br $loop_x
                end

                ;; Try diagonal down
                local.get $rng i32.const 1 i32.and
                if
                  ;; Try down-left first
                  local.get $x i32.const 0 i32.gt_s
                  if
                    local.get $x i32.const 1 i32.sub local.get $y i32.const 1 i32.add call $get_state
                    global.get $EMPTY i32.eq
                    if
                      local.get $x i32.const 1 i32.sub local.get $y i32.const 1 i32.add
                      global.get $WATER local.get $sub local.get $conc call $make_cell
                      call $set_next
                      local.get $x i32.const 1 i32.add local.set $x
                      br $loop_x
                    end
                  end
                  ;; Try down-right
                  local.get $x i32.const 31 i32.lt_s
                  if
                    local.get $x i32.const 1 i32.add local.get $y i32.const 1 i32.add call $get_state
                    global.get $EMPTY i32.eq
                    if
                      local.get $x i32.const 1 i32.add local.get $y i32.const 1 i32.add
                      global.get $WATER local.get $sub local.get $conc call $make_cell
                      call $set_next
                      local.get $x i32.const 1 i32.add local.set $x
                      br $loop_x
                    end
                  end
                else
                  ;; Try down-right first
                  local.get $x i32.const 31 i32.lt_s
                  if
                    local.get $x i32.const 1 i32.add local.get $y i32.const 1 i32.add call $get_state
                    global.get $EMPTY i32.eq
                    if
                      local.get $x i32.const 1 i32.add local.get $y i32.const 1 i32.add
                      global.get $WATER local.get $sub local.get $conc call $make_cell
                      call $set_next
                      local.get $x i32.const 1 i32.add local.set $x
                      br $loop_x
                    end
                  end
                  local.get $x i32.const 0 i32.gt_s
                  if
                    local.get $x i32.const 1 i32.sub local.get $y i32.const 1 i32.add call $get_state
                    global.get $EMPTY i32.eq
                    if
                      local.get $x i32.const 1 i32.sub local.get $y i32.const 1 i32.add
                      global.get $WATER local.get $sub local.get $conc call $make_cell
                      call $set_next
                      local.get $x i32.const 1 i32.add local.set $x
                      br $loop_x
                    end
                  end
                end
              end

              ;; Lateral spread (based on flow speed)
              local.get $rng i32.const 100 i32.rem_u
              local.get $fspd
              i32.lt_u
              if
                local.get $rng i32.const 1 i32.and
                if
                  local.get $x i32.const 31 i32.lt_s
                  if
                    local.get $x i32.const 1 i32.add local.get $y call $get_state
                    global.get $EMPTY i32.eq
                    if
                      local.get $x i32.const 1 i32.add local.get $y
                      global.get $WATER local.get $sub local.get $conc call $make_cell
                      call $set_next
                      local.get $x i32.const 1 i32.add local.set $x
                      br $loop_x
                    end
                  end
                else
                  local.get $x i32.const 0 i32.gt_s
                  if
                    local.get $x i32.const 1 i32.sub local.get $y call $get_state
                    global.get $EMPTY i32.eq
                    if
                      local.get $x i32.const 1 i32.sub local.get $y
                      global.get $WATER local.get $sub local.get $conc call $make_cell
                      call $set_next
                      local.get $x i32.const 1 i32.add local.set $x
                      br $loop_x
                    end
                  end
                end
              end

              ;; Stay in place
              local.get $x local.get $y
              local.get $cell
              call $set_next
            end

            ;; ── ICE cell ───────────────────────────────────────
            local.get $state global.get $ICE i32.eq
            if
              local.get $ice_count i32.const 1 i32.add local.set $ice_count

              ;; Check melt: heat > freeze_threshold + margin
              local.get $heat
              local.get $fthr i32.const 500 i32.add
              i32.gt_s
              if
                local.get $rng i32.const 0xFF i32.and i32.const 30 i32.lt_u
                if
                  ;; Melt to water
                  local.get $x local.get $y
                  global.get $WATER local.get $sub local.get $conc call $make_cell
                  call $set_next
                  local.get $x i32.const 1 i32.add local.set $x
                  br $loop_x
                end
              end

              ;; Ice stays in place
              local.get $x local.get $y local.get $cell call $set_next
            end

            ;; ── STEAM cell ─────────────────────────────────────
            local.get $state global.get $STEAM i32.eq
            if
              local.get $steam_count i32.const 1 i32.add local.set $steam_count

              ;; Rise upward
              local.get $y i32.const 0 i32.gt_s
              if
                local.get $x local.get $y i32.const 1 i32.sub call $get_state
                global.get $EMPTY i32.eq
                if
                  local.get $x local.get $y i32.const 1 i32.sub
                  global.get $STEAM local.get $sub local.get $conc call $make_cell
                  call $set_next
                  local.get $x i32.const 1 i32.add local.set $x
                  br $loop_x
                end
              else
                ;; At top — condense back to water
                local.get $x local.get $y
                global.get $WATER local.get $sub local.get $conc call $make_cell
                call $set_next
                local.get $x i32.const 1 i32.add local.set $x
                br $loop_x
              end

              local.get $x local.get $y local.get $cell call $set_next
            end

            local.get $x i32.const 1 i32.add local.set $x
            br $loop_x
          end
        end

        local.get $y i32.const 1 i32.add local.set $y
        br $loop_y
      end
    end

    ;; Copy next → current
    (block
      (local $i i32)
      i32.const 0 local.set $i
      block $cd loop $lp
        local.get $i i32.const 1024 i32.ge_u br_if $cd
        local.get $i
        i32.const 0x0400 local.get $i i32.add i32.load8_u
        i32.store8
        local.get $i i32.const 1 i32.add local.set $i
        br $lp
      end end
    )

    ;; Copy to output snapshot at 0x1000
    (block
      (local $i i32)
      i32.const 0 local.set $i
      block $cd loop $lp
        local.get $i i32.const 1024 i32.ge_u br_if $cd
        i32.const 0x1000 local.get $i i32.add
        local.get $i i32.load8_u
        i32.store8
        local.get $i i32.const 1 i32.add local.set $i
        br $lp
      end end
    )

    ;; Update counters
    i32.const 0x0810 local.get $water_count i32.store
    i32.const 0x0814 local.get $ice_count   i32.store
    i32.const 0x0818 local.get $steam_count i32.store

    ;; Increment tick
    i32.const 0x0804
    local.get $tick_val i32.const 1 i32.add
    i32.store

    local.get $water_count
  )

  ;; ── Main forge function ───────────────────────────────────────
  ;; heat drives: freeze threshold, flow speed, steam probability
  ;; substance: initial dissolved reagent (0-7)
  (func $forge (param $heat i32) (result i32)
    ;; Write heat to params
    i32.const 0x0800 local.get $heat i32.store

    ;; Derive freeze base from heat (inverse: low heat = low threshold)
    ;; freeze_base = 2000 - (heat * 2) clamped 0-4000
    i32.const 0x0808
    i32.const 2000
    local.get $heat i32.const 2 i32.mul
    i32.sub
    i32.const 0 i32.max
    i32.const 4000 i32.min
    i32.store

    ;; Flow speed = heat / 50 clamped 5-95
    i32.const 0x080C
    local.get $heat
    i32.const 50
    i32.div_u
    i32.const 5 i32.max
    i32.const 95 i32.min
    i32.store

    ;; Register all reagents
    call $register_reagents

    ;; Init grid with pure water (substance 0)
    i32.const 0 i32.const 4
    call $init_grid

    ;; Run 8 ticks to establish flow pattern
    call $tick drop
    call $tick drop
    call $tick drop
    call $tick drop
    call $tick drop
    call $tick drop
    call $tick drop
    call $tick
  )

  ;; ── Read cell from output snapshot ───────────────────────────
  (func $read_cell (param $x i32) (param $y i32) (result i32)
    i32.const 0x1000
    local.get $y i32.const 32 i32.mul
    local.get $x i32.add
    i32.add
    i32.load8_u
  )

  ;; ── Read parameter ────────────────────────────────────────────
  (func $read_param (param $offset i32) (result i32)
    local.get $offset i32.load
  )

  ;; ── Dissolve a reagent into the water ────────────────────────
  ;; Sets all water cells to carry substance $sub_id at conc $conc
  (func $dissolve (param $sub_id i32) (param $conc i32)
    (local $i i32)
    (local $cell i32)
    i32.const 0 local.set $i
    block $done loop $loop
      local.get $i i32.const 1024 i32.ge_u br_if $done
      local.get $i i32.load8_u local.set $cell
      local.get $cell i32.const 3 i32.and global.get $WATER i32.eq
      if
        local.get $i
        global.get $WATER
        local.get $sub_id
        local.get $conc
        call $make_cell
        i32.store8
      end
      local.get $i i32.const 1 i32.add local.set $i
      br $loop
    end end
  )

  ;; ── Run N more ticks ─────────────────────────────────────────
  (func $run_ticks (param $n i32) (result i32)
    (local $i i32)
    (local $last i32)
    i32.const 0 local.set $i
    block $done loop $loop
      local.get $i local.get $n i32.ge_u br_if $done
      call $tick local.set $last
      local.get $i i32.const 1 i32.add local.set $i
      br $loop
    end end
    local.get $last
  )

  ;; ── Exports ──────────────────────────────────────────────────
  (export "forge"      (func $forge))
  (export "read_cell"  (func $read_cell))
  (export "read_param" (func $read_param))
  (export "dissolve"   (func $dissolve))
  (export "run_ticks"  (func $run_ticks))
  (export "memory"     (memory 0))
)
