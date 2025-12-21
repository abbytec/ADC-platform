declare module "*.css" {
	const content: string;
	export default content;
}

declare namespace JSX {
	interface IntrinsicElements {
		// Organisms
		"adc-site-header": any;
		"adc-site-footer": any;
		"adc-consent-banner": any;
		"adc-blocks-renderer": any;
		// Molecules
		"adc-content-card": any;
		"adc-dropdown-menu": any;
		"adc-feature-card": any;
		"adc-share-buttons": any;
		"adc-testimonial-card": any;
		// Atoms
		"adc-button": any;
		"adc-button-rounded": any;
		"adc-input": any;
		"adc-select": any;
		"adc-callout": any;
		"adc-code-block": any;
		"adc-divider": any;
		"adc-inline-tokens": any;
		"adc-list-block": any;
		"adc-lp-badge": any;
		"adc-quote": any;
		"adc-search-input": any;
		"adc-star-rating": any;
		"adc-table-block": any;
		"adc-text": any;
		// Icons
		"adc-icon-community": any;
		"adc-icon-learning": any;
		"adc-icon-left-arrow": any;
		"adc-icon-logout": any;
		"adc-icon-nitro": any;
		"adc-icon-opensource": any;
		"adc-icon-pencil": any;
		"adc-icon-vip": any;
	}
}

declare module "@ui-library";
declare module "@ui-library/styles";
