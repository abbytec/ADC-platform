import { createElement } from 'react';

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
		window.addEventListener('popstate', () => {
			this.navigate(window.location.pathname);
		});
	}

	addRoute(config: RouteConfig) {
		this.routes.push(config);
	}

	async navigate(path: string) {
		this.currentRoute = path;
		
		// Notificar cambio de ruta
		if (this.onRouteChange) {
			this.onRouteChange(path);
		}

		// Buscar ruta que coincida
		const route = this.routes.find(r => {
			if (r.path === path) return true;
			// Match con parámetros (/users/:id)
			const pattern = r.path.replace(/:[^/]+/g, '([^/]+)');
			const regex = new RegExp(`^${pattern}$`);
			return regex.test(path);
		});

		if (route && route.component) {
			const component = await route.component();
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
		return this.currentRoute || window.location.pathname;
	}
}

export const router = new Router();

