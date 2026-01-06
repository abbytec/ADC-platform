import "@ui-library/utils/react-jsx";
import { createElement, useState, useEffect, useRef } from "react";
import { Shell } from "./components/Shell.tsx";
import { router, type RouteDefinition } from "@ui-library/utils/router";
import { lazyLoadRemoteComponent, type Framework } from "@adc/utils/react/loadRemoteComponent";

interface RemoteModuleBase {
	remoteEntryUrl: string;
	remoteName: string;
	scopes: Record<string, { framework: Framework; scope: string }>;
}

const IS_DEV = process.env.NODE_ENV === "development";

// Configuración de módulos remotos con sus scopes
const remoteModules: Record<string, RemoteModuleBase> = {
	"community-home": {
		remoteEntryUrl: IS_DEV ? "http://localhost:3010/remoteEntry.js" : "http://s-community.adigitalcafe.com:3000/remoteEntry.js",
		remoteName: "community_home",
		scopes: {
			App: { framework: "react", scope: "./App" },
			HeaderSlot: { framework: "react", scope: "./HeaderSlot" },
		},
	},
};

// Helper para obtener la configuración completa de un scope
function getRemoteConfig(moduleName: string, scopeName: string) {
	const module = remoteModules[moduleName];
	const scopeConfig = module?.scopes[scopeName];
	if (!module || !scopeConfig) return null;
	return {
		remoteEntryUrl: module.remoteEntryUrl,
		remoteName: module.remoteName,
		...scopeConfig,
	};
}

const routes: RouteDefinition[] = [{ module: "community-home", path: "/" }];

export default function App() {
	const [renderKey, setRenderKey] = useState(0);
	const [moduleData, setModuleData] = useState<any>(null);
	const [headerSlotData, setHeaderSlotData] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const loadingPathRef = useRef<string | null>(null);
	const isInitialized = useRef(false);

	useEffect(() => {
		if (isInitialized.current) return;
		isInitialized.current = true;

		async function loadComponent(path: string) {
			if (loadingPathRef.current === path) return;

			const moduleName = router.resolveModule(routes);
			const definition = moduleName ? getRemoteConfig(moduleName, "App") : null;

			if (!moduleName || !definition) {
				console.warn("[ADC Layout] Ruta no reconocida:", path);
				setModuleData({
					Component: () => <div style={{ padding: 20 }}>Página no encontrada: {path}</div>,
					moduleName: "not-found",
					timestamp: Date.now(),
				});
				setHeaderSlotData(null);
				setLoading(false);
				return;
			}

			loadingPathRef.current = path;
			setLoading(true);

			await new Promise((resolve) => setTimeout(resolve, 10));

			// Cargar componente principal
			const data = await lazyLoadRemoteComponent({
				remoteEntryUrl: definition.remoteEntryUrl,
				remoteName: definition.remoteName,
				scope: definition.scope,
				moduleName,
				framework: definition.framework,
			});

			// Cargar HeaderSlot si está disponible para este módulo
			const headerSlotConfig = getRemoteConfig(moduleName, "HeaderSlot");
			let headerData = null;
			if (headerSlotConfig) {
				try {
					headerData = await lazyLoadRemoteComponent({
						remoteEntryUrl: headerSlotConfig.remoteEntryUrl,
						remoteName: headerSlotConfig.remoteName,
						scope: headerSlotConfig.scope,
						moduleName: `${moduleName}-header`,
						framework: headerSlotConfig.framework,
					});
				} catch (err) {
					console.warn(`[ADC Layout] HeaderSlot no disponible para ${moduleName}:`, err);
				}
			}

			console.log(`[ADC Layout] ✅ ${data.moduleName} @ ${path}`);

			setModuleData(data);
			setHeaderSlotData(headerData);
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
			<Shell>
				<div style={{ padding: "20px", textAlign: "center" }}>
					<p>Cargando...</p>
				</div>
			</Shell>
		);
	}

	return (
		<Shell key={renderKey} headerSlot={headerSlotData ? createElement(headerSlotData.Component) : undefined}>
			{createElement(moduleData.Component)}
		</Shell>
	);
}
