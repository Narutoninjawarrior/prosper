const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'functions', 'src', 'index.ts');
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  /\/\/ @ts-ignore\r?\n  const \{ releaseExpiredReservations, compostStaleSeeds, \r?\n          publishChainAnchor, processPassedProposals \} = \r?\n    await import\('\.\/lodgeSteward'\);/,
  'const { releaseExpiredReservations, compostStaleSeeds, publishChainAnchor, processPassedProposals } = await import(\'./lodgeSteward\') as any;'
);

fs.writeFileSync(filePath, code);
console.log('Fixed index.ts with any');
