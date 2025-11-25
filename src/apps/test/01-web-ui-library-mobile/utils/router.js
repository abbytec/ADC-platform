export class Router {
	onRouteChange = null;
	popstateListener = null;

	navigate(path) {
		if (window.location.pathname === path) {
			return;
		}
		
		window.history.pushState({}, '', path);
		if (this.onRouteChange) {
			this.onRouteChange(path);
		}
	}

	setOnRouteChange(callback) {
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

	getCurrentPath() {
		return window.location.pathname;
	}
}

export const router = new Router();

