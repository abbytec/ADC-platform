import type InternalS3Provider from "@providers/object/internal-s3-provider/index.js";
import { secretKey, type ConfigScope } from "@common/utils/config-store/sealer.ts";

/**
 * La bóveda: los sobres sellados, en el almacén de objetos.
 *
 * **Un objeto por secreto** y no un paquete por alcance: escribir uno nunca reescribe otro, así que
 * dos administradores cambiando secretos distintos no se pisan. El costo es una lectura por secreto
 * al arrancar, que se paga en paralelo y sobre una lista que sale del índice en Mongo — nunca de un
 * `list` sobre el bucket, que devolvería objetos que el índice no conoce.
 */
export class SecretVault {
	readonly #s3: InternalS3Provider;
	readonly #bucket: string;

	constructor(s3: InternalS3Provider, bucket: string) {
		this.#s3 = s3;
		this.#bucket = bucket;
	}

	async put(scope: ConfigScope, name: string, sealed: string): Promise<void> {
		await this.#s3.putObject({
			bucket: this.#bucket,
			key: secretKey(scope, name),
			body: Buffer.from(sealed, "utf8"),
			contentType: "application/octet-stream",
		});
	}

	/** `null` si el objeto no está. Un secreto en el índice y ausente acá es deriva, y se reporta. */
	async get(scope: ConfigScope, name: string): Promise<string | null> {
		try {
			const { stream } = await this.#s3.getObjectStream({ bucket: this.#bucket, key: secretKey(scope, name) });
			const chunks: Buffer[] = [];
			for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk));
			return Buffer.concat(chunks).toString("utf8");
		} catch {
			return null;
		}
	}

	async remove(scope: ConfigScope, name: string): Promise<void> {
		await this.#s3.deleteObject({ bucket: this.#bucket, key: secretKey(scope, name) });
	}
}
