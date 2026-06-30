import re

def replace_function(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We'll replace the function using a regex that matches from def load_world_state() -> dict: up to the next line that starts with 'def ' at column 0 (ignoring leading spaces)
    # Use re.MULTILINE
    pattern = r'(def load_world_state\(\) -> dict:\n.*?)\n(?=def |\Z)'
    # We'll use re.DOTALL to match across lines
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        print('Function not found')
        return
    old_func = match.group(1)
    new_func = '''def load_world_state() -> dict:
    if not os.path.exists(STATE_FILE):
        return default_world_state()
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        # Convert ember_balance to Decimal for precision
        if "ember_balance" in raw:
            raw["ember_balance"] = Decimal(str(raw["ember_balance"]))
        else:
            raw["ember_balance"] = Decimal('0')
    except (OSError, json.JSONDecodeError) as exc:
        log(f"Could not load {STATE_FILE}: {exc} �? starting fresh.")
        return default_world_state()

    base = default_world_state()
    merged = {**base, **{k: v for k, v in raw.items() if v is not None}}
    # Ensure Decimal precision for balances
    if "ember_balance" in merged:
        merged["ember_balance"] = Decimal(str(merged["ember_balance"]))
    else:
        merged["ember_balance"] = Decimal('0')
    if "treasury" in merged:
        merged["treasury"] = Decimal(str(merged["treasury"]))
    else:
        merged["treasury"] = TOTAL_SUPPLY - merged["ember_balance"]
    merged["biosphere_nodes"] = normalize_biosphere_nodes(raw.get("biosphere_nodes"))
    if not isinstance(merged.get("nodes"), list):
        merged["nodes"] = []
    merged["mining_active"] = bool(raw.get("mining_active", True))
    return merged'''
    # Replace the matched function with new_func
    new_content = content[:match.start()] + new_func + content[match.end():]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Replaced load_world_state function')

if __name__ == '__main__':
    replace_function(r'D:\Hearth\prosper2\bellows_brain.py')