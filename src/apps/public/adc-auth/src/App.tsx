import "@ui-library/utils/react-jsx";
import { useState, useEffect } from "react";
import { Login } from "./pages/Login.tsx";
import { Register } from "./pages/Register.tsx";
import { AuthLayout } from "./components/AuthLayout.tsx";

type Page = "login" | "register";

/**
 * Obtiene el originPath desde la URL (query param ?originPath=...)
 * Este es el path al que redirigir tras login/register exitoso
 */
function getOriginPath(): string {
	const params = new URLSearchParams(window.location.search);
	return params.get("originPath") || "/";
}

/**
 * Construye una URL preservando el originPath
 */
function buildUrl(path: string, originPath: string): string {
	const url = new URL(path, window.location.origin);
	if (originPath && originPath !== "/") {
		url.searchParams.set("originPath", originPath);
	}
	return url.pathname + url.search;
}

export default function App() {
	const [page, setPage] = useState<Page>("login");
	const [originPath, setOriginPath] = useState<string>("/");

	useEffect(() => {
		const path = window.location.pathname;
		const origin = getOriginPath();

		setOriginPath(origin);

		if (path === "/register") {
			setPage("register");
		} else {
			setPage("login");
		}

		const handlePopState = () => {
			const newPath = window.location.pathname;
			setPage(newPath === "/register" ? "register" : "login");
			setOriginPath(getOriginPath());
		};

		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	const navigate = (to: Page) => {
		const newUrl = buildUrl(to === "register" ? "/register" : "/login", originPath);
		window.history.pushState({}, "", newUrl);
		setPage(to);
	};

	return (
		<AuthLayout>
			{page === "login" ? (
				<Login onNavigateToRegister={() => navigate("register")} originPath={originPath} />
			) : (
				<Register onNavigateToLogin={() => navigate("login")} originPath={originPath} />
			)}
		</AuthLayout>
	);
}
