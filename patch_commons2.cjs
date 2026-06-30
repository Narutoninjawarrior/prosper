const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'CommonsRoute.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Fix unused variables
code = code.replace(
  /const \{ initAudio, updateRoom, updateGlobal, setMasterGain, playChime, enabled \} = useRoomAudio\(\);/,
  'const { updateRoom, updateGlobal, playChime, enabled } = useRoomAudio();'
);

// Fix require('react').useState
code = code.replace(
  /const \[expanded, setExpanded\] = require\('react'\)\.useState\(defaultExpanded\);/,
  'const [expanded, setExpanded] = useState(defaultExpanded);'
);

fs.writeFileSync(filePath, code);
console.log('CommonsRoute.tsx fixed');
