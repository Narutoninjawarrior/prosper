const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'CommonsRoute.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const truthLegend = `
          {/* Truth Legend */}
          <div className="flex items-center justify-center gap-4 md:gap-8 p-3 bg-[#0A0604] border border-[#1A1410] rounded text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-6 shadow-sm">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="text-[#4A90D9]">Public Witness:</span> Review Surface
            </div>
            <div className="w-px h-3 bg-[#2A1F16]" />
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="text-[#E8842A]">Local Draft / Artifact:</span> Browser-Only Session
            </div>
            <div className="w-px h-3 bg-[#2A1F16]" />
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="text-[#8A7A64]">Seed Demo:</span> Static Examples
            </div>
          </div>
`;

// Insert the Truth Legend right after `<div className="max-w-7xl mx-auto space-y-12">`
code = code.replace(
  /<div className="max-w-7xl mx-auto space-y-12">/,
  `<div className="max-w-7xl mx-auto space-y-8">\n${truthLegend}`
);

// Harmonize Labels
// Check for any rogue "Publish to Commons" -> "Publish to Public Witness"
code = code.replace(
  /<div className="text-\[10px\] text-\[#4A90D9\] uppercase font-bold tracking-widest mb-2">Publish to Commons<\/div>/g,
  '<div className="text-[10px] text-[#4A90D9] uppercase font-bold tracking-widest mb-2">Publish to Public Witness</div>'
);

fs.writeFileSync(filePath, code);
console.log('CommonsRoute.tsx updated with truth legend');
