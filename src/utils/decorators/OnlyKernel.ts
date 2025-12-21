export function OnlyKernel() {
	return function (_target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;

		descriptor.value = function (...args: any[]) {
			const kernelKeyToVerify = args[0];
			if ("kernelKey" in this && this.kernelKey) {
				if (this.kernelKey !== kernelKeyToVerify) {
					throw new Error(`Acceso no autorizado a ${propertyKey}`);
				}
				return originalMethod.apply(this, args);
			} else {
				throw new Error(`Kernel key no establecida`);
			}
		};

		return descriptor;
	};
}
