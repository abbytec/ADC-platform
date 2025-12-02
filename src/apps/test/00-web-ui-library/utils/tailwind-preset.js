/**
 * Tailwind CSS Preset para ADC Platform UI Library
 * 
 * Este preset define los colores, tipografía y utilidades compartidas
 * que se usan en todos los componentes de la UI Library.
 * 
 * Los módulos que usan esta librería pueden extender este preset
 * para mantener consistencia visual.
 */

/** @type {import('tailwindcss').Config} */
export default {
	theme: {
		extend: {
			colors: {
				// Colores corporativos ADC Platform
				"adc-primary": {
					50: "#eff6ff",
					100: "#dbeafe",
					200: "#bfdbfe",
					300: "#93c5fd",
					400: "#60a5fa",
					500: "#0066cc",
					600: "#0052a3",
					700: "#003d7a",
					800: "#002952",
					900: "#001429",
				},
				"adc-success": {
					50: "#ecfdf5",
					100: "#d1fae5",
					200: "#a7f3d0",
					300: "#6ee7b7",
					400: "#34d399",
					500: "#10b981",
					600: "#059669",
					700: "#047857",
					800: "#065f46",
					900: "#064e3b",
				},
				"adc-warning": {
					50: "#fffbeb",
					100: "#fef3c7",
					200: "#fde68a",
					300: "#fcd34d",
					400: "#fbbf24",
					500: "#f59e0b",
					600: "#d97706",
					700: "#b45309",
					800: "#92400e",
					900: "#78350f",
				},
				"adc-danger": {
					50: "#fef2f2",
					100: "#fee2e2",
					200: "#fecaca",
					300: "#fca5a5",
					400: "#f87171",
					500: "#ef4444",
					600: "#dc2626",
					700: "#b91c1c",
					800: "#991b1b",
					900: "#7f1d1d",
				},
			},
			fontFamily: {
				sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
			},
			spacing: {
				"adc-sm": "0.5rem",
				"adc-md": "1rem",
				"adc-lg": "1.5rem",
				"adc-xl": "2rem",
			},
			borderRadius: {
				"adc": "0.375rem",
			},
			animation: {
				"fade-in": "fadeIn 0.3s ease-in-out",
				"slide-in": "slideIn 0.3s ease-out",
				"bounce-soft": "bounceSoft 1s ease-in-out infinite",
			},
			keyframes: {
				fadeIn: {
					"0%": { opacity: "0", transform: "translateY(-10px)" },
					"100%": { opacity: "1", transform: "translateY(0)" },
				},
				slideIn: {
					"0%": { opacity: "0", transform: "translateX(-10px)" },
					"100%": { opacity: "1", transform: "translateX(0)" },
				},
				bounceSoft: {
					"0%, 100%": { transform: "translateY(0)" },
					"50%": { transform: "translateY(-10px)" },
				},
			},
		},
	},
	plugins: [],
};

