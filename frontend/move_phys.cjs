const fs = require('fs');
const p = 'src/AgentAccess.tsx';
let txt = fs.readFileSync(p, 'utf8');

const targetStr = '<section className="rounded-[24px] border border-[#60A5FA]/16 bg-[#60A5FA]/4 px-6 py-6">\n          <div className="flex flex-wrap items-center justify-between gap-3">\n            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#60A5FA]">\n              <Database size={14} />\n              Physical Systems Pack';

const physPackStart = txt.indexOf(targetStr);
if (physPackStart > -1) {
  const physPackEnd = txt.indexOf('</section>', physPackStart) + 10;
  const physPackBlock = txt.slice(physPackStart, physPackEnd);

  // Remove it from old location
  let newTxt = txt.slice(0, physPackStart) + txt.slice(physPackEnd);

  // Insert it right after the hero section, before Start Here: Agent Operator Playbook
  const insertPoint = newTxt.indexOf('{/* Start Here: Agent Operator Playbook & Integration Matrix */}');
  newTxt = newTxt.slice(0, insertPoint) + physPackBlock + '\n\n        ' + newTxt.slice(insertPoint);

  // Calm the design of the Playbook matrix
  newTxt = newTxt.replace('<section className="rounded-[28px] border border-[#D4A853]/20 bg-black/40 p-6 backdrop-blur-sm md:p-8">', '<section className="rounded-[28px] border border-[#D4A853]/20 bg-black/40 p-5 backdrop-blur-sm md:p-6">');
  newTxt = newTxt.replace('<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">', '<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">');
  newTxt = newTxt.replace('<div className="mt-8 border-t border-white/5 pt-6">', '<div className="mt-5 border-t border-white/5 pt-5">');
  newTxt = newTxt.replace('<div className="grid gap-4 md:grid-cols-5 text-[11px] text-[#c9bba5]">', '<div className="grid gap-2 md:grid-cols-5 text-[11px] text-[#c9bba5]">');
  newTxt = newTxt.replace('<div className="mt-8 border-t border-white/5 pt-6">', '<div className="mt-5 border-t border-white/5 pt-5">'); // second one

  // Clean up double empty lines
  newTxt = newTxt.replace(/\n\n\n+/g, '\n\n');

  fs.writeFileSync(p, newTxt);
  console.log('Moved and calmed upper half.');
} else {
  console.log('Target string not found');
}
