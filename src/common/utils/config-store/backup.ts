/**
 * Respaldo local de la configuración administrada, para que un nodo arranque con Mongo o la bóveda
 * sin responder.
 *
 * Es la pieza que hace posible sacar los secretos de `env/secrets.env`: hoy ese archivo está en
 * texto plano y quien lea el disco los tiene todos. Acá los valores viajan **sellados** con la misma
 * envoltura que en la bóveda —así que el archivo por sí solo no sirve sin la master key— y el nodo
 * sigue pudiendo levantar sin red.
 *
 * Lo no secreto (values y configmaps) va en claro: cifrarlo no protegería nada y volvería ilegible
 * un archivo que conviene poder mirar cuando algo no toma.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, fsyncSync, closeSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Dónde vive `env/`. Misma resolución que `load-env.ts`: el cwd manda —permite correr una copia del
 * árbol con otra configuración—, y si ahí no está se cae a la raíz derivada de este archivo, porque
 * un service manager sin `WorkingDirectory` arranca el proceso en cualquier lado.
 */
const MODULE_ROOT = resolve(fileURLToPath(import.meta.url), "../../../../..");
const ROOT = existsSync(resolve(process.cwd(), "env")) ? process.cwd() : MODULE_ROOT;

/** Formato del archivo. Un respaldo de otra versión se ignora en vez de interpretarse mal. */
const BACKUP_VERSION = 1;

export interface ConfigBackup {
	version: number;
	writtenAt: string;
	writtenBy: string;
	/** Valores en claro (values + configmaps ya resueltos por alcance). */
	plain: Record<string, string>;
	/** Valores **sellados**, con la misma AAD que en la bóveda. Se abren con la master key. */
	sealed: Record<string, string>;
	/** Alcance con el que se selló cada secreto: hace falta para reconstruir su AAD al abrirlo. */
	sealedScopes: Record<string, string>;
}

/**
 * Escritura atómica: temporal + `fsync` + `rename`.
 *
 * Sin el `fsync` el rename puede llegar al disco antes que el contenido, y un corte deja un archivo
 * de cero bytes donde estaba el respaldo bueno — que es exactamente el momento en que hace falta.
 */
function writeAtomic(file: string, content: string, mode: number): void {
	mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
	const tmp = `${file}.tmp`;
	writeFileSync(tmp, content, { mode });
	const fd = openSync(tmp, "r+");
	try {
		fsyncSync(fd);
	} finally {
		closeSync(fd);
	}
	renameSync(tmp, file);
}

function backupPath(): string {
	return resolve(ROOT, "env", ".cache", "config.sealed.json");
}

/** `0600`: aunque los secretos vayan sellados, la lista de nombres ya dice bastante. */
export function writeBackup(backup: Omit<ConfigBackup, "version">): void {
	writeAtomic(backupPath(), `${JSON.stringify({ version: BACKUP_VERSION, ...backup }, null, "\t")}\n`, 0o600);
}

/** `null` si no hay respaldo, es ilegible o es de otra versión del formato. */
export function readBackup(): ConfigBackup | null {
	try {
		const parsed = JSON.parse(readFileSync(backupPath(), "utf8")) as ConfigBackup;
		return parsed?.version === BACKUP_VERSION ? parsed : null;
	} catch {
		return null;
	}
}
