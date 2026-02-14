/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-namespace */
/**
 * Declaraciones JSX para web components de @ui-library (test) en apps React
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

interface AdcTestIntrinsicElements {
	"adc-button": WebComponentProps<{
		buttonType?: "button" | "submit" | "reset";
		disabled?: boolean;
		size?: "sm" | "md" | "lg";
		variant?: "primary" | "secondary" | "success" | "warning" | "danger";
	}>;
	"adc-container": WebComponentProps<{ maxWidth?: string; padding?: string }>;
	"adc-error": WebComponentProps<{ color?: string; errorDescription?: string; errorTitle?: string; httpError?: number }>;
	"adc-header": WebComponentProps<{ "header-title": string; subtitle?: string }>;
	"adc-stat-card": WebComponentProps<{
		cardTitle: string;
		color?: "primary" | "success" | "warning" | "danger" | "default";
		description?: string;
		value: string | number;
	}>;
}

declare module "react" {
	namespace JSX {
		interface IntrinsicElements extends AdcTestIntrinsicElements {}
	}
}
