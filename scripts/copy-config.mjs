import fs from 'fs';
import path from 'path';

function findAndCopy(dir, pattern) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      findAndCopy(fullPath, pattern);
    } else if (file.name.endsWith(pattern)) {
      const relativePath = path.relative(path.join(process.cwd(), 'src'), fullPath);
      const destPath = path.join(process.cwd(), 'dist', relativePath);
      const destDir = path.dirname(destPath);
      
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      fs.copyFileSync(fullPath, destPath);
      console.log(`Copied: ${relativePath}`);
    }
  }
}

const srcPath = path.join(process.cwd(), 'src');
findAndCopy(srcPath, '.json');
