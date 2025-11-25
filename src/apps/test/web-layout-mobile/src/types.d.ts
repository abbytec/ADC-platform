declare module "*.css" {
	const content: string;
	export default content;
}

declare namespace JSX {
	interface IntrinsicElements {
		"adc-button": any;
		"adc-header": any;
		"adc-container": any;
		"adc-stat-card": any;
		"adc-error": any;
	}
}

