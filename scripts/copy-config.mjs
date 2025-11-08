import fs from 'fs';
import path from 'path';

function findAndCopy(dir, patterns) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      findAndCopy(fullPath, patterns);
    } else {
      // Verificar si el archivo coincide con alguno de los patrones
      const matches = patterns.some(pattern => file.name.endsWith(pattern));
      if (matches) {
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
}

const srcPath = path.join(process.cwd(), 'src');

// Copiar archivos de configuración y módulos Python
console.log('Copying configuration files and Python modules...');
findAndCopy(srcPath, ['.json', '.py']);
