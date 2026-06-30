const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'functions', 'src', 'index.ts');
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  /const \{ releaseExpiredReservations, compostStaleSeeds, \r?\n          publishChainAnchor, processPassedProposals \} = \r?\n    await import\('\.\/lodgeSteward'\);/,
  '// @ts-ignore\n  const { releaseExpiredReservations, compostStaleSeeds, \n          publishChainAnchor, processPassedProposals } = \n    await import(\'./lodgeSteward\');'
);

fs.writeFileSync(filePath, code);
console.log('Fixed index.ts');
