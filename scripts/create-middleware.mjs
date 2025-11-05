import fs from 'node:fs';
import path from 'node:path';

const name = process.argv[2];
if (!name) {
  console.error('Usage: npm run create:middleware -- <middleware-name>');
  process.exit(1);
}

const toPascalCase = (str) =>
	str.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');

const dir = path.resolve(process.cwd(), 'src/middlewares', name);

if (fs.existsSync(dir)) {
	console.error(`Error: Directory ${dir} already exists.`);
	process.exit(1);
}

fs.mkdirSync(dir, { recursive: true });

const className = toPascalCase(name);
const indexContent = `import { BaseMiddleware } from '../BaseMiddleware';

export default class ${className} extends BaseMiddleware {
  public name = "${name}";
}
`;

const packageJson = {
  name: `@adc-platform/${name}`,
  dependencies: {},
};

fs.writeFileSync(
  path.join(dir, 'package.json'),
  JSON.stringify(packageJson, null, 2) + '\n'
);

fs.writeFileSync(path.join(dir, 'index.ts'), indexContent);


console.log(`✅ Middleware "${name}" created at ${path.relative(process.cwd(), dir)}`);
