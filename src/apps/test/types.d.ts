// Declaraciones de módulos federados para TypeScript
declare module '@ui-library/components/*.js' {
	const component: any;
	export default component;
	export const Container: any;
	export const Header: any;
	export const PrimaryButton: any;
	export const StatCard: any;
}

declare module '@ui-library/utils/*.js' {
	export const router: any;
}

declare module '@home' {
	const component: any;
	export default component;
}

declare module '@config' {
	const component: any;
	export default component;
}

declare module '@users-management' {
	const component: any;
	export default component;
}

declare module '@layout' {
	const component: any;
	export default component;
}

