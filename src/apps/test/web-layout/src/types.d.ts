declare module "*.css" {
	const content: string;
	export default content;
}

declare namespace JSX {
	interface IntrinsicElements {
		"adc-header": any;
		"adc-container": any;
	}
}

declare module "@ui-library";
declare module "@ui-library/styles";
