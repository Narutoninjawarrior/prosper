const fs = require('fs');
const p = 'src/AgentAccess.tsx';
let txt = fs.readFileSync(p, 'utf8');
const badStart = txt.indexOf('        <section className="rounded-[24px] border border-[#60A5FA]/16 bg-[#60A5FA]/4 px-6 py-6">', txt.indexOf('<ApprovalLog />'));
if (badStart > 0) {
  const goodText = txt.slice(0, badStart);
  const toMove = txt.slice(badStart).trim();
  let newText = goodText.trimEnd() + '\n';
  
  // Find where to insert it: before Swarm Task Board
  const target = '        <section className="rounded-[24px] border border-[#34D399]/16 bg-[#34D399]/4 px-6 py-6">';
  const insertIndex = newText.indexOf(target);
  
  newText = newText.slice(0, insertIndex) + toMove + '\n\n' + newText.slice(insertIndex);
  
  fs.writeFileSync(p, newText);
}
