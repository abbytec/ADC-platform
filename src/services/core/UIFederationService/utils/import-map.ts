import type { RegisteredUIModule } from "../types.js";
import type { ImportMap } from "../../../../interfaces/modules/IUIModule.js";

/**
 * Genera el import map completo con todos los módulos registrados de un namespace
 */
export function generateCompleteImportMap(
	registeredModules: Map<string, RegisteredUIModule>,
	port: number,
	namespace: string = "default"
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
		const nsPrefix = `/${namespace}`;

		if (framework === "stencil") {
			imports[`@${name}/loader`] = isDevelopment
				? `http://localhost:${port}${nsPrefix}/${name}/loader/index.js`
				: `${nsPrefix}/${name}/loader/index.js`;
			imports[`@${name}/dist`] = isDevelopment 
				? `http://localhost:${port}${nsPrefix}/${name}/dist/` 
				: `${nsPrefix}/${name}/dist/`;
			imports[`@${name}/`] = isDevelopment 
				? `http://localhost:${port}${nsPrefix}/${name}/` 
				: `${nsPrefix}/${name}/`;
		} else if (isDevelopment && module.uiConfig.devPort && (framework === "react" || framework === "vue")) {
			imports[`@${name}`] = `http://localhost:${module.uiConfig.devPort}/src/App.tsx`;
			imports[`@${name}/`] = `http://localhost:${module.uiConfig.devPort}/`;
		} else if (framework === "vite") {
			imports[`@${name}/`] = isDevelopment 
				? `http://localhost:${port}${nsPrefix}/${name}/` 
				: `${nsPrefix}/${name}/`;
		} else if (framework === "react" || framework === "vue") {
			imports[`@${name}`] = `${nsPrefix}/${name}/App.js`;
			imports[`@${name}/`] = `${nsPrefix}/${name}/`;
		} else {
			imports[`@${name}`] = `${nsPrefix}/${name}/index.html`;
			imports[`@${name}/`] = `${nsPrefix}/${name}/`;
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
