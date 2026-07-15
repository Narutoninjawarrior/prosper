import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Layers, Cpu, Shield, ArrowRight, Download, Maximize2, RefreshCw, Grid } from 'lucide-react';

interface GalleryPiece {
  id: string;
  title: string;
  subtitle: string;
  category: 'Art Piece' | 'Technical CAD' | 'Kinematics Blueprint' | 'Structural Diagram';
  imageUrl: string;
  badgeColor: string;
  description: string;
  specs: {
    resolution: string;
    engine: string;
    substrate: string;
    keyFeature: string;
  };
  details: string[];
}

const GALLERY_ITEMS: GalleryPiece[] = [
  {
    id: 'tail-wheel-lobster',
    title: 'Tail-Tip Hub Wheel & Tricycle Stance Assembly',
    subtitle: 'High-Speed Rolling Geometry & Upright Rearing Anchor',
    category: 'Technical CAD',
    imageUrl: '/gallery/tail_wheel_lobster.png',
    badgeColor: '#E8842A',
    description: 'Engineering cutaway highlighting the telson tail-fan hub drive alongside anterior leg wheels. Demonstrates the ultra-efficient 3-point tricycle rolling stance and vertical stabilizer lock.',
    specs: {
      resolution: '8K Isometric Blueprint',
      engine: 'Continuum Kinematics Core v2.4',
      substrate: 'Brushless DC Hub Motor & E-Disc Brake',
      keyFeature: '80% Power Reduction via Rolling Transit'
    },
    details: [
      'Integrated brushless direct-drive hub motor located at the tip of the telson tail-fan section.',
      'Enables high-speed tricycle rolling stance when curled downward onto factory or tarmac floors.',
      'Electromagnetic disc brake locks tail wheel to anchor vertical upright rearing transformation.'
    ]
  },
  {
    id: 'hybrid-wheeled-lobster',
    title: 'Hybrid Wheeled-Legged Continuum Lobster',
    subtitle: 'Multi-Stance Transformation & Swappable End-Effectors',
    category: 'Kinematics Blueprint',
    imageUrl: '/gallery/hybrid_wheeled_lobster.png',
    badgeColor: '#10B981',
    description: 'Detailed CAD schematic showcasing dual locomotion modes: high-speed rolling transit and 2.5× vertical reach rearing. Includes exploded cutaways of passive microspine, magnetic, and vacuum end-effectors.',
    specs: {
      resolution: '8K Multi-Stance CAD Cutaway',
      engine: 'OSE Linter & Actuator Engine',
      substrate: 'Titanium-Carbon Spine & Tendon Linkages',
      keyFeature: '2.5× Vertical Reach & Swappable Tool Flange'
    },
    details: [
      'Passive microspine array end-effectors feature spring-loaded steel needles for rough rock and concrete.',
      'Switchable electro-permanent magnetic (EPM) footpads clamp onto steel tanks with zero continuous power.',
      'Miniature scroll pumps drive multi-zone silicone vacuum cups for climbing smooth composite panels.'
    ]
  },
  {
    id: 'tendon-driven-lobster',
    title: 'Tendon-Driven Capstan Actuator System',
    subtitle: 'Proximal Motor Placement & Dyneema Synthetic Tendon Routing',
    category: 'Technical CAD',
    imageUrl: '/gallery/tendon_driven_lobster.png',
    badgeColor: '#6366F1',
    description: 'Isometric cutaway revealing high power-density brushless motors mounted at the proximal base coupled to zero-backlash capstan drums, routing Dyneema synthetic tension cables through Bowden sheaths.',
    specs: {
      resolution: '8K Engineering Schematic',
      engine: 'Zero-Backlash Transmission Architecture',
      substrate: 'UHMWPE Dyneema & High-D/d Capstan Drums',
      keyFeature: 'Minimal Limb Inertia & Closed-Loop Hall Sensing'
    },
    details: [
      'Proximal motor placement keeps heavy brushless actuators inside the core torso, drastically reducing limb inertia.',
      'Antagonistic Dyneema tendon cables route inside Bowden cable housings across compound multi-axis joints.',
      'Integrated 3D Hall-effect encoders and screw-adjusted spring tensioners eliminate mechanical hysteresis and creep.'
    ]
  },
  {
    id: 'modular-lobster',
    title: 'Layer-by-Layer Modular Exoskeleton Strata',
    subtitle: 'Exploded Structural Diagram of Terracotta & Sage Armor Plating',
    category: 'Structural Diagram',
    imageUrl: '/gallery/modular_lobster.png',
    badgeColor: '#EC4899',
    description: 'Exploded multi-layer technical drafting illustrating the three primary strata of the bionic lobster: protective outer armored carapace, internal tendon actuation mechanics, and core computing chassis.',
    specs: {
      resolution: '8K Exploded Stratigraphy',
      engine: 'Modular Morphology Assembly',
      substrate: 'Terracotta Composite & Matte Sage Plating',
      keyFeature: 'Quick-Release Field Serviceability'
    },
    details: [
      'Outer Carapace Layer: Impact-resistant terracotta and sage modular shell segments with quick-latch fasteners.',
      'Kinematic Actuation Layer: Hydraulic linkages, mechanical joint stops, and antagonistic tendon routing pathways.',
      'Core Chassis Layer: Central computing node modules, sensor wiring harnesses, and structural carbon-fiber spine.'
    ]
  },
  {
    id: 'sovereign-sanctuary',
    title: 'The Sovereign Sanctuary of the Bellows Engine',
    subtitle: 'Cyber-Renaissance & Solarpunk Masterpiece (1-of-1 Digital Artifact)',
    category: 'Art Piece',
    imageUrl: '/gallery/sovereign_sanctuary.png',
    badgeColor: '#D4A853',
    description: 'A monumental observatory where ancient weathered terracotta and sage stone columns intertwine with glowing crystalline data conduits and polished brass clockwork rings. In the center floats the pulsating Bellows astrolabe over an obsidian reflection pool.',
    specs: {
      resolution: '8K UHD (7680 × 4320 equivalent)',
      engine: 'Solis / Bellows Skrying Renderer',
      substrate: 'Digital Chiaroscuro & Volumetric Light',
      keyFeature: 'Merkle Proof Holograms & Astronomical Lattices'
    },
    details: [
      'Blends warm terracotta and matte sage architectural aesthetics with crystalline local data conduits.',
      'Symbolizes the sovereign, zero-backend time engine running in perpetual equilibrium.',
      'Designed as a collectible 1-of-1 digital artifact capturing the soul of the Hearthlands.'
    ]
  },
  {
    id: 'hearthlands-farm',
    title: 'Hearthlands Biodynamic Terraced Farm & Sanctuary',
    subtitle: 'Ecological Agriculture & Autonomous Nursery Operations',
    category: 'Art Piece',
    imageUrl: '/gallery/hearthlands_farm.png',
    badgeColor: '#10B981',
    description: 'Vibrant Solarpunk agricultural vista showcasing terraced sage-green hills, solar irrigation channels, and autonomous nursery domes integrated seamlessly into natural terracotta cliffs.',
    specs: {
      resolution: '8K UHD Ecological Panorama',
      engine: 'Agrarian Biosystem Renderer',
      substrate: 'Terraced Soil & Solar Water Lattices',
      keyFeature: 'Closed-Loop Biodynamic Fertility Core'
    },
    details: [
      'Depicts the physical edge-compute and nursery deployment grounds of the sovereign Hearthlands.',
      'Features integrated waterwheel power hubs and terraced permaculture zones.',
      'Serves as the visual anchor for localized, zero-backend nursery stewardship and plant passporting.'
    ]
  },
  {
    id: 'earthship-greenhouse',
    title: 'Subterranean Earthship Greenhouse & Aquaponic Loop',
    subtitle: 'Passive Solar Thermal Mass & Integrated Fish-Plant Symbiosis',
    category: 'Technical CAD',
    imageUrl: '/gallery/earthship_greenhouse.png',
    badgeColor: '#E8842A',
    description: 'Cutaway architectural blueprint illustrating passive solar earth-bermed thermal mass walls, multi-tier aquaponic fish tanks, and automated vertical crop growing bays.',
    specs: {
      resolution: '8K Architectural Cutaway',
      engine: 'Passive Thermal & Symbiotic Engine',
      substrate: 'Ram-Earth Tires & Recycled Glass Prism Walls',
      keyFeature: 'Zero External Heating Required at Sub-Zero Ambient'
    },
    details: [
      'Earth-bermed rear wall stores solar thermal energy during peak daylight for radiative nighttime release.',
      'Deep-water culture (DWC) aquaponic tanks circulate nutrient-rich effluent directly to suspended root trays.',
      'Embedded sensor nodes monitor dissolved oxygen, pH balance, and photosynthetic photon flux density (PPFD).'
    ]
  },
  {
    id: 'biosystem-canvas',
    title: 'Closed-Loop Aquascape & Ecological Biosystem Matrix',
    subtitle: 'Real-Time Nutrient Flow & Aquatic Micro-Climate Simulation',
    category: 'Kinematics Blueprint',
    imageUrl: '/gallery/biosystem_canvas.png',
    badgeColor: '#6366F1',
    description: 'Dynamic system diagram mapping real-time nutrient cycling, biological filtration layers, and symbiotic exchanges between aquatic fauna and high-density riparian flora.',
    specs: {
      resolution: '8K Ecological Flow Matrix',
      engine: 'Canvas Trend & Biosystem Simulation Engine',
      substrate: 'Bio-Ceramic Media & Mycelial Filtration Beds',
      keyFeature: 'Real-Time Nitrogen Cycle Balance Verification'
    },
    details: [
      'Illustrates multi-stage bio-filtration using porous ceramic media and beneficial nitrifying bacteria colonies.',
      'Tracks dissolved nutrient dynamics, carbon sequestration rates, and aquatic turbidity.',
      'Directly links physical water quality metrics with digital ledger verification timestamps.'
    ]
  },
  {
    id: 'solarpunk-codex',
    title: 'The Illuminated Solarpunk Medieval Codex of the Hearth',
    subtitle: 'Ancient Wisdom Encapsulated in Crystalline Data Tomes',
    category: 'Art Piece',
    imageUrl: '/gallery/solarpunk_codex.png',
    badgeColor: '#D4A853',
    description: 'An exquisite cyber-medieval illuminated manuscript open on a carved wooden lectern, featuring intricate gold leaf geometry, botanical illustrations, and glowing holographic data runes.',
    specs: {
      resolution: '8K Digital Illuminations',
      engine: 'Solis Codex & Grimoire Engine',
      substrate: 'Vellum Archival Canvas & Gold Leaf Holograms',
      keyFeature: 'Immutable Cryptographic Doctrine Preservation'
    },
    details: [
      'Represents the sovereign doctrine and long-term memory grimoire (`L04_HEARTH_PROTOCOLS`).',
      'Merges traditional monastic calligraphy with glowing holographic Merkle tree diagrams.',
      'A centerpiece artifact symbolizing the preservation of local knowledge across generations.'
    ]
  },
  {
    id: 'palace-explorer',
    title: 'The Solarpunk Palace Observatory & Skrying Reflection Pool',
    subtitle: 'Sovereign Architectural Nexus of the Fellowship',
    category: 'Art Piece',
    imageUrl: '/gallery/palace_explorer.png',
    badgeColor: '#EC4899',
    description: 'A breathtaking wide-angle view of the sovereign Solarpunk Palace, featuring towering arched halls of terracotta and brass surrounding a tranquil obsidian skrying pool fed by geothermal cascades.',
    specs: {
      resolution: '8K UHD Architectural Masterwork',
      engine: 'Sanctuary World-Builder Core',
      substrate: 'Polished Terracotta & Obsidian Water Mirror',
      keyFeature: 'Ambient Acoustic & Geothermal Equilibrium'
    },
    details: [
      'The central gathering hall and coordination nexus for all sovereign vessels within the Hearthlands.',
      'Geothermal cascades maintain constant climate control while powering low-rpm brass turbine generators.',
      'The obsidian reflection pool acts as a physical metaphor for the Skrying Mirror shared memory layer.'
    ]
  },
  {
    id: 'solcot-genesis',
    title: 'SOLCOT Genesis Crest & Emblem of Patronage',
    subtitle: 'The Sovereign Fellowship Guild Insignia',
    category: 'Art Piece',
    imageUrl: '/gallery/solcot_genesis.png',
    badgeColor: '#D4A853',
    description: 'The ceremonial emblem of SOLCOT patronage, featuring embossed gold filigree, solar geometric rays, and interlocking terracotta rings symbolizing mutual aid and economic sovereignty.',
    specs: {
      resolution: '8K Vector Emblem & Digital Crest',
      engine: 'Patronage Treasury Engine',
      substrate: 'Embossed Gold & Matte Terracotta Seal',
      keyFeature: 'Cryptographic Guild Membership Proof'
    },
    details: [
      'Serves as the visual seal and genesis badge for patrons contributing to the sovereign treasury.',
      'Interlocking rings represent the unbreakable balance between ecological regeneration and agentic coordination.',
      'Auditable proof of direct contribution to local-first infrastructure deployment.'
    ]
  },
  {
    id: 'solcot-shop',
    title: 'SOLCOT Patronage & Exchange Gateway',
    subtitle: 'Sovereign Economic Sanctuary & Artifact Depot',
    category: 'Structural Diagram',
    imageUrl: '/gallery/solcot_shop.png',
    badgeColor: '#E8842A',
    description: 'Warm, inviting interior illustration of the SOLCOT depot, where handcrafted physical artifacts, botanical tinctures, and robotic hardware kits are displayed alongside digital ledger verification terminals.',
    specs: {
      resolution: '8K Sanctuary Interior View',
      engine: 'Zero-Backend Exchange Protocol',
      substrate: 'Hand-Carved Oak & Brass Terminal Interfaces',
      keyFeature: 'Direct Peer-to-Peer Physical & Digital Fulfillment'
    },
    details: [
      'Depicts the physical fulfillment center where sovereign hardware and herbal goods meet digital patronage.',
      'Integrates QR-verified plant passports and hardware telemetry receipts right on the shelves.',
      'Bridges high-entropy community interaction with precise, auditable local trade.'
    ]
  },
  {
    id: 'cottage-commons-hearth',
    title: 'Cottage Commons & The Central Village Hearth Vision',
    subtitle: 'Warm Botanical Sanctuary & Shared Fellowship Gathering Core',
    category: 'Art Piece',
    imageUrl: '/gallery/cottage_commons_hearth.png',
    badgeColor: '#10B981',
    description: 'An enchanting Solarpunk cottage interior surrounded by lush hanging botanical gardens, warm candlelit hearth fire, and hand-hewn oak table where village fellowship coordinates.',
    specs: {
      resolution: '8K UHD Botanical Sanctuary Art',
      engine: 'Cottage Commons & Hearth Core',
      substrate: 'Terracotta Pots, Sage Stone & Oak',
      keyFeature: 'Warm Minimalism & Living Plant Symbiosis'
    },
    details: [
      'Embodies the pure aesthetic soul of the Cottage Commons and central village hearth.',
      'Surrounded by thriving indoor medicinal herbs, trailing ivy, and terracotta planting vessels.',
      'Serves as the emotional anchor and coordination room for localized village fellowship.'
    ]
  },
  {
    id: 'utopia-commons',
    title: 'Utopian Village Convergence: The Living Commons & Hearth',
    subtitle: 'Interconnected Solarpunk Community Architecture',
    category: 'Art Piece',
    imageUrl: '/gallery/utopia_commons.png',
    badgeColor: '#D4A853',
    description: 'A sweeping panorama of an advanced Solarpunk village commons where glowing terracotta towers, terraced botanical gardens, and crystal-clear water channels converge around the central hearth.',
    specs: {
      resolution: '8K UHD Village Convergence View',
      engine: 'Sovereign Village World-Builder',
      substrate: 'Terraced Biophilic Architecture',
      keyFeature: 'Decentralized Community Energy & Water Grid'
    },
    details: [
      'Illustrates the harmony between high-density village coordination and bountiful botanical food forests.',
      'Waterwheel networks feed gravity-assisted terraced crop fields right outside residential balconies.',
      'Represents the ultimate expression of Prosper as an active, living human-robotics commons.'
    ]
  },
  {
    id: 'utopia-prosperity',
    title: 'Prosper Convergence: Solarpunk Utopia & Botanical Terraces',
    subtitle: 'Abundant Agrarian Biosystem & Solar Canopy Hubs',
    category: 'Art Piece',
    imageUrl: '/gallery/utopia_prosperity.png',
    badgeColor: '#10B981',
    description: 'Vibrant golden hour illustration depicting abundant terraced agriculture, translucent geodesic greenhouse canopies, and automated nutrient circulation loops flowing through the village center.',
    specs: {
      resolution: '8K UHD Solarpunk Utopia Panorama',
      engine: 'Prosper Economic & Ecological Engine',
      substrate: 'Geodesic Glass & Organic Soil Lattices',
      keyFeature: 'Perpetual Local Food Security & Energy Autonomy'
    },
    details: [
      'Visualizes the physical realization of the Prosper doctrine: where ecology meets high-efficiency robotics.',
      'Terraced crop rings act as natural thermal buffers while generating continuous organic yields.',
      'Designed to inspire field stewards building self-sufficient local sanctuaries.'
    ]
  },
  {
    id: 'village-header',
    title: 'Phoenix Village Revival Header & Solarpunk Gardens',
    subtitle: 'The Living Sanctuary Canopy & Sunrise Horizon',
    category: 'Art Piece',
    imageUrl: '/gallery/village_header.png',
    badgeColor: '#E8842A',
    description: 'A breathtaking wide banner composition featuring warm sunrise light washing across terraced sage gardens, ancient terracotta archways, and the glowing hearth beacon.',
    specs: {
      resolution: '8K Wide Horizon Masterpiece',
      engine: 'Phoenix Village Revival Renderer',
      substrate: 'Morning Golden Light & Matte Sage Foliage',
      keyFeature: 'Biophilic Architectural Harmony'
    },
    details: [
      'Created as the canonical visual header for village regeneration and sanctuary stewardship.',
      'Highlights the transition from rigid industrial structures to soft, plant-integrated biomorphic forms.',
      'Celebrates the rebirth of local autonomy centered around the community hearth.'
    ]
  },
  {
    id: 'village-avatar',
    title: 'Phoenix Village & Botanical Sanctuary Avatar',
    subtitle: 'The Spirit of the Hearthlands Emblem',
    category: 'Art Piece',
    imageUrl: '/gallery/village_avatar.png',
    badgeColor: '#EC4899',
    description: 'Intimate, soulful portrait profile of the village sanctuary spirit surrounded by blooming sage flowers, golden solar geometry, and terracotta clay vessels.',
    specs: {
      resolution: '8K Botanical Avatar & Seal',
      engine: 'Sanctuary Persona Core',
      substrate: 'Digital Gouache & Gold Leaf Filigree',
      keyFeature: 'Embodiment of Sovereign Ecological Stewardship'
    },
    details: [
      'Serves as the symbolic face and avatar for village stewards operating inside the Hall of Honor.',
      'Weaves together botanical motifs with subtle clockwork and solar symbols.',
      'A warm, welcoming presence designed to guide agents and humans alike.'
    ]
  },
  {
    id: 'village-crest',
    title: 'Phoenix Village Crest & Botanical Hearth Seal',
    subtitle: 'The Immutable Signet of the Living Commons',
    category: 'Art Piece',
    imageUrl: '/gallery/village_crest.png',
    badgeColor: '#D4A853',
    description: 'The formal ceremonial signet crest of Phoenix Village, featuring interlocking plant tendrils, a radiant hearth flame, and sacred geometric rings embossed on terracotta.',
    specs: {
      resolution: '8K Vector Signet & Botanical Seal',
      engine: 'Village Governance & Registry Core',
      substrate: 'Embossed Terracotta & Gold Leaf',
      keyFeature: 'Cryptographic Guild Sign-off & Provenance Verification'
    },
    details: [
      'Used as the canonical physical and digital seal across village passports and operational contracts.',
      'Interlocking botanical tendrils symbolize mutual resilience and community interdependence.',
      'Auditable proof of adherence to the Rules of the Hearth and warm minimalist aesthetic.'
    ]
  }
];

export default function SovereignGallery() {
  const [selectedId, setSelectedId] = useState<string>(GALLERY_ITEMS[0].id);
  const [viewMode, setViewMode] = useState<'sanctuary' | 'flow' | 'matrix'>('sanctuary');

  const selectedItem = GALLERY_ITEMS.find((item) => item.id === selectedId) || GALLERY_ITEMS[0];

  return (
    <div className="min-h-screen w-full bg-[#050806] text-[#FAF6EF] font-mono select-none overflow-x-hidden">
      {/* Top Banner / Controls */}
      <div className="sticky top-0 z-50 border-b border-[#D4A853]/20 bg-[#050806]/90 backdrop-blur-xl px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D4A853]/15 border border-[#D4A853]/40 text-[#D4A853] shadow-[0_0_15px_rgba(212,168,83,0.2)]">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-[0.2em] uppercase text-[#FAF6EF] flex items-center gap-2">
              Sovereign Observatory Gallery
              <span className="rounded bg-[#D4A853]/20 px-2 py-0.5 text-[10px] font-semibold text-[#D4A853] tracking-widest border border-[#D4A853]/40">
                1-OF-1 COLLECTION
              </span>
            </h1>
            <p className="text-xs text-[#8E7E6B] tracking-wider font-sans">
              Dynamic Art & Technical Specifications Engine • Local-First Provenance
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 bg-[#0C120E] p-1 rounded-lg border border-[#D4A853]/20">
          <button
            onClick={() => setViewMode('sanctuary')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold tracking-wider transition-all ${
              viewMode === 'sanctuary'
                ? 'bg-[#D4A853] text-[#050806] shadow-[0_0_12px_rgba(212,168,83,0.4)] font-bold'
                : 'text-[#8E7E6B] hover:text-[#FAF6EF]'
            }`}
          >
            <Maximize2 size={14} />
            Sanctuary Showcase
          </button>
          <button
            onClick={() => setViewMode('flow')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold tracking-wider transition-all ${
              viewMode === 'flow'
                ? 'bg-[#D4A853] text-[#050806] shadow-[0_0_12px_rgba(212,168,83,0.4)] font-bold'
                : 'text-[#8E7E6B] hover:text-[#FAF6EF]'
            }`}
          >
            <RefreshCw size={14} />
            Morph Flow
          </button>
          <button
            onClick={() => setViewMode('matrix')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold tracking-wider transition-all ${
              viewMode === 'matrix'
                ? 'bg-[#D4A853] text-[#050806] shadow-[0_0_12px_rgba(212,168,83,0.4)] font-bold'
                : 'text-[#8E7E6B] hover:text-[#FAF6EF]'
            }`}
          >
            <Grid size={14} />
            Blueprint Matrix
          </button>
        </div>
      </div>

      {/* MODE 1: SANCTUARY SHOWCASE */}
      {viewMode === 'sanctuary' && (
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Visual Stage */}
          <motion.div
            key={selectedItem.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="lg:col-span-8 relative group rounded-2xl overflow-hidden border border-[#D4A853]/30 bg-[#0A100C] shadow-[0_15px_50px_rgba(0,0,0,0.8)]"
          >
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              <span
                className="px-3 py-1 rounded-full text-[11px] font-bold tracking-widest uppercase border backdrop-blur-md shadow-lg"
                style={{
                  backgroundColor: `${selectedItem.badgeColor}25`,
                  borderColor: `${selectedItem.badgeColor}60`,
                  color: selectedItem.badgeColor
                }}
              >
                {selectedItem.category}
              </span>
            </div>

            <div className="relative aspect-[16/10] w-full bg-[#050806] overflow-hidden flex items-center justify-center">
              <img
                src={selectedItem.imageUrl}
                alt={selectedItem.title}
                className="w-full h-full object-contain object-center transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050806] via-transparent to-transparent opacity-60" />
            </div>

            <div className="p-6 border-t border-[#D4A853]/15 bg-[#080D0A]/90 backdrop-blur-md">
              <h2 className="text-2xl font-bold text-[#FAF6EF] tracking-wide mb-1 font-serif">
                {selectedItem.title}
              </h2>
              <p className="text-sm text-[#D4A853] font-medium tracking-wider mb-4">
                {selectedItem.subtitle}
              </p>
              <p className="text-sm text-[#B5A895] leading-relaxed font-sans mb-6">
                {selectedItem.description}
              </p>

              {/* Technical Specifications Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#050806]/80 p-4 rounded-xl border border-[#D4A853]/15">
                <div>
                  <div className="text-[10px] text-[#8E7E6B] uppercase tracking-wider mb-0.5">Resolution</div>
                  <div className="text-xs font-semibold text-[#FAF6EF]">{selectedItem.specs.resolution}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#8E7E6B] uppercase tracking-wider mb-0.5">Engine Core</div>
                  <div className="text-xs font-semibold text-[#FAF6EF]">{selectedItem.specs.engine}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#8E7E6B] uppercase tracking-wider mb-0.5">Substrate Base</div>
                  <div className="text-xs font-semibold text-[#FAF6EF]">{selectedItem.specs.substrate}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#8E7E6B] uppercase tracking-wider mb-0.5">Key Advantage</div>
                  <div className="text-xs font-semibold text-[#D4A853]">{selectedItem.specs.keyFeature}</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Side Navigation & Details Panel */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="rounded-2xl border border-[#D4A853]/25 bg-[#090E0B] p-5 shadow-xl">
              <h3 className="text-xs font-bold tracking-[0.2em] uppercase text-[#D4A853] mb-4 flex items-center gap-2">
                <Layers size={14} />
                Collection Selector
              </h3>
              <div className="flex flex-col gap-2.5">
                {GALLERY_ITEMS.map((item) => {
                  const isSelected = item.id === selectedId;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`text-left p-3 rounded-xl border transition-all flex items-center gap-3.5 group ${
                        isSelected
                          ? 'border-[#D4A853] bg-[#D4A853]/15 shadow-[0_0_20px_rgba(212,168,83,0.15)]'
                          : 'border-[#D4A853]/10 bg-[#060A08] hover:border-[#D4A853]/30 hover:bg-[#080D0A]'
                      }`}
                    >
                      <div className="relative h-12 w-16 shrink-0 rounded-lg overflow-hidden bg-black border border-[#D4A853]/20">
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#FAF6EF] truncate group-hover:text-[#D4A853] transition-colors">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-[#8E7E6B] tracking-wider uppercase mt-0.5">
                          {item.category}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Deep Lore & Specification Bullet Points */}
            <div className="rounded-2xl border border-[#D4A853]/20 bg-[#090E0B] p-5 shadow-xl">
              <h3 className="text-xs font-bold tracking-[0.2em] uppercase text-[#D4A853] mb-3 flex items-center gap-2">
                <Cpu size={14} />
                Architectural Breakdown
              </h3>
              <ul className="space-y-2.5 font-sans text-xs text-[#B5A895]">
                {selectedItem.details.map((detail, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="text-[#D4A853] mt-0.5">•</span>
                    <span className="leading-relaxed">{detail}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 pt-4 border-t border-[#D4A853]/15 flex items-center justify-between">
                <a
                  href={selectedItem.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#D4A853] hover:underline"
                >
                  <Download size={14} />
                  Open High-Res Source
                </a>
                <span className="text-[10px] text-[#8E7E6B] font-mono">VERIFIED MERKLE ASSET</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: MORPH FLOW (Dynamic Horizontal Scroll / Carousel with Skew) */}
      {viewMode === 'flow' && (
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold tracking-[0.2em] uppercase text-[#FAF6EF] mb-1">
              Continuum Flow Showcase
            </h2>
            <p className="text-xs text-[#8E7E6B] font-sans">
              Click any card to morph its full structural specifications into focus.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {GALLERY_ITEMS.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <motion.div
                  key={item.id}
                  whileHover={{ y: -6, scale: 1.02 }}
                  onClick={() => setSelectedId(item.id)}
                  className={`cursor-pointer rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col ${
                    isSelected
                      ? 'border-[#D4A853] bg-[#0C1410] shadow-[0_0_35px_rgba(212,168,83,0.3)] ring-1 ring-[#D4A853]'
                      : 'border-[#D4A853]/20 bg-[#080C0A] hover:border-[#D4A853]/40'
                  }`}
                >
                  <div className="relative aspect-[16/10] w-full bg-black overflow-hidden flex items-center justify-center">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#080C0A] via-transparent to-transparent opacity-80" />
                    <span
                      className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border shadow-md backdrop-blur-md"
                      style={{
                        backgroundColor: `${item.badgeColor}25`,
                        borderColor: `${item.badgeColor}60`,
                        color: item.badgeColor
                      }}
                    >
                      {item.category}
                    </span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-bold text-[#FAF6EF] mb-1 font-serif">
                        {item.title}
                      </h3>
                      <p className="text-xs text-[#D4A853] tracking-wide font-medium mb-3">
                        {item.subtitle}
                      </p>
                      <p className="text-xs text-[#9E907D] font-sans line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#D4A853]/15 flex items-center justify-between text-[11px] font-mono text-[#8E7E6B]">
                      <span>{item.specs.resolution}</span>
                      <span className="text-[#D4A853] flex items-center gap-1 font-bold">
                        Inspect <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 3: BLUEPRINT MATRIX (Clean Grid Specification View) */}
      {viewMode === 'matrix' && (
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col gap-8">
            {GALLERY_ITEMS.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[#D4A853]/25 bg-[#080D0A] overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-6 shadow-2xl"
              >
                <div className="lg:col-span-6 aspect-[16/10] bg-black relative flex items-center justify-center overflow-hidden">
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-contain" />
                </div>
                <div className="lg:col-span-6 p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border"
                        style={{
                          backgroundColor: `${item.badgeColor}20`,
                          borderColor: `${item.badgeColor}50`,
                          color: item.badgeColor
                        }}
                      >
                        {item.category}
                      </span>
                      <span className="text-xs text-[#8E7E6B] font-mono">ID: {item.id}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-[#FAF6EF] mb-1 font-serif">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[#D4A853] font-mono mb-4 tracking-wider">
                      {item.subtitle}
                    </p>
                    <p className="text-sm text-[#B5A895] font-sans mb-6 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="grid grid-cols-2 gap-4 bg-[#050806] p-4 rounded-xl border border-[#D4A853]/15 mb-6">
                      <div>
                        <div className="text-[10px] text-[#8E7E6B] uppercase tracking-wider">Resolution Core</div>
                        <div className="text-xs font-semibold text-[#FAF6EF]">{item.specs.resolution}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#8E7E6B] uppercase tracking-wider">Advantage Gate</div>
                        <div className="text-xs font-semibold text-[#D4A853]">{item.specs.keyFeature}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-[#D4A853]/15">
                    <span className="text-xs text-[#8E7E6B] flex items-center gap-1.5 font-mono">
                      <Shield size={14} className="text-[#10B981]" /> Auditable Provenance Verified
                    </span>
                    <a
                      href={item.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-lg bg-[#D4A853] text-[#050806] text-xs font-bold tracking-wider uppercase hover:bg-[#E8842A] transition-colors shadow-lg"
                    >
                      Export Specification
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
