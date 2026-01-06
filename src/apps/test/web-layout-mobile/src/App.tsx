import "@ui-library/utils/react-jsx";
import { createElement, useState, useEffect, useRef } from "react";
import { Shell } from "./components/Shell.tsx";
import { router, type RouteDefinition } from "@ui-library/utils/router";
import { lazyLoadRemoteComponent, type Framework } from "@adc/utils/react/loadRemoteComponent";

// Las funciones t(), setLocale(), getLocale() están disponibles globalmente
// desde adc-i18n.js (cargado en index.html)

interface RemoteModuleConfig {
	framework: Framework;
	remoteEntryUrl: string;
	remoteName: string;
	scope: string;
}

const IS_DEV = process.env.NODE_ENV === "development";

const moduleDefinitions: Record<string, RemoteModuleConfig> = {
	home: {
		framework: "vanilla",
		remoteEntryUrl: IS_DEV ? "http://localhost:3006/remoteEntry.js" : "http://m-home.local.com:3000/remoteEntry.js",
		remoteName: "home",
		scope: "./App",
	},
};

const routes: RouteDefinition[] = [{ module: "home", path: "/" }];

export default function App() {
	const [renderKey, setRenderKey] = useState(0);
	const [currentPath, setCurrentPath] = useState(window.location.pathname);
	const [moduleData, setModuleData] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const loadingPathRef = useRef<string | null>(null);
	const isInitialized = useRef(false);

	useEffect(() => {
		if (isInitialized.current) return;
		isInitialized.current = true;

		async function loadComponent(path: string) {
			if (loadingPathRef.current === path) return;

			const moduleName = router.resolveModule(routes);

			if (!moduleName || !moduleDefinitions[moduleName]) {
				console.warn("[Layout Mobile] Módulo no encontrado:", moduleName);
				setModuleData({
					Component: () => <div style={{ padding: 20, textAlign: "center", color: "#a0aec0" }}>Página no encontrada</div>,
					moduleName: "not-found",
					timestamp: Date.now(),
				});
				setLoading(false);
				return;
			}

			loadingPathRef.current = path;
			setLoading(true);

			await new Promise((resolve) => setTimeout(resolve, 10));

			const definition = moduleDefinitions[moduleName];
			const data = await lazyLoadRemoteComponent({
				remoteEntryUrl: definition.remoteEntryUrl,
				remoteName: definition.remoteName,
				scope: definition.scope,
				moduleName,
				framework: definition.framework,
			});

			setCurrentPath(path);
			setModuleData(data);
			setRenderKey((prev) => prev + 1);
			setLoading(false);
			loadingPathRef.current = null;
		}

		loadComponent(window.location.pathname);
		router.setOnRouteChange((path: string) => {
			loadComponent(path);
		});
	}, []);

	if (!moduleData || loading) {
		return (
			<Shell currentPath={currentPath}>
				<div
					style={{
						padding: "40px 20px",
						textAlign: "center",
						color: "#a0aec0",
					}}
				>
					<p>Cargando...</p>
				</div>
			</Shell>
		);
	}

	return (
		<Shell key={renderKey} currentPath={currentPath}>
			{createElement(moduleData.Component)}
		</Shell>
	);
}
