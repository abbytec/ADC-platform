import { createElement, useState, useEffect, useRef } from "react";
import { Shell } from "./components/Shell.tsx";
import { router, type RouteDefinition } from "@ui-library/utils/router";
import { lazyLoadRemoteComponent, type Framework } from "@adc/utils/react/loadRemoteComponent";

interface RemoteModuleConfig {
	framework: Framework;
	remoteEntryUrl: string;
	remoteName: string;
	scope: string;
}

const moduleDefinitions: Record<string, RemoteModuleConfig> = {
	"community-home": {
		framework: "react",
		remoteEntryUrl: "http://localhost:3010/remoteEntry.js",
		remoteName: "community_home",
		scope: "./App",
	},
};

const routes: RouteDefinition[] = [{ module: "community-home", path: "/" }];

export default function App() {
	const [renderKey, setRenderKey] = useState(0);
	const [currentPath, setCurrentPath] = useState(window.location.pathname);
	const [moduleData, setModuleData] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const loadingPathRef = useRef<string | null>(null);
	const isInitialized = useRef(false);

	const getNavPath = (): string => {
		const subdomain = router.getSubdomain();
		if (subdomain) {
			const subdomainRoute = routes.find((r) => r.subdomain === subdomain);
			if (subdomainRoute?.path) {
				return subdomainRoute.path;
			}
		}
		return window.location.pathname;
	};

	useEffect(() => {
		if (isInitialized.current) return;
		isInitialized.current = true;

		async function loadComponent(path: string) {
			if (loadingPathRef.current === path) return;

			const moduleName = router.resolveModule(routes);

			if (!moduleName || !moduleDefinitions[moduleName]) {
				console.warn("[ADC Layout] Ruta no reconocida:", path);
				setModuleData({
					Component: () => <div style={{ padding: 20 }}>Página no encontrada: {path}</div>,
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

			console.log(`[ADC Layout] ✅ ${data.moduleName} @ ${path}`);

			setCurrentPath(getNavPath());
			setModuleData(data);
			setRenderKey((prev) => prev + 1);
			setLoading(false);
			loadingPathRef.current = null;
		}

		loadComponent(window.location.pathname);
		router.setOnRouteChange((path: string) => {
			console.log("[ADC Layout] 🔄 Route change:", path);
			loadComponent(path);
		});
	}, []);

	if (!moduleData || loading) {
		return (
			<Shell currentPath={currentPath}>
				<div style={{ padding: "20px", textAlign: "center" }}>
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
