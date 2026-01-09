/**
 * Decorador que restringe el acceso a métodos solo cuando se proporciona la kernelKey correcta.
 * Soporta tanto la sintaxis legacy (experimentalDecorators) como Stage 3 decorators.
 */
export function OnlyKernel() {
	// Detectar si estamos en Stage 3 (descriptor es undefined, context es el segundo arg)
	return function (
		targetOrMethod: any,
		propertyKeyOrContext: string | ClassMethodDecoratorContext,
		descriptor?: PropertyDescriptor
	): any {
		// Stage 3 decorators: targetOrMethod es el método, propertyKeyOrContext es el context
		if (typeof propertyKeyOrContext === "object" && propertyKeyOrContext.kind === "method") {
			const methodName = String(propertyKeyOrContext.name);
			return function (this: any, ...args: any[]) {
				const kernelKeyToVerify = args[0];
				if ("kernelKey" in this && this.kernelKey) {
					if (this.kernelKey !== kernelKeyToVerify) {
						throw new Error(`Acceso no autorizado a ${methodName}`);
					}
					return targetOrMethod.apply(this, args);
				} else {
					throw new Error(`Kernel key no establecida`);
				}
			};
		}

		// Legacy decorators: propertyKeyOrContext es string, descriptor existe
		const propertyKey = propertyKeyOrContext as string;
		const originalMethod = descriptor!.value;

		descriptor!.value = function (this: any, ...args: any[]) {
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
