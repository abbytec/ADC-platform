/**
 * Custom hooks for org-management
 */

import { useState, useCallback } from "react";

export interface UseFormState<T> {
	values: T;
	errors: Partial<Record<keyof T, string>>;
	touched: Partial<Record<keyof T, boolean>>;
	isDirty: boolean;
	isSubmitting: boolean;
}

export interface UseFormOptions<T> {
	initialValues: T;
	onSubmit: (values: T) => Promise<void> | void;
	validate?: (values: T) => Partial<Record<keyof T, string>>;
}

/**
 * Hook for form state management
 */
export function useForm<T extends Record<string, any>>({
	initialValues,
	onSubmit,
	validate,
}: UseFormOptions<T>) {
	const [state, setState] = useState<UseFormState<T>>({
		values: initialValues,
		errors: {},
		touched: {},
		isDirty: false,
		isSubmitting: false,
	});

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			const { name, value, type } = e.target;
			const fieldValue = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;

			setState((prev) => ({
				...prev,
				values: {
					...prev.values,
					[name]: fieldValue,
				},
				isDirty: true,
			}));
		},
		[]
	);

	const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		const { name } = e.target;
		setState((prev) => ({
			...prev,
			touched: {
				...prev.touched,
				[name]: true,
			},
		}));
	}, []);

	const handleSubmit = useCallback(
		async (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();

			// Validate
			const errors = validate ? validate(state.values) : {};
			setState((prev) => ({
				...prev,
				errors,
				touched: Object.fromEntries(
					Object.keys(prev.values).map((key) => [key, true])
				) as Partial<Record<keyof T, boolean>>,
			}));

			if (Object.keys(errors).length > 0) {
				return;
			}

			// Submit
			setState((prev) => ({
				...prev,
				isSubmitting: true,
			}));

			try {
				await onSubmit(state.values);
			} catch (error) {
				console.error("Form submission error:", error);
			} finally {
				setState((prev) => ({
					...prev,
					isSubmitting: false,
				}));
			}
		},
		[state.values, validate, onSubmit]
	);

	const reset = useCallback(() => {
		setState({
			values: initialValues,
			errors: {},
			touched: {},
			isDirty: false,
			isSubmitting: false,
		});
	}, [initialValues]);

	const setFieldValue = useCallback((field: keyof T, value: any) => {
		setState((prev) => ({
			...prev,
			values: {
				...prev.values,
				[field]: value,
			},
			isDirty: true,
		}));
	}, []);

	return {
		...state,
		handleChange,
		handleBlur,
		handleSubmit,
		reset,
		setFieldValue,
	};
}

/**
 * Hook to sync router changes with component state
 */
export function useRouterSync(onChange: (path: string) => void) {
	const router = require("@common/utils/router").router;

	const unsubscribe = router.setOnRouteChange(onChange);
	return unsubscribe;
}
