/** Returns true for localhost, 127.0.0.1 and private/LAN IPv4 addresses */
export function isPrivateHost(hostname: string): boolean {
	if (hostname === "localhost" || hostname === "127.0.0.1") return true;
	if (hostname.startsWith("192.168.")) return true;
	if (hostname.startsWith("10.")) return true;
	if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
	return false;
}

/** Dev mode: localhost, 127.0.0.1 or private/LAN IP */
export const IS_DEV = isPrivateHost(globalThis.location?.hostname ?? "");
