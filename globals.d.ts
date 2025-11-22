// Declaraciones globales para TypeScript
// Esto hace que cualquier módulo que coincida con estos patrones sea válido

// Module Federation - apps remotas
declare module "home/App" {
	const App: React.ComponentType;
	export default App;
}

declare module "users-management/App" {
	const App: React.ComponentType;
	export default App;
}

declare module "config/App" {
	const App: React.ComponentType;
	export default App;
}

// Wildcard para cualquier módulo .js
declare module "*.js" {
	const content: any;
	export default content;
}

declare module "*.vue" {
	import { DefineComponent } from "vue";
	const component: DefineComponent<any, any, any>;
	export default component;
}
declare namespace JSX {
	interface IntrinsicElements {
		[elemName: `adc-${string}`]: any;
	}
}
