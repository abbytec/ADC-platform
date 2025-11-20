export interface RouteConfig {
	path: string;
	component: () => Promise<any>;
	element?: any;
}

export class Router {
	private routes: RouteConfig[] = [];
	private currentRoute: string | null = null;
	private onRouteChange: ((route: string) => void) | null = null;

	constructor() {
		// Escuchar cambios en la URL
		if (typeof window !== 'undefined') {
			window.addEventListener('popstate', () => {
				this.navigate(window.location.pathname);
			});
		}
	}

	addRoute(config: RouteConfig) {
		this.routes.push(config);
	}

	async navigate(path: string, notifyChange: boolean = true) {
		// Normalizar path para que funcione con o sin trailing slash
		const normalizedPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
		
		// Evitar navegación si ya estamos en esa ruta
		if (this.currentRoute === normalizedPath && !notifyChange) {
			return null;
		}
		
		this.currentRoute = normalizedPath;
		
		// Buscar ruta que coincida
		const route = this.routes.find(r => {
			const normalizedRoutePath = r.path.endsWith('/') && r.path.length > 1 ? r.path.slice(0, -1) : r.path;
			
			if (normalizedRoutePath === normalizedPath) return true;
			// Match con parámetros (/users/:id)
			const pattern = normalizedRoutePath.replace(/:[^/]+/g, '([^/]+)');
			const regex = new RegExp(`^${pattern}$`);
			return regex.test(normalizedPath);
		});

		if (route && route.component) {
			const component = await route.component();
			
			// Notificar cambio de ruta DESPUÉS de cargar el componente
			if (notifyChange && this.onRouteChange) {
				this.onRouteChange(path);
			}
			
			return component;
		}

		return null;
	}

	setOnRouteChange(callback: (route: string) => void) {
		this.onRouteChange = callback;
	}

	push(path: string) {
		window.history.pushState({}, '', path);
		this.navigate(path);
	}

	getCurrentRoute() {
		if (typeof window !== 'undefined') {
			return this.currentRoute || window.location.pathname;
		}
		return '/';
	}
}

export const router = new Router();

