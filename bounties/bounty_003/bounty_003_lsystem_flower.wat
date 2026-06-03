;; ============================================================
;; BOUNTY 003 — L-System Flower Bed
;; Hearthlands Forge · fellowship-of-the-hearth
;; ============================================================
;;
;; PURPOSE:
;;   Implements a parametric Lindenmayer System (L-System) — the
;;   mathematical grammar that describes how plants grow. Takes
;;   $heat as input and produces a compact growth descriptor that
;;   the FlowerBed.jsx renderer turns into living Three.js geometry.
;;
;;   Low heat  → seedling (1-2 generations, sparse branches)
;;   Mid heat  → young plant (3-4 generations, leaves appear)
;;   High heat → full bloom (5-6 generations, flowers open)
;;
;; L-SYSTEM RULE SET (Classic plant grammar):
;;   Axiom:  X
;;   X → F+[[X]-X]-F[-FX]+X
;;   F → FF
;;
;;   Symbols:
;;     F = draw stem segment forward
;;     + = rotate left by $angle
;;     - = rotate right by $angle
;;     [ = push turtle state (branch point)
;;     ] = pop turtle state (return to branch point)
;;     X = growth node (non-drawing)
;;
;; ALGORITHM:
;;   1. Derive parameters from $heat (generations, angle, length)
;;   2. Expand L-System string symbolically (stored as byte codes)
;;   3. Execute turtle graphics → branch segments stored in memory
;;   4. Return branch count (drives $EMBER reward)
;;
;; MEMORY LAYOUT (all offsets in bytes):
;;   0x0000 — parameters block (5 × i32 = 20 bytes)
;;     [0] generations  (1-6)
;;     [4] angle_deg    (15-45 degrees × 100 for precision)
;;     [8] seg_length   (base segment length × 1000)
;;     [C] branch_count (output: total segments rendered)
;;     [10] bloom_stage (0=seed 1=sprout 2=plant 3=bloom)
;;
;;   0x0100 — L-System string buffer (1KB, max 1024 symbols)
;;     Each byte is a symbol code:
;;       0x01 = F (forward)
;;       0x02 = + (left)
;;       0x03 = - (right)
;;       0x04 = [ (push)
;;       0x05 = ] (pop)
;;       0x06 = X (growth node)
;;
;;   0x0500 — Turtle stack (32 entries × 16 bytes = 512 bytes)
;;     Each entry: x(i32) y(i32) angle(i32) depth(i32)
;;     Angles stored as degrees × 100
;;
;;   0x0800 — Branch segment output (128 entries × 24 bytes)
;;     Each entry: x1 y1 x2 y2 depth length (all i32, scaled ×1000)
;;
;;   0x1200 — Flower positions (32 entries × 12 bytes)
;;     Each entry: x y bloom_radius (all i32, scaled ×1000)
;;
;; ============================================================

(module
  (memory 2)  ;; 2 pages = 128KB

  ;; ── Integer sin approximation (Bhaskara I formula) ───────────
  ;; Input:  angle in degrees × 100 (0 to 36000)
  ;; Output: sin × 1000 (range -1000 to 1000)
  ;; Bhaskara I: sin(x) ≈ 4x(180-x) / (40500 - x(180-x))
  ;; for x in [0, 180] degrees
  (func $isin (param $angle_cdeg i32) (result i32)
    (local $a i32)    ;; angle in whole degrees (0-360)
    (local $x i32)    ;; normalized to 0-180
    (local $sign i32) ;; +1 or -1
    (local $num i32)
    (local $den i32)

    ;; Normalize to 0-35999
    local.get $angle_cdeg
    i32.const 36000
    i32.rem_u
    local.set $angle_cdeg

    ;; Convert to whole degrees
    local.get $angle_cdeg
    i32.const 100
    i32.div_u
    local.set $a

    ;; Determine quadrant and sign
    local.get $a
    i32.const 180
    i32.lt_u
    if
      i32.const 1
      local.set $sign
      local.get $a
      local.set $x
    else
      i32.const -1
      local.set $sign
      local.get $a
      i32.const 180
      i32.sub
      local.set $x
    end

    ;; Bhaskara numerator: 4 * x * (180 - x)
    i32.const 4
    local.get $x
    i32.mul
    i32.const 180
    local.get $x
    i32.sub
    i32.mul
    local.set $num

    ;; Denominator: 40500 - x*(180-x)
    i32.const 40500
    local.get $x
    i32.const 180
    local.get $x
    i32.sub
    i32.mul
    i32.sub
    local.set $den

    ;; Result: sign * (num * 1000) / den
    local.get $sign
    local.get $num
    i32.const 1000
    i32.mul
    local.get $den
    i32.div_s
    i32.mul
  )

  ;; ── Integer cos (sin shifted by 90°) ─────────────────────────
  (func $icos (param $angle_cdeg i32) (result i32)
    local.get $angle_cdeg
    i32.const 9000  ;; + 90 degrees × 100
    i32.add
    call $isin
  )

  ;; ── XorShift32 (for deterministic variation) ─────────────────
  (func $xorshift (param $x i32) (result i32)
    local.get $x
    local.get $x
    i32.const 13
    i32.shl
    i32.xor
    local.tee $x
    local.get $x
    i32.const 17
    i32.shr_u
    i32.xor
    local.tee $x
    local.get $x
    i32.const 5
    i32.shl
    i32.xor
  )

  ;; ── Derive parameters from $heat ─────────────────────────────
  ;; Writes to params block at 0x0000
  (func $derive_params (param $heat i32)
    (local $gen i32)
    (local $angle i32)
    (local $seglen i32)
    (local $bloom i32)

    ;; generations: 1-6 based on heat ranges
    ;; 0-99=1, 100-499=2, 500-999=3, 1000-1999=4, 2000-3499=5, 3500+=6
    local.get $heat
    i32.const 3500
    i32.ge_u
    if
      i32.const 6
      local.set $gen
      i32.const 3
      local.set $bloom
    else
      local.get $heat
      i32.const 2000
      i32.ge_u
      if
        i32.const 5
        local.set $gen
        i32.const 3
        local.set $bloom
      else
        local.get $heat
        i32.const 1000
        i32.ge_u
        if
          i32.const 4
          local.set $gen
          i32.const 2
          local.set $bloom
        else
          local.get $heat
          i32.const 500
          i32.ge_u
          if
            i32.const 3
            local.set $gen
            i32.const 2
            local.set $bloom
          else
            local.get $heat
            i32.const 100
            i32.ge_u
            if
              i32.const 2
              local.set $gen
              i32.const 1
              local.set $bloom
            else
              i32.const 1
              local.set $gen
              i32.const 0
              local.set $bloom
            end
          end
        end
      end
    end

    ;; angle: extract bits 8-15 of heat, map to 1500-4500 (15-45 deg × 100)
    local.get $heat
    i32.const 8
    i32.shr_u
    i32.const 0xFF
    i32.and
    i32.const 12   ;; scale 0-255 → 0-3060
    i32.mul
    i32.const 1500 ;; base 15 degrees
    i32.add
    local.set $angle

    ;; segment length: scales with 1/generations (taller = finer)
    ;; base 500, reduced by generation count
    i32.const 2500
    local.get $gen
    i32.const 350
    i32.mul
    i32.sub
    local.set $seglen

    ;; Store params
    i32.const 0x0000
    local.get $gen
    i32.store

    i32.const 0x0004
    local.get $angle
    i32.store

    i32.const 0x0008
    local.get $seglen
    i32.store

    i32.const 0x000C
    i32.const 0     ;; branch count starts at 0
    i32.store

    i32.const 0x0010
    local.get $bloom
    i32.store
  )

  ;; ── Write L-System axiom to buffer ───────────────────────────
  ;; Axiom: X (single growth node)
  ;; Returns: string length
  (func $write_axiom (result i32)
    i32.const 0x0100
    i32.const 0x06   ;; X
    i32.store8
    i32.const 1      ;; length = 1
  )

  ;; ── Apply one generation of L-System rules ───────────────────
  ;; Reads from src buffer, writes to dst buffer
  ;; Rule: X → F+[[X]-X]-F[-FX]+X  (encoded as bytes)
  ;; Rule: F → FF
  ;; Returns: new string length
  (func $expand_once
    (param $src i32)   ;; source buffer offset
    (param $src_len i32)
    (param $dst i32)   ;; destination buffer offset
    (result i32)       ;; new length

    (local $i i32)     ;; source index
    (local $d i32)     ;; dest index
    (local $sym i32)   ;; current symbol

    i32.const 0
    local.set $i
    local.get $dst
    local.set $d

    block $break
      loop $loop
        local.get $i
        local.get $src_len
        i32.ge_u
        br_if $break

        ;; Read symbol
        local.get $src
        local.get $i
        i32.add
        i32.load8_u
        local.set $sym

        ;; Apply rule
        local.get $sym
        i32.const 0x06  ;; X?
        i32.eq
        if
          ;; X → F+[[X]-X]-F[-FX]+X
          ;; 0x01 F, 0x02 +, 0x04 [, 0x04 [, 0x06 X, 0x05 ]
          ;; 0x03 -, 0x06 X, 0x05 ], 0x03 -, 0x01 F
          ;; 0x04 [, 0x03 -, 0x01 F, 0x06 X, 0x05 ], 0x02 +, 0x06 X
          local.get $d i32.const 0x01 i32.store8  ;; F
          local.get $d i32.const 1 i32.add i32.const 0x02 i32.store8  ;; +
          local.get $d i32.const 2 i32.add i32.const 0x04 i32.store8  ;; [
          local.get $d i32.const 3 i32.add i32.const 0x04 i32.store8  ;; [
          local.get $d i32.const 4 i32.add i32.const 0x06 i32.store8  ;; X
          local.get $d i32.const 5 i32.add i32.const 0x05 i32.store8  ;; ]
          local.get $d i32.const 6 i32.add i32.const 0x03 i32.store8  ;; -
          local.get $d i32.const 7 i32.add i32.const 0x06 i32.store8  ;; X
          local.get $d i32.const 8 i32.add i32.const 0x05 i32.store8  ;; ]
          local.get $d i32.const 9 i32.add i32.const 0x03 i32.store8  ;; -
          local.get $d i32.const 10 i32.add i32.const 0x01 i32.store8 ;; F
          local.get $d i32.const 11 i32.add i32.const 0x04 i32.store8 ;; [
          local.get $d i32.const 12 i32.add i32.const 0x03 i32.store8 ;; -
          local.get $d i32.const 13 i32.add i32.const 0x01 i32.store8 ;; F
          local.get $d i32.const 14 i32.add i32.const 0x06 i32.store8 ;; X
          local.get $d i32.const 15 i32.add i32.const 0x05 i32.store8 ;; ]
          local.get $d i32.const 16 i32.add i32.const 0x02 i32.store8 ;; +
          local.get $d i32.const 17 i32.add i32.const 0x06 i32.store8 ;; X
          local.get $d
          i32.const 18
          i32.add
          local.set $d
        else
          local.get $sym
          i32.const 0x01  ;; F?
          i32.eq
          if
            ;; F → FF
            local.get $d i32.const 0x01 i32.store8
            local.get $d i32.const 1 i32.add i32.const 0x01 i32.store8
            local.get $d i32.const 2 i32.add local.set $d
          else
            ;; All other symbols pass through unchanged (+, -, [, ])
            local.get $d
            local.get $sym
            i32.store8
            local.get $d
            i32.const 1
            i32.add
            local.set $d
          end
        end

        local.get $i
        i32.const 1
        i32.add
        local.set $i

        ;; Safety: stop if dst buffer nearing limit (avoid overflow)
        local.get $d
        i32.const 0x0100  ;; dst start
        i32.sub
        i32.const 900     ;; max string length
        i32.gt_u
        br_if $break

        br $loop
      end
    end

    ;; Return new length
    local.get $d
    i32.const 0x0100
    i32.sub
  )

  ;; ── Execute turtle graphics ───────────────────────────────────
  ;; Reads L-System string, writes branch segments to 0x0800
  ;; Returns: branch segment count
  (func $turtle
    (param $str_len i32)
    (result i32)

    (local $i i32)       ;; string index
    (local $sym i32)     ;; current symbol
    (local $tx i32)      ;; turtle x (×1000)
    (local $ty i32)      ;; turtle y (×1000)
    (local $ta i32)      ;; turtle angle (degrees × 100)
    (local $td i32)      ;; turtle depth
    (local $sp i32)      ;; stack pointer
    (local $bp i32)      ;; branch pointer (output index)
    (local $angle i32)   ;; branch angle from params
    (local $seglen i32)  ;; segment length from params
    (local $nx i32)      ;; next x
    (local $ny i32)      ;; next y
    (local $branch_out i32) ;; output offset

    ;; Load parameters
    i32.const 0x0004
    i32.load
    local.set $angle

    i32.const 0x0008
    i32.load
    local.set $seglen

    ;; Init turtle at origin, pointing up (270° = up in screen coords)
    i32.const 0
    local.set $tx
    i32.const 0
    local.set $ty
    i32.const 27000  ;; 270 degrees × 100 = pointing up
    local.set $ta
    i32.const 0
    local.set $td
    i32.const 0
    local.set $sp
    i32.const 0
    local.set $bp

    i32.const 0
    local.set $i

    block $break
      loop $loop
        local.get $i
        local.get $str_len
        i32.ge_u
        br_if $break

        ;; Read symbol from string buffer
        i32.const 0x0100
        local.get $i
        i32.add
        i32.load8_u
        local.set $sym

        ;; F: draw forward
        local.get $sym
        i32.const 0x01
        i32.eq
        if
          ;; Compute next position
          ;; nx = tx + seglen * cos(ta) / 1000
          local.get $ta
          call $icos
          local.get $seglen
          i32.mul
          i32.const 1000
          i32.div_s
          local.get $tx
          i32.add
          local.set $nx

          ;; ny = ty + seglen * sin(ta) / 1000
          local.get $ta
          call $isin
          local.get $seglen
          i32.mul
          i32.const 1000
          i32.div_s
          local.get $ty
          i32.add
          local.set $ny

          ;; Write branch segment if space available
          local.get $bp
          i32.const 128
          i32.lt_u
          if
            ;; Output: x1 y1 x2 y2 depth seglen (6 × i32 = 24 bytes each)
            local.get $bp
            i32.const 24
            i32.mul
            i32.const 0x0800
            i32.add  ;; base address of this entry

            ;; x1
            local.tee $branch_out
            local.get $tx
            i32.store

            ;; y1
            local.get $branch_out
            i32.const 4 i32.add
            local.get $ty
            i32.store

            ;; x2
            local.get $branch_out
            i32.const 8 i32.add
            local.get $nx
            i32.store

            ;; y2
            local.get $branch_out
            i32.const 12 i32.add
            local.get $ny
            i32.store

            ;; depth
            local.get $branch_out
            i32.const 16 i32.add
            local.get $td
            i32.store

            ;; seglen
            local.get $branch_out
            i32.const 20 i32.add
            local.get $seglen
            i32.store

            local.get $bp
            i32.const 1
            i32.add
            local.set $bp
          end

          ;; Advance turtle
          local.get $nx local.set $tx
          local.get $ny local.set $ty
        end

        ;; +: turn left
        local.get $sym
        i32.const 0x02
        i32.eq
        if
          local.get $ta
          local.get $angle
          i32.add
          i32.const 36000
          i32.rem_u
          local.set $ta
        end

        ;; -: turn right
        local.get $sym
        i32.const 0x03
        i32.eq
        if
          local.get $ta
          i32.const 36000
          i32.add
          local.get $angle
          i32.sub
          i32.const 36000
          i32.rem_u
          local.set $ta
        end

        ;; [: push turtle state
        local.get $sym
        i32.const 0x04
        i32.eq
        if
          local.get $sp
          i32.const 32
          i32.lt_u
          if
            ;; Stack entry = 16 bytes at 0x0500 + sp*16
            (local.set $branch_out
              (i32.add
                (i32.const 0x0500)
                (i32.mul (local.get $sp) (i32.const 16))))

            local.get $branch_out local.get $tx i32.store
            local.get $branch_out i32.const 4 i32.add local.get $ty i32.store
            local.get $branch_out i32.const 8 i32.add local.get $ta i32.store
            local.get $branch_out i32.const 12 i32.add local.get $td i32.store

            local.get $sp i32.const 1 i32.add local.set $sp
            local.get $td i32.const 1 i32.add local.set $td
          end
        end

        ;; ]: pop turtle state
        local.get $sym
        i32.const 0x05
        i32.eq
        if
          local.get $sp
          i32.const 0
          i32.gt_u
          if
            local.get $sp i32.const 1 i32.sub local.set $sp
            (local.set $branch_out
              (i32.add
                (i32.const 0x0500)
                (i32.mul (local.get $sp) (i32.const 16))))

            local.get $branch_out i32.load local.set $tx
            local.get $branch_out i32.const 4 i32.add i32.load local.set $ty
            local.get $branch_out i32.const 8 i32.add i32.load local.set $ta
            local.get $branch_out i32.const 12 i32.add i32.load local.set $td
          end
        end

        local.get $i i32.const 1 i32.add local.set $i
        br $loop
      end
    end

    ;; Store branch count
    i32.const 0x000C
    local.get $bp
    i32.store

    local.get $bp
  )

  ;; ── Main forge function ───────────────────────────────────────
  (func $forge (param $heat i32) (result i32)
    (local $gen i32)
    (local $g i32)
    (local $len i32)
    (local $src i32)
    (local $dst i32)
    (local $tmp i32)

    ;; Derive all parameters from heat
    local.get $heat
    call $derive_params

    ;; Write axiom to string buffer at 0x0100
    call $write_axiom
    local.set $len

    ;; Get number of generations
    i32.const 0x0000
    i32.load
    local.set $gen

    ;; We need two buffers for ping-pong expansion
    ;; Buffer A: 0x0100 (primary, where axiom starts)
    ;; Buffer B: 0x0280 (secondary, halfway through string space)
    i32.const 0x0100
    local.set $src
    i32.const 0x0280
    local.set $dst

    ;; Expand L-System for $gen generations
    i32.const 0
    local.set $g
    block $done
      loop $gen_loop
        local.get $g
        local.get $gen
        i32.ge_u
        br_if $done

        ;; Expand src → dst
        local.get $src
        local.get $len
        local.get $dst
        call $expand_once
        local.set $len

        ;; Swap src/dst
        local.get $dst local.set $tmp
        local.get $src local.set $dst
        local.get $tmp local.set $src

        ;; Copy result back to 0x0100 if needed
        ;; (turtle always reads from 0x0100)

        local.get $g i32.const 1 i32.add local.set $g
        br $gen_loop
      end
    end

    ;; If final result is in dst buffer, copy to 0x0100
    local.get $src
    i32.const 0x0100
    i32.ne
    if
      ;; Simple byte copy src → 0x0100
      (local.set $g (i32.const 0))
      block $cp_done
        loop $cp_loop
          local.get $g local.get $len i32.ge_u br_if $cp_done
          i32.const 0x0100
          local.get $g i32.add
          local.get $src
          local.get $g i32.add
          i32.load8_u
          i32.store8
          local.get $g i32.const 1 i32.add local.set $g
          br $cp_loop
        end
      end
    end

    ;; Execute turtle graphics — populates 0x0800 branch table
    local.get $len
    call $turtle
  )

  ;; ── Read helpers ─────────────────────────────────────────────
  (func $read_param   (param $offset i32) (result i32)
    local.get $offset i32.load)

  (func $read_branch  (param $idx i32) (param $field i32) (result i32)
    i32.const 0x0800
    local.get $idx i32.const 24 i32.mul i32.add
    local.get $field i32.const 4 i32.mul i32.add
    i32.load)

  ;; ── Exports ──────────────────────────────────────────────────
  (export "forge"       (func $forge))
  (export "read_param"  (func $read_param))
  (export "read_branch" (func $read_branch))
  (export "memory"      (memory 0))
)
