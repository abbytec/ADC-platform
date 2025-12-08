import HomeApp from './App.js';
import "@ui-library"; // Auto-registra Web Components
import "@ui-library/styles"; // CSS base de la UI Library
import "./styles/tailwind.css"; // Extensiones locales

// Crear instancia de la app
const app = new HomeApp();

// Montar la app en el contenedor root
const container = document.getElementById('root');
if (container) {
	app.mount(container);
} else {
	console.error('[Home] No se encontró el contenedor #root');
}

// HMR para desarrollo
if (import.meta.webpackHot) {
	import.meta.webpackHot.accept('./App.js', () => {
		console.log('[Home] 🔥 HMR Update');
		app.unmount();
		const NewApp = require('./App.js').default;
		const newApp = new NewApp();
		newApp.mount(container);
	});
}

