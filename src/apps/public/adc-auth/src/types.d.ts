/// <reference types="vite/client" />
import "react";

declare module "@ui-library" {
	export * from "@adc/ui-library";
}

declare module "@ui-library/styles" {
	const styles: string;
	export default styles;
}

declare module "react" {
	namespace JSX {
		interface IntrinsicElements {
			[elemName: `adc-${string}`]: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, any>;
		}
	}
}

export {};
