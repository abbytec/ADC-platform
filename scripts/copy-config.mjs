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

/**
 * Copia recursivamente un directorio completo
 */
function copyDirectory(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      // Ignorar node_modules y outputs de build
      if (entry.name === 'node_modules' || entry.name === 'dist-ui') {
        continue;
      }
      copyDirectory(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

/**
 * Detecta y copia apps UI (apps con uiModule en config.json)
 */
function copyUIApps(appsDir) {
  if (!fs.existsSync(appsDir)) {
    return;
  }

  console.log('\nDetecting and copying UI apps...');

  function scanAppsRecursively(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const appPath = path.join(dir, entry.name);
      const configPath = path.join(appPath, 'config.json');

      // Verificar si tiene config.json
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

          // Si tiene uiModule, es una app UI
          if (config.uiModule) {
            console.log(`Found UI app: ${entry.name}`);
            
            const relativePath = path.relative(path.join(process.cwd(), 'src'), appPath);
            const destPath = path.join(process.cwd(), 'dist', relativePath);

            // Copiar estructura completa (src/, package.json, tsconfig.json, etc.)
            // pero excluyendo node_modules y dist-ui
            copyDirectory(appPath, destPath);
            
            console.log(`  Copied UI app structure to: ${relativePath}`);
          }
        } catch (error) {
          // Config inválido, ignorar
        }
      }

      // Buscar recursivamente en subdirectorios
      scanAppsRecursively(appPath);
    }
  }

  scanAppsRecursively(appsDir);
}

const srcPath = path.join(process.cwd(), 'src');
const appsPath = path.join(srcPath, 'apps');

// Copiar archivos de configuración, módulos Python, docker-compose y archivos Astro
console.log('Copying configuration files, Python modules, Docker files and Astro files...');
findAndCopy(srcPath, ['.json', '.py', '.yml', '.yaml', '.astro']);

// Copiar apps UI completas
copyUIApps(appsPath);
