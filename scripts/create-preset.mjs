import fs from 'node:fs';
import path from 'node:path';

const name = process.argv[2];
if (!name) {
  console.error('Usage: npm run create:preset -- <preset-name>');
  process.exit(1);
}

const toPascalCase = (str) =>
	str.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');

const dir = path.resolve(process.cwd(), 'src/presets', name);

if (fs.existsSync(dir)) {
	console.error(`Error: Directory ${dir} already exists.`);
	process.exit(1);
}

fs.mkdirSync(dir, { recursive: true });

const className = toPascalCase(name);
const indexContent = `import { BasePreset } from '../BasePreset';

export default class ${className} extends BasePreset {
  public readonly name = "${name}";
}
`;

const packageJson = {
  name: `@adc-platform/${name}`,
  type: "module",
  dependencies: {},
};

const modulesJson = {
  failOnError: false,
  providers: [],
  middlewares: [],
  presets: [],
};

fs.writeFileSync(
  path.join(dir, 'package.json'),
  JSON.stringify(packageJson, null, 2) + '\n'
);

fs.writeFileSync(
  path.join(dir, 'modules.json'),
  JSON.stringify(modulesJson, null, 2) + '\n'
);

fs.writeFileSync(path.join(dir, 'index.ts'), indexContent);


console.log(`✅ Preset "${name}" created at ${path.relative(process.cwd(), dir)}`);
