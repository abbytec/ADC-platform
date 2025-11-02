import { Buffer } from "node:buffer";
import { IFileAdapter } from "../../../interfaces/middlewares/adapters/IFIleAdapter.js";
import { IMiddleware } from "../../../interfaces/IMIddleware.js";
import { Logger } from "../../../utils/Logger/Logger.js";

class JsonAdapter implements IFileAdapter<any> {
	toBuffer(data: any): Buffer {
		try {
			const jsonString = JSON.stringify(data, null, 2);
			return Buffer.from(jsonString, "utf-8");
		} catch (err: any) {
			Logger.error("[JsonAdapter] Error al serializar a Buffer:" + err.message);
			return Buffer.alloc(0);
		}
	}

	fromBuffer<T>(buffer: Buffer): T {
		if (buffer.byteLength === 0) {
			const errorMsg = "[JsonAdapter] Error: No se puede parsear un buffer vacío.";
			Logger.error(errorMsg);
			throw new Error(errorMsg);
		}

		try {
			const jsonString = buffer.toString("utf-8");
			return JSON.parse(jsonString) as T;
		} catch (err: any) {
			Logger.error("[JsonAdapter] Error al parsear desde Buffer: " + err.message);
			throw new Error(`[JsonAdapter] Error al parsear JSON: ${err.message}`);
		}
	}
}

export default class JsonAdapterMiddleware implements IMiddleware<IFileAdapter<any>> {
	public name = "json-file-adapter";

	getInstance(): IFileAdapter<any> {
		return new JsonAdapter();
	}
}
