import { useState, useEffect } from "react";
import type { Block } from "@ui-library/utils/connect-rpc";

interface Props {
	readonly value: string;
	readonly onChange: (text: string, parsed: Block[] | null) => void;
}

export function BlocksEditor({ value, onChange }: Props) {
	const [error, setError] = useState<string>("");
	const [preview, setPreview] = useState<Block[]>([]);

	useEffect(() => {
		const trimmed = value.trim();
		if (!trimmed) {
			setError("");
			setPreview([]);
			return;
		}
		try {
			const parsed = JSON.parse(trimmed);
			if (!Array.isArray(parsed)) {
				setError("El JSON debe ser un array");
				setPreview([]);
				return;
			}
			setError("");
			setPreview(parsed);
		} catch (e) {
			setError(e instanceof Error ? e.message : "JSON inválido");
			setPreview([]);
		}
	}, [value]);

	function handleChange(ev: React.ChangeEvent<HTMLTextAreaElement>) {
		const text = ev.target.value;
		const trimmed = text.trim();
		let parsed: Block[] | null = null;
		if (trimmed) {
			try {
				const p = JSON.parse(trimmed);
				if (Array.isArray(p)) parsed = p;
			} catch {
				/* noop */
			}
		}
		onChange(text, parsed);
	}

	return (
		<div className="flex flex-col gap-2">
			<label htmlFor="blocks-json" className="font-medium">
				Contenido (Blocks JSON)
			</label>
			<textarea
				id="blocks-json"
				value={value}
				onChange={handleChange}
				rows={12}
				className="w-full p-2 rounded-xxl border border-alt bg-surface font-mono text-sm"
				placeholder='[{ "type": "heading", "level": 2, "text": "Título" }]'
			/>
			{error ? (
				<p className="text-tdanger text-sm">JSON inválido: {error}</p>
			) : preview.length > 0 ? (
				<div className="p-4 rounded-xxl">
					<p className="text-muted text-sm mb-2">Vista previa:</p>
					<adc-blocks-renderer blocks={preview} />
				</div>
			) : null}
		</div>
	);
}
