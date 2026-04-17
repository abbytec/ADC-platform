import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "theme_mode";

function applyTheme(mode: ThemeMode) {
	const root = document.documentElement;

	root.setAttribute("coffee-theme", "");

	if (mode === "dark") {
		root.setAttribute("dark-mode", "");
	} else {
		root.removeAttribute("dark-mode");
	}
}

export function useTheme() {
	const [mode, setMode] = useState<ThemeMode>("light");

	useEffect(() => {
		const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode;
		const initial = saved || "light";

		setMode(initial);
		applyTheme(initial);
	}, []);

	function changeTheme(next: ThemeMode) {
		setMode(next);
		applyTheme(next);
		localStorage.setItem(STORAGE_KEY, next);
	}

	return { mode, changeTheme };
}
