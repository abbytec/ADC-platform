/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-namespace */
/**
 * Declaraciones JSX para web components de @ui-library (mobile) en apps React
 * Compatible con React 17+ (jsx: react-jsx)
 */

import "react";

type WebComponentProps<T = Record<string, unknown>> = T & {
	children?: React.ReactNode;
	class?: string;
	className?: string;
	style?: React.CSSProperties | string;
	ref?: React.Ref<HTMLElement>;
	slot?: string;
	key?: React.Key;
} & React.DOMAttributes<HTMLElement>;

interface AdcMobileIntrinsicElements {
	"adc-button": WebComponentProps<{ buttonType?: "button" | "submit" | "reset"; disabled?: boolean; variant?: "primary" | "secondary" }>;
	"adc-container": WebComponentProps<{ maxWidth?: string; padding?: string }>;
	"adc-header": WebComponentProps<{ "header-title": string; subtitle?: string }>;
	"adc-stat-card": WebComponentProps<{ cardTitle: string; color?: string; description?: string; value: string | number }>;
}

declare module "react" {
	namespace JSX {
		interface IntrinsicElements extends AdcMobileIntrinsicElements {}
	}
}
