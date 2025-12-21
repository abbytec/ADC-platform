import { useEffect, useState } from "react";
import { router } from "@ui-library/utils/router";
import { HomePage } from "./pages/HomePage";
import { PathsPage } from "./pages/PathsPage";
import { ArticlesPage } from "./pages/ArticlesPage";

export default function App() {
	const [mounted, setMounted] = useState(false);
	const [currentPath, setCurrentPath] = useState(window.location.pathname);

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

	// Determinar qué página mostrar según la ruta
	function renderPage() {
		if (currentPath === "/paths" || currentPath.startsWith("/paths/")) {
			return <PathsPage />;
		}

		if (currentPath === "/articles" || currentPath.startsWith("/articles/")) {
			return <ArticlesPage />;
		}

		// Por defecto, mostrar la home
		return <HomePage />;
	}

	return <div className="p-4">{renderPage()}</div>;
}
