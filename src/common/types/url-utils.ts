/** Dev mode: localhost or 127.0.0.1 */
export const IS_DEV = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location?.hostname);

const hostname = () => (typeof window !== "undefined" ? window.location.hostname : "localhost");
const protocol = () => (typeof window !== "undefined" ? window.location.protocol : "http:");
const port = () => (typeof window !== "undefined" && window.location.port ? `:${window.location.port}` : "");

/** Dev URL: http://{hostname}:{devPort}{path} */
export function getDevUrl(devPort: number, path = ""): string {
	return `http://${hostname()}:${devPort}${path}`;
}

/** Prod URL: {protocol}//{prodHostname}{port}{path} */
export function getProdUrl(prodHostname: string, path = ""): string {
	return `${protocol()}//${prodHostname}${port()}${path}`;
}

/** URL based on environment */
export function getUrl(devPort: number, prodHostname: string, path = ""): string {
	return IS_DEV ? getDevUrl(devPort, path) : getProdUrl(prodHostname, path);
}

/** Base URL for API calls. In prod returns just the basePath (same-origin) */
export function getBaseUrl(devPort: number, basePath = ""): string {
	return IS_DEV ? getDevUrl(devPort, basePath) : basePath;
}

/** Remote entry URL for Module Federation */
export function getRemoteEntryUrl(devPort: number, prodHostname: string, filename = "remoteEntry.js"): string {
	return IS_DEV ? `http://${hostname()}:${devPort}/${filename}` : `http://${prodHostname}:3000/${filename}`;
}
