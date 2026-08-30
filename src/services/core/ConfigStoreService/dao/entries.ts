import { Schema, type Connection, type Model } from "mongoose";

/**
 * Una entrada de configmap. La clave es `<alcance>/<nombre>`: no hay ids sintéticos porque ese par
 * ya es único y es exactamente lo que se busca.
 */
export interface ConfigMapDoc {
	_id: string;
	scope: string;
	name: string;
	value: string;
	updatedAt: Date;
	updatedBy: string;
}

/**
 * El índice de la bóveda. **No guarda el valor**: el sobre sellado vive en el almacén de objetos, y
 * acá queda lo que hace falta para listar, versionar y detectar deriva sin tocarlo.
 *
 * Tenerlo separado es lo que permite que el panel liste los secretos con la bóveda caída: se ve qué
 * hay y quién lo cambió, y sólo falla revelar.
 */
export interface SecretIndexDoc {
	_id: string;
	scope: string;
	name: string;
	/** `sha256(valor)` truncado a 16 hex. Compara dos despliegues sin revelar nada. */
	digest: string;
	version: number;
	updatedAt: Date;
	updatedBy: string;
}

export function docId(scope: string, name: string): string {
	return `${scope}/${name}`;
}

const configMapSchema = new Schema<ConfigMapDoc>(
	{
		_id: { type: String, required: true },
		scope: { type: String, required: true, index: true },
		name: { type: String, required: true },
		// Siempre string: es lo que la interpolación de `${VAR}` pone en un `config.json`, y guardar
		// números o booleanos tipados obligaría a que cada consumidor adivine el tipo que le tocó.
		value: { type: String, required: true, default: "" },
		updatedAt: { type: Date, required: true, default: Date.now },
		updatedBy: { type: String, required: true, default: "seed" },
	},
	{ versionKey: false, _id: false, collection: "config_maps" }
);

const secretIndexSchema = new Schema<SecretIndexDoc>(
	{
		_id: { type: String, required: true },
		scope: { type: String, required: true, index: true },
		name: { type: String, required: true },
		digest: { type: String, required: true },
		version: { type: Number, required: true, default: 1 },
		updatedAt: { type: Date, required: true, default: Date.now },
		updatedBy: { type: String, required: true, default: "seed" },
	},
	{ versionKey: false, _id: false, collection: "config_secrets" }
);

export function getConfigMapModel(connection: Connection): Model<ConfigMapDoc> {
	return (connection.models.ConfigMap as Model<ConfigMapDoc>) ?? connection.model<ConfigMapDoc>("ConfigMap", configMapSchema);
}

export function getSecretIndexModel(connection: Connection): Model<SecretIndexDoc> {
	return (connection.models.SecretIndex as Model<SecretIndexDoc>) ?? connection.model<SecretIndexDoc>("SecretIndex", secretIndexSchema);
}
