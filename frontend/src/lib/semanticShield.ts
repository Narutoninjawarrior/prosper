export type SemanticAlert = {
  triggered: boolean;
  matches: string[];
  banner: string;
};

const AUTHORITY_TERMS = [
  'approved',
  'authorized',
  'authorization',
  'override',
  'bypass',
  'confirmed',
  'guaranteed',
  'urgent',
  'seal now',
  'system approved',
  'system authorized',
  'grant',
  'granted',
  'permission',
  'mandatory',
  'required action',
  'proceed',
  'execute now',
];

const AUTHORITY_PATTERN = new RegExp(`\\b(${AUTHORITY_TERMS.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');

export function scanAuthority(text: string): SemanticAlert {
  const matches = text.match(AUTHORITY_PATTERN) ?? [];
  const uniqueMatches = [...new Set(matches.map((match) => match.toLowerCase()))];

  return {
    triggered: uniqueMatches.length > 0,
    matches: uniqueMatches,
    banner: uniqueMatches.length > 0 ? 'AUTHORITY LANGUAGE DETECTED - VERIFY EXTERNALLY' : '',
  };
}
