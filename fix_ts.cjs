const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'frontend', 'src', 'CottageAssemblyLine.tsx');
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(/existing\.filter\(p => p\.id !== commonsId\)/g, 'existing.filter((p: any) => p.id !== commonsId)');

fs.writeFileSync(filePath, code);
console.log('Fixed implicit any error');
