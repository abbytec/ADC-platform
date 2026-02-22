/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-namespace */
/**
 * Declaraciones JSX para web components de @ui-library en apps React
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

interface AdcIntrinsicElements {
	"adc-blocks-renderer": WebComponentProps<{ blocks?: unknown[] }>;
	"adc-button": WebComponentProps<{
		ariaLabel?: string;
		href?: string;
		type?: "button" | "submit" | "reset";
		disabled?: boolean;
		variant?: "primary" | "accent";
	}>;
	"adc-button-rounded": WebComponentProps<{
		ariaLabel?: string;
		href?: string;
		type?: "button" | "submit" | "reset";
		variant?: "default" | "danger";
	}>;
	"adc-callout": WebComponentProps<{ role?: "note" | "status" | "alert"; tone?: "info" | "warning" | "success" | "error" }>;
	"adc-code-block": WebComponentProps<{ ariaLabel?: string; content?: string; language?: string }>;
	"adc-content-card": WebComponentProps<{
		bannerAlt?: string;
		bannerUrl?: string;
		compact?: boolean;
		description?: string;
		href?: string;
		title?: string;
	}>;
	"adc-custom-error": WebComponentProps<{
		variant?: "callout" | "toast";
		global?: boolean;
		handleUnhandled?: boolean;
		keys?: string;
		dismissTimeout?: number;
		maxStack?: number;
	}>;
	"adc-divider": WebComponentProps;
	"adc-dropdown-menu": WebComponentProps<{ items?: unknown[]; alignState?: "left" | "right"; openOnHover?: boolean }>;
	"adc-feature-card": WebComponentProps<{ staticRender?: boolean; title?: string }>;
	"adc-icon-community": WebComponentProps<{ size?: string }>;
	"adc-icon-learning": WebComponentProps<{ size?: string }>;
	"adc-icon-left-arrow": WebComponentProps<{ size?: string }>;
	"adc-icon-logout": WebComponentProps<{ size?: string }>;
	"adc-icon-nitro": WebComponentProps<{ size?: string }>;
	"adc-icon-opensource": WebComponentProps<{ size?: string }>;
	"adc-icon-pencil": WebComponentProps<{ size?: string }>;
	"adc-icon-vip": WebComponentProps<{ size?: string }>;
	"adc-layout": WebComponentProps<{
		authUrl?: string;
		apiBaseUrl?: string;
		brandName?: string;
		brandSlogan?: string;
		creatorHref?: string;
		creatorName?: string;
		homeHref?: string;
		logoAlt?: string;
		logoSrc?: string;
		showAccessButton?: boolean;
	}>;
	"adc-inline-tokens": WebComponentProps<{ tokens?: unknown[]; fallback?: string }>;
	"adc-input": WebComponentProps<{
		ariaLabel?: string;
		autocomplete?: string;
		disabled?: boolean;
		inputId?: string;
		name?: string;
		placeholder?: string;
		type?: string;
		value?: string;
	}>;
	"adc-list-block": WebComponentProps<{ ariaLabel?: string; items?: string[]; ordered?: boolean; start?: number }>;
	"adc-lp-badge": WebComponentProps<{ as?: "button" | "span"; color?: string; slug?: string; title?: string }>;
	"adc-quote": WebComponentProps<{ staticRender?: boolean }>;
	"adc-search-input": WebComponentProps<{
		ariaLabel?: string;
		autocomplete?: string;
		debounce?: number;
		inputId?: string;
		name?: string;
		placeholder?: string;
		type?: string;
		value?: string;
	}>;
	"adc-select": WebComponentProps<{ options?: unknown[]; placeholder?: string; value?: string }>;
	"adc-share-buttons": WebComponentProps<{ description?: string; title?: string; url?: string }>;
	"adc-site-footer": WebComponentProps<{
		brandName?: string;
		brandSlogan?: string;
		creatorHref?: string;
		creatorName?: string;
		lowerSign?: boolean;
		registered?: boolean;
	}>;
	"adc-site-header": WebComponentProps<{ homeHref?: string; logoAlt?: string; logoSrc?: string }>;
	"adc-star-rating": WebComponentProps<{
		average?: number | null;
		canRate?: boolean;
		count?: number | null;
		myRating?: number | null;
		pending?: boolean;
	}>;
	"adc-table-block": WebComponentProps<{
		caption?: string;
		columnAlign?: Array<"left" | "center" | "right">;
		header?: string[];
		rowHeaders?: boolean;
		rows?: string[][];
	}>;
	"adc-toggle": WebComponentProps<{ checked?: boolean; label?: string }>;
	"adc-toggle-badge": WebComponentProps<{ active?: boolean }>;
	"adc-testimonial-card": WebComponentProps<{ author?: string; staticRender?: boolean }>;
	"adc-text": WebComponentProps<{ contain?: boolean; staticRender?: boolean }>;
	"adc-youtube-facade": WebComponentProps<{ height?: string; src: string; title?: string; width?: string }>;
}

declare module "react" {
	namespace JSX {
		interface IntrinsicElements extends AdcIntrinsicElements {}
	}
}
