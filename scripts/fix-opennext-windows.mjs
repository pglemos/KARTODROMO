import fs from 'node:fs';
import path from 'node:path';

function fixDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        fixDirectory(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.json') || entry.name.endsWith('.cjs'))) {
        let content = fs.readFileSync(fullPath, 'utf8');
        const original = content;

        content = content.replace(/C:\\+KARTODROMO\\+/gi, './');
        content = content.replace(/C:\/KARTODROMO\//gi, './');
        content = content.replace(/C:\\+Users\\+[^\\]+\\+/gi, './');

        content = content.replace(/require\("([A-Z]:\\[^"]+)"\)/gi, (match, p1) => {
          return `require("${p1.replace(/\\+/g, '/')}")`;
        });
        content = content.replace(/import\("([A-Z]:\\[^"]+)"\)/gi, (match, p1) => {
          return `import("${p1.replace(/\\+/g, '/')}")`;
        });

        if (content !== original) {
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`Fixed Windows paths in: ${fullPath}`);
        }
      }
    } catch {
      // Ignore locked or missing transient files
    }
  }
}

console.log('Fixing OpenNext Windows path issues in .open-next...');
fixDirectory(path.resolve('.open-next'));
console.log('OpenNext Windows path fix complete!');
