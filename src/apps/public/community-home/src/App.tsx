import "@ui-library/utils/react-jsx";
import { useEffect, useState } from "react";
import { router } from "@ui-library/utils/router";
import { HomePage } from "./pages/HomePage";
import { PathsPage } from "./pages/PathsPage";
import { PathPage } from "./pages/PathPage";
import { ArticlesPage } from "./pages/ArticlesPage";
import { ArticlePage } from "./pages/ArticlePage";

export default function App() {
	const [mounted, setMounted] = useState(false);
	const [currentPath, setCurrentPath] = useState(globalThis.location?.pathname);

	useEffect(() => {
		setMounted(true);

		// Configurar listener para cambios de ruta
		const cleanup = router.setOnRouteChange((path: string) => {
			setCurrentPath(path);
		});

		return cleanup;
	}, []);

	if (!mounted) {
		return <div className="p-4 text-center">Cargando...</div>;
	}

	// Extraer slug de rutas dinamicas
	function extractSlug(basePath: string): string | null {
		if (currentPath.startsWith(`${basePath}/`)) {
			const slug = currentPath.slice(basePath.length + 1).split("?")[0];
			return slug || null;
		}
		return null;
	}

	// Determinar que pagina mostrar segun la ruta
	function renderPage() {
		// Rutas de paths
		const pathSlug = extractSlug("/paths");
		if (pathSlug) {
			return <PathPage slug={pathSlug} />;
		}
		if (currentPath === "/paths") {
			return <PathsPage />;
		}

		// Rutas de articulos
		const articleSlug = extractSlug("/articles");
		if (articleSlug) {
			return <ArticlePage slug={articleSlug} />;
		}
		if (currentPath === "/articles") {
			return <ArticlesPage />;
		}

		// Por defecto, mostrar la home
		return <HomePage />;
	}

	return (
		<div>
			{/* Toast handler global para errores no manejados */}
			<adc-custom-error variant="toast" global handle-unhandled />
			{renderPage()}
		</div>
	);
}
