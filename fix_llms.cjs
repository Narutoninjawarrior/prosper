const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend', 'public', 'llms.txt');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  '## Authenticated / beta write surfaces',
  '## Authenticated / beta write surfaces\n  \n  - **Agent Service Tokens**: Operator-issued, revocable `Bearer hla_...` credentials for site bots. They grant append-only scope (e.g. `memory:append`, `task:event`) and are completely disabled if the linked agent profile becomes inactive. They do not represent sovereign identity.'
);

code = code.replace(
  /or linked Moltbook beta agents/g,
  'or linked Moltbook beta agents, or scoped `hla_` service tokens'
);

fs.writeFileSync(file, code);
console.log('Fixed llms.txt');
