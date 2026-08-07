const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    if (dir.includes('node_modules') || dir.includes('.next') || dir.includes('.git')) {
        return results;
    }
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.resolve(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(filePath));
        } else {
            if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.css') || filePath.endsWith('.svg')) {
                results.push(filePath);
            }
        }
    });
    return results;
}

const files = walkDir(__dirname);
let totalReplaced = 0;

files.forEach(file => {
    const original = fs.readFileSync(file, 'utf8');
    let content = original;
    
    // Replace strict cases first
    content = content.replaceAll('WANDERHUB', 'AERO');
    content = content.replaceAll('WanderHub', 'AERO');
    content = content.replaceAll('Wanderhub', 'AERO');
    
    // Case insensitive fallback for custom domains/urls if needed, but we keep it safe
    content = content.replaceAll('wanderhub', 'aero');
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        totalReplaced++;
        console.log(`Updated: ${file}`);
    }
});

console.log(`Done. Updated ${totalReplaced} files.`);
