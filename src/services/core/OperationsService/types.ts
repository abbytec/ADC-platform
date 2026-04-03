/**
 * Step function: a single async operation within a stepper pipeline.
 */
export type StepFunction = () => Promise<void>;

/**
 * Saga step: a group of transactional methods with compensating revert methods.
 * If any method fails, revertMethods are executed in reverse order
 * for the methods that already completed within this saga step.
 */
export interface SagaStep {
	methods: StepFunction[];
	revertMethods: StepFunction[];
}

/** A step can be either a simple function or a saga step */
export type Step = StepFunction | SagaStep;

/** Determines if a step is a SagaStep */
export function isSagaStep(step: Step): step is SagaStep {
	return typeof step === "object" && "methods" in step && "revertMethods" in step;
}

/** Result of a stepper execution: null if all OK, or the max index reached */
export type StepperResult = null | number;

/** MongoDB document for stepper state tracking */
export interface StepperDocument {
	_id: string;
	currentIdx: number;
	createdAt: Date;
}
