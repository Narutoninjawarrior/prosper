const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'frontend', 'src', 'CottageAssemblyLine.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Fix escaped template literals
code = code.replace(/\\\${/g, '${');
code = code.replace(/\\`/g, '`');

fs.writeFileSync(filePath, code);
console.log('Fixed CottageAssemblyLine.tsx');
