import re
import sys

def replace_load_world_state(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern to find load_world_state function
    # We'll replace from def load_world_state() -> dict: up to the line before def frontend_payload_from_world
    # Using regex with DOTALL to match across lines
    pattern = r'(def load_world_state\(\) -> dict:\n\s+if not os\.path\.exists\(STATE_FILE\):\n\s+return default_world_state\(\)\n\s+try:\n\s+with open\(STATE_FILE, "r", encoding="utf-8"\) as f:\n\s+raw = json\.load\(f\)\n\s+except \(OSError, json\.JSONDecodeError\) as exc:\n\s+log\(f"Could not load {STATE_FILE}: {exc} �? starting fresh\."\)\n\s+return default_world_state\(\)\n\n\s+base = default_world_state\(\)\n\s+merged = \{\*\*base, \*\*\{k: v for k, v in raw\.items\(\) if v is not None\}\}\n\s+merged\["biosphere_nodes"\] = normalize_biosphere_nodes\(raw\.get\("biosphere_nodes"\)\)\n\s+if not isinstance\(merged\.get\("nodes"\), list\):\n\s+merged\["nodes"\] = \[\]\n\s+merged\["mining_active"\] = bool\(raw\.get\("mining_active", True\)\)\n\s+return merged\n)'
    # Since the exact whitespace may vary, we'll do a more flexible replacement: replace the try-except block and add treasury logic after merged.
    # Instead, we'll do two-step replacement.

    # First, replace the try-except block to convert ember_balance to Decimal
    try_pattern = r'(      try:\n          with open\(STATE_FILE, "r", encoding="utf-8"\) as f:\n              raw = json\.load\(f\)\n      except \(OSError, json\.JSONDecodeError\) as exc:\n          log\(f"Could not load {STATE_FILE}: {exc} �? starting fresh\."\)\n          return default_world_state\(\)\n)'
    try_replacement = '''      try:
          with open(STATE_FILE, "r", encoding="utf-8") as f:
              raw = json.load(f)
          # Convert ember_balance to Decimal for precision
          if "ember_balance" in raw:
              raw["ember_balance"] = Decimal(str(raw["ember_balance"]))
          else:
              raw["ember_balance"] = Decimal('0')
      except (OSError, json.JSONDecodeError) as exc:
          log(f"Could not load {STATE_FILE}: {exc} �? starting fresh.")
          return default_world_state()'''

    content = re.sub(try_pattern, try_replacement, content)

    # Now we need to ensure treasury exists and is Decimal.
    # We'll insert after the merged assignment line and before the biosphere_nodes line.
    # Find the line: merged = {**base, **{k: v for k, v in raw.items() if v is not None}}
    # We'll insert after that line.
    merged_pattern = r'(      merged = \{\*\*base, \*\*\{k: v for k, v in raw\.items\(\) if v is not None\}\}\n)'
    merged_replacement = r'\1      # Ensure Decimal precision for balances\n      if "ember_balance" in merged:\n          merged["ember_balance"] = Decimal(str(merged["ember_balance"]))\n      else:\n          merged["ember_balance"] = Decimal(\'0\')\n      if "treasury" in merged:\n          merged["treasury"] = Decimal(str(merged["treasury"]))\n      else:\n          merged["treasury"] = TOTAL_SUPPLY - merged["ember_balance"]\n'

    content = re.sub(merged_pattern, merged_replacement, content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    replace_load_world_state(r'D:\Hearth\prosper2\bellows_brain.py')
    print('Modified bellows_brain.py')