import type { RegisteredUIModule } from "../types.js";
import type { ImportMap } from "../../../../interfaces/modules/IUIModule.js";

/**
 * Genera el import map completo con todos los módulos registrados
 */
export function generateCompleteImportMap(
	registeredModules: Map<string, RegisteredUIModule>,
	port: number
): Record<string, string> {
	const isDevelopment = process.env.NODE_ENV === "development";
	const imports: Record<string, string> = {
		react: "https://esm.sh/react@18.3.1",
		"react-dom": "https://esm.sh/react-dom@18.3.1",
		"react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
		"react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
		"react/jsx-dev-runtime": "https://esm.sh/react@18.3.1/jsx-dev-runtime",
	};

	for (const [name, module] of registeredModules.entries()) {
		const framework = module.uiConfig.framework || "astro";

		if (framework === "stencil") {
			imports[`@${name}/loader`] = isDevelopment
				? `http://localhost:${port}/${name}/loader/index.js`
				: `/${name}/loader/index.js`;
			imports[`@${name}/dist`] = isDevelopment ? `http://localhost:${port}/${name}/dist/` : `/${name}/dist/`;
			imports[`@${name}/`] = isDevelopment ? `http://localhost:${port}/${name}/` : `/${name}/`;
		} else if (isDevelopment && module.uiConfig.devPort && (framework === "react" || framework === "vue")) {
			imports[`@${name}`] = `http://localhost:${module.uiConfig.devPort}/src/App.tsx`;
			imports[`@${name}/`] = `http://localhost:${module.uiConfig.devPort}/`;
		} else if (framework === "vite") {
			imports[`@${name}/`] = isDevelopment ? `http://localhost:${port}/${name}/` : `/${name}/`;
		} else if (framework === "react" || framework === "vue") {
			imports[`@${name}`] = `/${name}/App.js`;
			imports[`@${name}/`] = `/${name}/`;
		} else {
			imports[`@${name}`] = `/${name}/index.html`;
			imports[`@${name}/`] = `/${name}/`;
		}
	}

	return imports;
}

/**
 * Convierte el registro de import maps a formato ImportMap
 */
export function createImportMapObject(imports: Record<string, string>): ImportMap {
	return { imports };
}

