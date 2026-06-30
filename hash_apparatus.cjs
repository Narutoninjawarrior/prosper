const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function stableStringify(value) {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return 'null';
}

const p = path.join(__dirname, 'frontend', 'public', 'apparatus_registry.json');
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

delete data.manifest_hash;

const str = stableStringify(data.records);
const hash = crypto.createHash('sha256').update(str).digest('hex');

data.manifest_hash = hash;
fs.writeFileSync(p, JSON.stringify(data, null, 2));

console.log('Hashed:', hash);
