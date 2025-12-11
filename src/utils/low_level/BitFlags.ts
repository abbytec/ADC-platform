function isPowerOfTwo(n: number): boolean {
	return n > 0 && (n & (n - 1)) === 0;
}

// No utilicé compatibilidad con enum porque el decoding es más rapido si usas mapas constantes (as const) y no hay que adquirir values.
export default class BitFlags<T extends Record<string, number>> {
	readonly enum: T;

	constructor(enumObj: T) {
		for (const key in enumObj) {
			if (!isPowerOfTwo(enumObj[key])) {
				throw new Error(`Enum value of ${key} (${enumObj[key]}) is not a power of 2`);
			}
		}
		this.enum = enumObj;
	}

	/** Codifica un array de keys a un número */
	static encode<T extends Record<string, number>, K extends keyof T>(enumObj: T, keys: K[]): number {
		return keys.reduce((acc, key) => acc | (enumObj[key] ?? 0), 0);
	}

	/** Decodifica un número a un array de keys */
	static decode<T extends Record<string, number>, K extends keyof T>(enumObj: T, value: number): K[] {
		return (Object.keys(enumObj) as K[]).filter((key) => (value & enumObj[key]) !== 0);
	}

	/** Verifica si un flag está activo */
	static hasFlag<T extends Record<string, number>, K extends keyof T>(enumObj: T, value: number, key: K): boolean {
		return (value & enumObj[key]) !== 0;
	}

	/** Métodos de instancia usando el enum de la instancia */
	encode(keys: (keyof T)[]): number {
		return BitFlags.encode(this.enum, keys);
	}

	decode(value: number): (keyof T)[] {
		return BitFlags.decode(this.enum, value);
	}

	hasFlag(value: number, key: keyof T): boolean {
		return BitFlags.hasFlag(this.enum, value, key);
	}
}

/* Ejemplo de uso:

const Roles = {
    Admin: 1,
    User: 2,
    Guest: 4,
} as const; // importante el "as const"

const roles = new BitFlags(Roles);

roles.encode(["Admin", "User"]); // 3
roles.decode(3); // ["Admin", "User"]
roles.hasFlag(3, "Admin"); // true 

*/
