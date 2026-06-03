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
import { getAllReagents, getMintableReagents } from './lib/reagentRegistry'

// ── Object catalogue ──────────────────────────────────────────────

const OBJECT_TYPES = [
  {
    category: 'Water',
    emoji:    '〜',
    color:    '#4A90D9',
    objects:  [
      {
        id:          'water_pool',
        name:        'Water Pool',
        description: 'A still pool of water. Reacts to reagents, freezes at low heat.',
        emberCost:   15,
        type:        'water',
        icon:        '〜',
      },
      {
        id:          'water_stream',
        name:        'Stream',
        description: 'Flowing water with high flow speed. Carries dissolved substances further.',
        emberCost:   25,
        type:        'water',
        icon:        '≈',
      },
      {
        id:          'water_frozen',
        name:        'Frozen Lake',
        description: 'Starts fully frozen. Melts near the Hearth. Beautiful moonstone ice.',
        emberCost:   30,
        type:        'water',
        icon:        '❄',
      },
    ],
  },
  {
    category: 'Flora',
    emoji:    '❀',
    color:    '#7A9E7E',
    objects:  [
      {
        id:          'flora_flower',
        name:        'Flower Bed',
        description: 'L-System procedural plant. Releases pollen into nearby water. Grows with heat.',
        emberCost:   10,
        type:        'flora',
        icon:        '❀',
      },
      {
        id:          'flora_moss',
        name:        'Moss Patch',
        description: 'Low-growing ground cover. Thrives in ash-water. Absorbs soil runoff.',
        emberCost:   5,
        type:        'flora',
        icon:        '⁘',
        comingSoon:  true,
      },
      {
        id:          'flora_tree',
        name:        'Ancient Tree',
        description: 'Large L-System tree. Takes 6 growth stages. Drops chain_dust into water.',
        emberCost:   50,
        type:        'flora',
        icon:        '🌳',
        comingSoon:  true,
      },
    ],
  },
  {
    category: 'Art',
    emoji:    '⬡',
    color:    '#C27C5A',
    objects:  [
      {
        id:          'art_frame',
        name:        'Art Frame',
        description: 'Generative art seeded by Forge chain_hash. Mintable as Solana NFT.',
        emberCost:   50,
        type:        'lodge',
        icon:        '⬡',
      },
      {
        id:          'art_mural',
        name:        'Mural Wall',
        description: 'Large-format art piece. 3×5 frame grid. Takes 200 $EMBER.',
        emberCost:   200,
        type:        'lodge',
        icon:        '▣',
        comingSoon:  true,
      },
    ],
  },
  {
    category: 'Reagents',
    emoji:    '◈',
    color:    '#AA88FF',
    objects:  [],  // dynamically filled from registry
    dynamic:  true,
  },
  {
    category: 'Structures',
    emoji:    '⬛',
    color:    '#888888',
    objects:  [
      {
        id:          'stone_wall',
        name:        'Stone Wall',
        description: 'Blocks water flow. Creates channels and pools.',
        emberCost:   8,
        type:        'stone',
        icon:        '⬛',
        comingSoon:  true,
      },
      {
        id:          'bridge',
        name:        'Bridge',
        description: 'Path over water. Players can walk between plots.',
        emberCost:   20,
        type:        'bridge',
        icon:        '🌉',
        comingSoon:  true,
      },
      {
        id:          'ruins',
        name:        'Ancient Ruins',
        description: 'Leaks ash into nearby water. Creates dark water chemistry.',
        emberCost:   35,
        type:        'ruins',
        icon:        '🏛',
        comingSoon:  true,
      },
      {
        id:          'lightning_rod',
        name:        'Lightning Rod',
        description: 'Rare. During storm events, produces lightning charge reagent.',
        emberCost:   100,
        type:        'lightning_rod',
        icon:        '⚡',
        comingSoon:  true,
      },
    ],
  },
  {
    category: 'Fire',
    emoji:    '🔥',
    color:    '#E8842A',
    objects:  [
      {
        id:          'torch',
        name:        'Torch',
        description: 'Emits heat. Melts nearby ice. Dries water over time.',
        emberCost:   12,
        type:        'fire',
        icon:        '🔥',
        comingSoon:  true,
      },
      {
        id:          'forge_fire',
        name:        'Forge Fire',
        description: 'High-heat source. Produces ash as byproduct. Connects to Bellows.',
        emberCost:   40,
        type:        'fire',
        icon:        '🌋',
        comingSoon:  true,
      },
    ],
  },
]

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

  // Build dynamic reagent objects
  const allCategories = useMemo(() => {
    return OBJECT_TYPES.map(cat => {
      if (!cat.dynamic) return cat
      return {
        ...cat,
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
    })
  }, [reagents])

  if (!visible) return null

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
