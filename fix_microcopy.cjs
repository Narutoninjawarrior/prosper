const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'frontend', 'src', 'CottageAssemblyLine.tsx');
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  /<button onClick=\{\(\) => handleDownloadBundle\(batch\)\} style=\{\{([^}]*)\}\}>Download<\/button>/g,
  '<button onClick={() => handleDownloadBundle(batch)} style={{$1}}>Export Local Bundle</button>'
);

fs.writeFileSync(filePath, code);
console.log('Fixed microcopy');
