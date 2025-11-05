import fs from 'node:fs';
import path from 'node:path';

const name = process.argv[2];
if (!name) {
  console.error('Usage: npm run create:service -- <service-name>');
  process.exit(1);
}

const toPascalCase = (str) =>
	str.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');

const dir = path.resolve(process.cwd(), 'src/services', name);

if (fs.existsSync(dir)) {
	console.error(`Error: Directory ${dir} already exists.`);
	process.exit(1);
}

fs.mkdirSync(dir, { recursive: true });

const className = toPascalCase(name);
const indexContent = `import { BaseService } from '../BaseService';

export default class ${className} extends BaseService {
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
  utilities: [],
  services: [],
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


console.log(`✅ Service "${name}" created at ${path.relative(process.cwd(), dir)}`);
