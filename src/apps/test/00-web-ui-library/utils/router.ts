export class Router {
	private onRouteChange: ((path: string) => void) | null = null;
	private popstateListener: (() => void) | null = null;

	navigate(path: string) {
		if (window.location.pathname === path) {
			return;
		}
		
		window.history.pushState({}, '', path);
		if (this.onRouteChange) {
			this.onRouteChange(path);
		}
	}

	setOnRouteChange(callback: (path: string) => void) {
		this.onRouteChange = callback;
		
		if (!this.popstateListener) {
			this.popstateListener = () => {
				if (this.onRouteChange) {
					this.onRouteChange(window.location.pathname);
				}
			};
			window.addEventListener('popstate', this.popstateListener);
		}

		return () => {
			if (this.popstateListener) {
				window.removeEventListener('popstate', this.popstateListener);
				this.popstateListener = null;
			}
		};
	}

	getCurrentPath(): string {
		return window.location.pathname;
	}
}

export const router = new Router();

