/**
 * Toast notification utility for org-management
 */

export const toast = {
	success: (message: string) => {
		console.log("[Success]", message);
		// Could integrate with adc-toast component if available
	},
	error: (message: string) => {
		console.error("[Error]", message);
		// Could integrate with adc-toast component if available
	},
	warning: (message: string) => {
		console.warn("[Warning]", message);
		// Could integrate with adc-toast component if available
	},
	info: (message: string) => {
		console.info("[Info]", message);
		// Could integrate with adc-toast component if available
	},
};

/**
 * Format date utilities
 */
export const dateUtils = {
	format: (date: string | Date, format: "short" | "long" = "short"): string => {
		const d = typeof date === "string" ? new Date(date) : date;
		
		if (format === "short") {
			return d.toLocaleDateString("es-ES", {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		}
		
		return d.toLocaleDateString("es-ES", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	},

	isRecent: (dateString: string, days: number = 7): boolean => {
		const date = new Date(dateString);
		const now = new Date();
		const diffTime = Math.abs(now.getTime() - date.getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays <= days;
	},
};

/**
 * Slug utilities
 */
export const slugUtils = {
	create: (text: string): string => {
		return text
			.toLowerCase()
			.trim()
			.replace(/\s+/g, "-")
			.replace(/[^\w-]/g, "")
			.replace(/-+/g, "-");
	},

	validate: (slug: string): boolean => {
		return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug);
	},
};
