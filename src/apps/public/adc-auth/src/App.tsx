import "@ui-library/utils/react-jsx";
import { useState, useEffect } from "react";
import { Login } from "./pages/Login.tsx";
import { Register } from "./pages/Register.tsx";
import { AuthLayout } from "./components/AuthLayout.tsx";
import { getUrl } from "@common/utils/url-utils.js";

type Page = "login" | "register";

/** URL base del sitio principal según entorno */
const DEFAULT_RETURN_URL = getUrl(3011, "community.adigitalcafe.com");

/** Allowed hostnames for returnUrl redirection (same-origin + trusted subdomains) */
const ALLOWED_HOSTS = new Set([globalThis.location?.hostname, "adigitalcafe.com"]);

/** Validates that a returnUrl is safe (relative path or allowed origin) to prevent open redirect */
function sanitizeReturnUrl(raw: string): string {
	// Relative paths are always safe
	if (raw.startsWith("/") && !raw.startsWith("//")) return raw;

	try {
		const parsed = new URL(raw, globalThis.location?.origin);
		const host = parsed.hostname;
		if (ALLOWED_HOSTS.has(host) || host.endsWith(".adigitalcafe.com")) {
			return parsed.href;
		}
	} catch {
		// Invalid URL — fall through to default
	}

	return DEFAULT_RETURN_URL;
}

function getReturnUrl(): string {
	const params = new URLSearchParams(globalThis.location?.search);
	const raw = params.get("returnUrl");
	return raw ? sanitizeReturnUrl(raw) : DEFAULT_RETURN_URL;
}

/**
 * Construye una URL preservando el returnUrl
 */
function buildUrl(path: string, returnUrl: string): string {
	const url = new URL(path, globalThis.location?.origin);
	if (returnUrl && returnUrl !== DEFAULT_RETURN_URL) {
		url.searchParams.set("returnUrl", returnUrl);
	}
	return url.pathname + url.search;
}

export default function App() {
	const [page, setPage] = useState<Page>("login");
	const [returnUrl, setReturnUrl] = useState<string>(DEFAULT_RETURN_URL);

	useEffect(() => {
		const path = globalThis.location?.pathname;
		setReturnUrl(getReturnUrl());

		if (path === "/register") {
			setPage("register");
		} else {
			setPage("login");
		}

		const handlePopState = () => {
			const newPath = globalThis.location?.pathname;
			setPage(newPath === "/register" ? "register" : "login");
			setReturnUrl(getReturnUrl());
		};

		globalThis.addEventListener("popstate", handlePopState);
		return () => globalThis.removeEventListener("popstate", handlePopState);
	}, []);

	const navigate = (to: Page) => {
		const newUrl = buildUrl(to === "register" ? "/register" : "/login", returnUrl);
		globalThis.history.pushState({}, "", newUrl);
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
