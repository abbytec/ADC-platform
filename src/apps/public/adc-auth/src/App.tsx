import "@ui-library/utils/react-jsx";
import { useState, useEffect } from "react";
import { Login } from "./pages/Login.tsx";
import { Register } from "./pages/Register.tsx";
import { AuthLayout } from "./components/AuthLayout.tsx";
import { DEFAULT_RETURN_URL, sanitizeReturnUrl } from "./utils/safe-url.ts";

type Page = "login" | "register";

function getReturnUrl(): string {
	const params = new URLSearchParams(globalThis.location?.search);
	return sanitizeReturnUrl(params.get("returnUrl"));
}

export default function App() {
	const [page, setPage] = useState<Page>("login");
	const [returnUrl, setReturnUrl] = useState<string>(DEFAULT_RETURN_URL);

	useEffect(() => {
		const path = globalThis.location?.pathname;
		setReturnUrl(getReturnUrl());
		setPage(path === "/register" ? "register" : "login");

		const handlePopState = () => {
			setPage(globalThis.location?.pathname === "/register" ? "register" : "login");
			setReturnUrl(getReturnUrl());
		};

		globalThis.addEventListener("popstate", handlePopState);
		return () => globalThis.removeEventListener("popstate", handlePopState);
	}, []);

	// `to` es un literal del tipo `Page`, no viene de input → no es taint.
	const navigate = (to: Page) => {
		const search = returnUrl && returnUrl !== DEFAULT_RETURN_URL ? `?returnUrl=${encodeURIComponent(returnUrl)}` : "";
		globalThis.history.pushState({}, "", `/${to}${search}`);
		setPage(to);
	};

	return (
		<AuthLayout>
			{page === "login" ? (
				<Login onNavigateToRegister={() => navigate("register")} returnUrl={returnUrl} />
			) : (
				<Register onNavigateToLogin={() => navigate("login")} returnUrl={returnUrl} />
			)}
		</AuthLayout>
	);
}
