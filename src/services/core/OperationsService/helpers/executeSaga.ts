import type { ILogger } from "../../../../interfaces/utils/ILogger.js";

type SagaPayload = {
	methods: (() => Promise<void>)[];
	revertMethods: (() => Promise<void>)[];
};

/** Executes a saga step: runs all methods in order; on failure reverts completed ones. */
export async function executeSaga(saga: SagaPayload, docId: string, stepIdx: number, logger: ILogger): Promise<void> {
	const completed: number[] = [];

	for (let j = 0; j < saga.methods.length; j++) {
		try {
			await saga.methods[j]();
			completed.push(j);
		} catch (error: any) {
			logger.logError(`[stepper] ${docId} saga step ${stepIdx}, method ${j} failed: ${error.message}`);
			for (let k = completed.length - 1; k >= 0; k--) {
				const idx = completed[k];
				if (idx < saga.revertMethods.length) {
					try {
						await saga.revertMethods[idx]();
					} catch (e: any) {
						logger.logError(`[stepper] ${docId} revert ${idx} failed: ${e.message}`);
					}
				}
			}
			throw error;
		}
	}
}
