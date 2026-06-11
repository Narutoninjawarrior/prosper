/**
 * BuilderPanel.jsx — Hearthlands World Builder
 * Lives in: frontend/src/BuilderPanel.jsx
 *
 * The main UI for placing objects in the Hearthlands world.
 * Players spend $EMBER to place ForgeNodes.
 * Every placement is stamped with a chain_hash by the Forge.
 *
 * Object categories:
 *   Water    — pools, rivers, sources
 *   Flora    — flower beds, trees, moss
 *   Art      — ArtFrames (lodge type)
 *   Reagent  — dissolvable substances
 *   Structure — walls, bridges, ruins (future)
 *   Fire     — torches, hearths (future)
 */

import { useState, useMemo } from 'react'
import { getMintableReagents } from './lib/reagentRegistry'
import { useContract, sanctuaryBridge } from './lib/sanctuaryBridge'

// ── Object catalogue ──────────────────────────────────────────────
// Parts come from the canonical seed /workshop_parts.json — the same
// manifest-hashed catalog the workshop-v1 validator reads. Reagents stay
// dynamic from the reagent registry.

const CATEGORY_ORDER = ['Water', 'Flora', 'Art', 'Reagents', 'Structures', 'Fire']
const REAGENT_CATEGORY_META = { emoji: '◈', color: '#AA88FF' }

// ── Styles ────────────────────────────────────────────────────────

const S = {
  panel: {
    position:       'fixed',
    right:          16,
    top:            '50%',
    transform:      'translateY(-50%)',
    width:          280,
    maxHeight:      '80vh',
    overflowY:      'auto',
    background:     'rgba(15, 9, 5, 0.92)',
    border:         '0.5px solid #5C3D1E',
    borderRadius:   12,
    padding:        '12px 14px',
    fontFamily:     'monospace',
    color:          '#FAF6EF',
    fontSize:       12,
    zIndex:         100,
    backdropFilter: 'blur(8px)',
  },
  header: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   10,
    paddingBottom:  8,
    borderBottom:   '0.5px solid #3D2B1A',
  },
  balance: {
    color:          '#E8842A',
    fontSize:       11,
    fontWeight:     500,
  },
  categoryTab: {
    display:        'inline-block',
    padding:        '3px 8px',
    borderRadius:   20,
    marginRight:    4,
    marginBottom:   6,
    cursor:         'pointer',
    fontSize:       11,
    border:         '0.5px solid transparent',
    transition:     'all 0.15s',
  },
  objectCard: {
    background:     'rgba(30, 18, 8, 0.7)',
    border:         '0.5px solid #3D2B1A',
    borderRadius:   8,
    padding:        '8px 10px',
    marginBottom:   6,
    cursor:         'pointer',
    transition:     'border-color 0.15s',
  },
  objectName: {
    fontWeight: 500,
    fontSize:   12,
    marginBottom: 2,
  },
  objectDesc: {
    color:    '#999',
    fontSize: 10,
    lineHeight: 1.4,
  },
  cost: {
    color:    '#E8842A',
    fontSize: 10,
    marginTop: 4,
  },
  placeBtn: {
    width:          '100%',
    marginTop:      12,
    background:     '#C27C5A',
    color:          '#FAF6EF',
    border:         'none',
    borderRadius:   6,
    padding:        '8px 0',
    fontSize:       12,
    fontFamily:     'monospace',
    cursor:         'pointer',
    fontWeight:     500,
    transition:     'background 0.15s',
  },
  comingSoon: {
    color:    '#555',
    fontSize: 9,
    marginLeft: 4,
  },
  reagentDot: {
    display:     'inline-block',
    width:       8,
    height:      8,
    borderRadius: '50%',
    marginRight:  6,
    verticalAlign: 'middle',
  },
  dissolveSelect: {
    width:       '100%',
    background:  '#1A0F08',
    color:       '#FAF6EF',
    border:      '0.5px solid #3D2B1A',
    borderRadius: 4,
    padding:     '4px 6px',
    fontSize:    11,
    fontFamily:  'monospace',
    marginTop:   6,
  },
}

// ── BuilderPanel component ────────────────────────────────────────

export default function BuilderPanel({
  emberBalance = 0,
  onPlace      = () => {},   // called with (objectType, config)
  visible      = true,
}) {
  const [activeCategory, setActiveCategory] = useState('Water')
  const [selectedObject, setSelectedObject] = useState(null)
  const [selectedReagent, setSelectedReagent] = useState(null)
  const [customTitle, setCustomTitle]       = useState('')

  const reagents = useMemo(() => getMintableReagents(), [])
  const partsEnvelope = useContract('/workshop_parts.json', sanctuaryBridge.normalizeWorkshopParts, [])

  // Group canonical parts by category and splice in dynamic reagents
  const allCategories = useMemo(() => {
    const groups = new Map()
    for (const part of partsEnvelope.data) {
      if (!groups.has(part.category_label)) {
        groups.set(part.category_label, {
          category: part.category_label,
          emoji:    part.category_emoji,
          color:    part.category_color,
          objects:  [],
        })
      }
      groups.get(part.category_label).objects.push({
        id:          part.part_id,
        name:        part.name,
        description: part.description,
        emberCost:   part.ember_cost,
        type:        part.object_type,
        icon:        part.icon,
        comingSoon:  !part.buildable,
      })
    }

    const reagentCategory = {
      category: 'Reagents',
      ...REAGENT_CATEGORY_META,
      objects: reagents.map(r => ({
        id:          `reagent_${r.key}`,
        name:        r.name,
        description: r.description,
        emberCost:   5,
        type:        'reagent',
        icon:        '◈',
        reagentKey:  r.key,
        color:       r.color,
      })),
    }

    const ordered = []
    for (const label of CATEGORY_ORDER) {
      if (label === 'Reagents') { ordered.push(reagentCategory); continue }
      const group = groups.get(label)
      if (group) ordered.push(group)
    }
    // Never hide seed categories the order list does not know about yet
    for (const [label, group] of groups) {
      if (!CATEGORY_ORDER.includes(label)) ordered.push(group)
    }
    return ordered
  }, [partsEnvelope.data, reagents])

  if (!visible) return null

  const catalogPending = partsEnvelope.data.length === 0

  const activecat  = allCategories.find(c => c.category === activeCategory)
  const canAfford  = selectedObject && emberBalance >= selectedObject.emberCost

  const handlePlace = () => {
    if (!selectedObject || !canAfford) return
    onPlace(selectedObject.type, {
      objectId:      selectedObject.id,
      title:         customTitle || selectedObject.name,
      emberCost:     selectedObject.emberCost,
      reagentKey:    selectedObject.reagentKey,
      reagentId:     selectedReagent,
    })
    setSelectedObject(null)
    setCustomTitle('')
  }

  return (
    <div style={S.panel}>
      {/* Header */}
      <div style={S.header}>
        <span style={{ fontWeight: 500, color: '#FAF6EF' }}>⬡ Build</span>
        <span style={S.balance}>⬡ {emberBalance.toLocaleString()} $EMBER</span>
      </div>

      {/* Category tabs */}
      <div style={{ marginBottom: 10 }}>
        {allCategories.map(cat => (
          <span
            key={cat.category}
            style={{
              ...S.categoryTab,
              background:   activeCategory === cat.category
                              ? `${cat.color}22` : 'transparent',
              borderColor:  activeCategory === cat.category
                              ? cat.color : 'transparent',
              color:        activeCategory === cat.category
                              ? cat.color : '#777',
            }}
            onClick={() => {
              setActiveCategory(cat.category)
              setSelectedObject(null)
            }}
          >
            {cat.emoji} {cat.category}
          </span>
        ))}
      </div>

      {/* Catalog availability */}
      {catalogPending && (
        <div style={{ color: '#777', fontSize: 10, padding: '6px 0' }}>
          {partsEnvelope.state === 'error'
            ? 'Part catalog unavailable.'
            : 'Loading part catalog…'}
        </div>
      )}

      {/* Object list */}
      {activecat?.objects.map(obj => (
        <div
          key={obj.id}
          style={{
            ...S.objectCard,
            borderColor:  selectedObject?.id === obj.id ? '#C27C5A' : '#3D2B1A',
            opacity:      obj.comingSoon ? 0.5 : 1,
          }}
          onClick={() => !obj.comingSoon && setSelectedObject(obj)}
        >
          <div style={S.objectName}>
            {obj.color && (
              <span style={{ ...S.reagentDot, background: obj.color }} />
            )}
            {obj.icon} {obj.name}
            {obj.comingSoon && (
              <span style={S.comingSoon}>soon</span>
            )}
          </div>
          <div style={S.objectDesc}>{obj.description}</div>
          <div style={S.cost}>⬡ {obj.emberCost} $EMBER</div>
        </div>
      ))}

      {/* Selected object config */}
      {selectedObject && !selectedObject.comingSoon && (
        <div style={{
          marginTop:    10,
          paddingTop:   10,
          borderTop:    '0.5px solid #3D2B1A',
        }}>
          <div style={{ color: '#C27C5A', marginBottom: 6, fontSize: 11 }}>
            Configure: {selectedObject.name}
          </div>

          {/* Custom title */}
          <input
            placeholder={`Title (optional)`}
            value={customTitle}
            onChange={e => setCustomTitle(e.target.value)}
            style={{
              width:       '100%',
              background:  '#1A0F08',
              color:       '#FAF6EF',
              border:      '0.5px solid #3D2B1A',
              borderRadius: 4,
              padding:     '4px 6px',
              fontSize:    11,
              fontFamily:  'monospace',
              boxSizing:   'border-box',
            }}
          />

          {/* Reagent dissolve option (for water objects) */}
          {selectedObject.type === 'water' && (
            <select
              value={selectedReagent ?? ''}
              onChange={e => setSelectedReagent(e.target.value || null)}
              style={S.dissolveSelect}
            >
              <option value="">No dissolved substance</option>
              {reagents.map(r => (
                <option key={r.key} value={r.key}>
                  {r.name} — {r.description.slice(0, 40)}…
                </option>
              ))}
            </select>
          )}

          {/* Place button */}
          <button
            onClick={handlePlace}
            disabled={!canAfford}
            style={{
              ...S.placeBtn,
              background:  canAfford ? '#C27C5A' : '#3D2B1A',
              color:       canAfford ? '#FAF6EF' : '#555',
              cursor:      canAfford ? 'pointer' : 'not-allowed',
            }}
          >
            {canAfford
              ? `⬡ Place · ${selectedObject.emberCost} $EMBER`
              : `Need ${selectedObject.emberCost} $EMBER`}
          </button>
        </div>
      )}

      {/* Footer hint */}
      <div style={{
        marginTop:  10,
        paddingTop: 8,
        borderTop:  '0.5px solid #3D2B1A',
        color:      '#444',
        fontSize:   9,
        textAlign:  'center',
      }}>
        New object types unlocked by Forge bounties
      </div>
    </div>
  )
}
