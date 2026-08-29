import { randomBytes } from "node:crypto";
import type { RegisteredEndpoint } from "../types.js";
import type RedisProvider from "../../../../providers/queue/redis/index.ts";

interface RuntimeRateLimit {
	max: number;
	timeWindow: number;
	/** Cupo por navegador dentro del cupo por IP. Ver `resolveRateLimit`. */
	perDevice?: { max: number; timeWindow: number };
}

/** Config cruda (proviene de `config.json` → `private.rateLimit`, valores string interpolados). */
export interface RateLimitConfig {
	enabled?: boolean | string;
	readMax?: number | string;
	mutationMax?: number | string;
	windowMs?: number | string;
}

/** Config resuelta y tipada que se calcula una vez al iniciar el servicio. */
export interface ResolvedRateLimits {
	enabled: boolean;
	readMax: number;
	mutationMax: number;
	windowMs: number;
}

const MUTATIVE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_READ_MAX = 600;
const DEFAULT_MUTATION_MAX = 120;
const DEFAULT_WINDOW_MS = 60_000;

function parseBoolean(value: boolean | string | undefined, defaultValue: boolean): boolean {
	if (typeof value === "boolean") return value;
	if (typeof value !== "string" || value.trim() === "") return defaultValue;
	return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}

function parsePositiveInteger(value: number | string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/** Resuelve la config de rate limit declarada en `config.json` (sin `process.env`). */
export function resolveRateLimitConfig(config: RateLimitConfig = {}): ResolvedRateLimits {
	return {
		enabled: parseBoolean(config.enabled, true),
		readMax: parsePositiveInteger(config.readMax, DEFAULT_READ_MAX),
		mutationMax: parsePositiveInteger(config.mutationMax, DEFAULT_MUTATION_MAX),
		windowMs: parsePositiveInteger(config.windowMs, DEFAULT_WINDOW_MS),
	};
}

function normalize(limit: RuntimeRateLimit): RuntimeRateLimit | null {
	if (!Number.isFinite(limit.max) || !Number.isFinite(limit.timeWindow)) return null;
	if (limit.max <= 0 || limit.timeWindow <= 0) return null;
	const base = { max: Math.floor(limit.max), timeWindow: Math.floor(limit.timeWindow) };
	const device = limit.perDevice;
	if (!device || !Number.isFinite(device.max) || !Number.isFinite(device.timeWindow)) return base;
	if (device.max <= 0 || device.timeWindow <= 0) return base;
	return { ...base, perDevice: { max: Math.floor(device.max), timeWindow: Math.floor(device.timeWindow) } };
}

export function resolveRateLimit(endpoint: RegisteredEndpoint, limits: ResolvedRateLimits): RuntimeRateLimit | null {
	const explicit = endpoint.options?.rateLimit;
	if (explicit) return normalize(explicit);

	// Endpoints públicos (sin permisos) SIEMPRE reciben el límite por defecto:
	// el kill-switch global ENDPOINT_RATE_LIMIT_ENABLED no aplica a superficies sin auth.
	const isPublic = (endpoint.permissions?.length ?? 0) === 0;
	if (!isPublic && !limits.enabled) return null;

	const isMutation = MUTATIVE_METHODS.has(endpoint.method);
	return normalize({
		max: isMutation ? limits.mutationMax : limits.readMax,
		timeWindow: limits.windowMs,
	});
}


/**
 * Los 4 primeros grupos de una IPv6, normalizados. `null` si no parsea como IPv6 (el caller
 * entonces usa la dirección tal cual, que es el comportamiento seguro).
 */
function ipv6Prefix64(address: string): string | null {
	const zoneless = address.split("%")[0];
	const halves = zoneless.split("::");
	if (halves.length > 2) return null;

	const head = halves[0] ? halves[0].split(":") : [];
	const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
	// Sin `::` la dirección tiene que traer los 8 grupos; si no, no es una IPv6 y no se toca.
	if (halves.length === 1 && head.length !== 8) return null;

	const fill = 8 - head.length - tail.length;
	if (fill < 0) return null;
	const groups = halves.length === 2 ? [...head, ...(Array(fill).fill("0") as string[]), ...tail] : head;

	const prefix = groups.slice(0, 4);
	if (prefix.length !== 4 || prefix.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return null;
	return prefix.map((group) => Number.parseInt(group, 16).toString(16)).join(":");
}

/**
 * Identidad de red del contador: la IP tal cual en IPv4, el prefijo /64 en IPv6.
 *
 * Sin el recorte los dos protocolos no miden lo mismo. Al cliente IPv6 el ISP le delega un bloque
 * entero, así que rota direcciones dentro de su propia casa y el límite por /128 no lo toca nunca,
 * mientras el hogar IPv4 detrás de NAT paga por todos sus dispositivos. El /64 es la unidad que se
 * asigna; el /128 es sólo la que se usa en cada request.
 */
export function clientRateKey(ip: string | undefined | null): string {
	if (!ip) return "unknown";
	// `::ffff:1.2.3.4` es una IPv4 disfrazada: recortarla a /64 metería a internet entero en un bucket.
	const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
	if (mapped) return mapped[1];
	if (!ip.includes(":")) return ip;
	const prefix = ipv6Prefix64(ip);
	return prefix ? `${prefix}::/64` : ip;
}

/** Cookie del eje "dispositivo". Técnica y de vida corta: sólo sirve para separar navegadores. */
export const DEVICE_COOKIE_NAME = "adc_rl_device";
const DEVICE_ID_RX = /^[0-9a-f]{32}$/;

/** Id opaco nuevo, sin ningún dato derivado del cliente (un UA no sirve: es elegible por quien abusa). */
export function mintDeviceId(): string {
	return randomBytes(16).toString("hex");
}

/** El id que trae la request, o `null` si no hay cookie válida todavía. */
export function readDeviceId(cookies: Record<string, string | undefined> | undefined): string | null {
	const value = cookies?.[DEVICE_COOKIE_NAME];
	return value && DEVICE_ID_RX.test(value) ? value : null;
}

/**
 * Ventana fija en memoria: respaldo del contador de Redis.
 *
 * Existe porque el límite NO puede simplemente desaparecer cuando Redis no está: los endpoints
 * públicos (sin permisos) lo llevan siempre, y son justo la superficie que no se puede dejar
 * abierta. Cuenta por proceso, así que con varios nodos el límite efectivo se multiplica por la
 * cantidad de nodos — peor que el contador global, infinitamente mejor que ninguno.
 */
const FALLBACK_MAX_KEYS = 20_000;
const fallbackWindows = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitDecision {
	/** Peticiones en la ventana, contando ésta. */
	count: number;
	/** El contador salió de la memoria del proceso porque Redis no respondió. */
	degraded: boolean;
}

function consumeInMemory(key: string, ttlSeconds: number): number {
	const now = Date.now();
	let entry = fallbackWindows.get(key);

	if (entry && entry.resetAt <= now) {
		fallbackWindows.delete(key);
		entry = undefined;
	}

	if (!entry) {
		if (fallbackWindows.size >= FALLBACK_MAX_KEYS) {
			for (const [otherKey, other] of fallbackWindows) {
				if (other.resetAt <= now) fallbackWindows.delete(otherKey);
			}
			// Sigue lleno: se dejan de admitir claves NUEVAS en vez de vaciar el mapa. Vaciarlo
			// borraría justo el contador de quien está inundando; esto lo conserva.
			if (fallbackWindows.size >= FALLBACK_MAX_KEYS) return 1;
		}
		entry = { count: 0, resetAt: now + ttlSeconds * 1000 };
		fallbackWindows.set(key, entry);
	}

	entry.count += 1;
	return entry.count;
}

/**
 * Incrementa el contador de la ventana. **Nunca lanza**: si Redis no responde cae al contador en
 * memoria en vez de dejar la request colgada (que es lo que hacía cuando el cliente encolaba los
 * comandos del socket caído) o de tumbarla con un 500.
 */
export async function consumeRateLimit(redis: RedisProvider | null, key: string, ttlSeconds: number): Promise<RateLimitDecision> {
	if (redis) {
		try {
			return { count: await redis.incrWithTtl(key, ttlSeconds), degraded: false };
		} catch {
			/* degrada a memoria */
		}
	}
	return { count: consumeInMemory(key, ttlSeconds), degraded: true };
}

/** Ritmo del aviso de degradación: el hot path no puede escribir una línea de log por request. */
const DEGRADED_WARN_INTERVAL_MS = 60_000;
let lastDegradedWarnAt = 0;

/** `true` como mucho una vez por minuto, para que el aviso de "rate limit en memoria" no ahogue el log. */
export function shouldWarnDegraded(): boolean {
	const now = Date.now();
	if (now - lastDegradedWarnAt < DEGRADED_WARN_INTERVAL_MS) return false;
	lastDegradedWarnAt = now;
	return true;
}
