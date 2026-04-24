import type { Block } from "@ui-library/utils/connect-rpc";

type Align = "left" | "center" | "right";
type Mark = "bold" | "italic" | "code";
type Tone = "info" | "warning" | "success" | "error";
type Role = "note" | "status" | "alert";

interface Props {
	readonly block: Block;
	readonly onChange: (next: Block) => void;
}

const inputCls = "w-full p-2 rounded-xxl border border-alt bg-surface";
const labelCls = "flex flex-col gap-1 text-sm";

export function BlockFields({ block, onChange }: Props) {
	function patch<K extends keyof Block>(key: K, value: Block[K]) {
		onChange({ ...block, [key]: value });
	}

	switch (block.type) {
		case "heading":
			return (
				<div className="flex flex-col gap-2">
					<label className={labelCls}>
						<span>Texto</span>
						<input className={inputCls} value={block.text ?? ""} onChange={(e) => patch("text", e.target.value)} />
					</label>
					<div className="grid grid-cols-3 gap-2">
						<label className={labelCls}>
							<span>Nivel</span>
							<select className={inputCls} value={block.level ?? 2} onChange={(e) => patch("level", Number(e.target.value))}>
								{[2, 3, 4, 5, 6].map((l) => (
									<option key={l} value={l}>
										H{l}
									</option>
								))}
							</select>
						</label>
						<label className={labelCls}>
							<span>Alineación</span>
							<select className={inputCls} value={block.align ?? "left"} onChange={(e) => patch("align", e.target.value as Align)}>
								<option value="left">Izquierda</option>
								<option value="center">Centro</option>
								<option value="right">Derecha</option>
							</select>
						</label>
						<label className={labelCls}>
							<span>ID (ancla)</span>
							<input className={inputCls} value={block.id ?? ""} onChange={(e) => patch("id", e.target.value)} />
						</label>
					</div>
				</div>
			);
		case "paragraph":
			return (
				<div className="flex flex-col gap-2">
					<label className={labelCls}>
						<span>Texto</span>
						<textarea className={inputCls} rows={4} value={block.text ?? ""} onChange={(e) => patch("text", e.target.value)} />
					</label>
					<label className={labelCls}>
						<span>Alineación</span>
						<select className={inputCls} value={block.align ?? "left"} onChange={(e) => patch("align", e.target.value as Align)}>
							<option value="left">Izquierda</option>
							<option value="center">Centro</option>
							<option value="right">Derecha</option>
						</select>
					</label>
					<fieldset className="flex gap-3 text-sm">
						<legend className="sr-only">Marcas</legend>
						{(["bold", "italic", "code"] as Mark[]).map((m) => {
							const marks = block.marks ?? [];
							const active = marks.includes(m);
							return (
								<label key={m} className="flex items-center gap-1">
									<input
										type="checkbox"
										checked={active}
										onChange={(e) => {
											const next = e.target.checked ? [...marks, m] : marks.filter((x) => x !== m);
											patch("marks", next);
										}}
									/>
									<span>{m}</span>
								</label>
							);
						})}
					</fieldset>
				</div>
			);
		case "list":
			return (
				<div className="flex flex-col gap-2">
					<label className="flex items-center gap-2 text-sm">
						<input type="checkbox" checked={block.ordered === true} onChange={(e) => patch("ordered", e.target.checked)} />
						<span>Ordenada</span>
					</label>
					<label className={labelCls}>
						<span>Ítems (uno por línea)</span>
						<textarea
							className={inputCls}
							rows={5}
							value={(block.items ?? []).join("\n")}
							onChange={(e) =>
								patch(
									"items",
									e.target.value.split("\n").filter((v, i, arr) => v !== "" || i < arr.length - 1)
								)
							}
						/>
					</label>
					{block.ordered && (
						<label className={labelCls}>
							<span>Inicio</span>
							<input
								type="number"
								className={inputCls}
								value={block.start ?? 1}
								onChange={(e) => patch("start", Number(e.target.value))}
							/>
						</label>
					)}
				</div>
			);
		case "code":
			return (
				<div className="flex flex-col gap-2">
					<label className={labelCls}>
						<span>Lenguaje</span>
						<input
							className={inputCls}
							value={block.language ?? ""}
							onChange={(e) => patch("language", e.target.value)}
							placeholder="typescript, bash, json..."
						/>
					</label>
					<label className={labelCls}>
						<span>Contenido</span>
						<textarea
							className={`${inputCls} font-mono text-sm`}
							rows={8}
							value={block.content ?? ""}
							onChange={(e) => patch("content", e.target.value)}
						/>
					</label>
				</div>
			);
		case "callout":
			return (
				<div className="flex flex-col gap-2">
					<label className={labelCls}>
						<span>Texto</span>
						<textarea className={inputCls} rows={3} value={block.text ?? ""} onChange={(e) => patch("text", e.target.value)} />
					</label>
					<div className="grid grid-cols-2 gap-2">
						<label className={labelCls}>
							<span>Tono</span>
							<select className={inputCls} value={block.tone ?? "info"} onChange={(e) => patch("tone", e.target.value as Tone)}>
								<option value="info">Info</option>
								<option value="warning">Warning</option>
								<option value="success">Success</option>
								<option value="error">Error</option>
							</select>
						</label>
						<label className={labelCls}>
							<span>Role</span>
							<select className={inputCls} value={block.role ?? "note"} onChange={(e) => patch("role", e.target.value as Role)}>
								<option value="note">Note</option>
								<option value="status">Status</option>
								<option value="alert">Alert</option>
							</select>
						</label>
					</div>
				</div>
			);
		case "quote":
			return (
				<div className="flex flex-col gap-2">
					<label className={labelCls}>
						<span>Texto</span>
						<textarea className={inputCls} rows={3} value={block.text ?? ""} onChange={(e) => patch("text", e.target.value)} />
					</label>
					<label className={labelCls}>
						<span>URL de fuente (opcional)</span>
						<input className={inputCls} value={block.url ?? ""} onChange={(e) => patch("url", e.target.value)} />
					</label>
				</div>
			);
		case "table":
			return (
				<div className="flex flex-col gap-2">
					<label className={labelCls}>
						<span>Encabezados (separados por |)</span>
						<input
							className={inputCls}
							value={(block.header ?? []).join(" | ")}
							onChange={(e) =>
								patch(
									"header",
									e.target.value.split("|").map((s) => s.trim())
								)
							}
						/>
					</label>
					<label className={labelCls}>
						<span>Filas (una por línea, celdas separadas por |)</span>
						<textarea
							className={`${inputCls} font-mono text-sm`}
							rows={6}
							value={(block.rows ?? []).map((r) => r.join(" | ")).join("\n")}
							onChange={(e) =>
								patch(
									"rows",
									e.target.value.split("\n").map((line) => line.split("|").map((s) => s.trim()))
								)
							}
						/>
					</label>
					<label className={labelCls}>
						<span>Caption</span>
						<input className={inputCls} value={block.caption ?? ""} onChange={(e) => patch("caption", e.target.value)} />
					</label>
					<label className="flex items-center gap-2 text-sm">
						<input type="checkbox" checked={block.rowHeaders === true} onChange={(e) => patch("rowHeaders", e.target.checked)} />
						<span>Primera columna como encabezado</span>
					</label>
				</div>
			);
		case "divider":
			return <p className="text-muted text-sm">Este bloque no tiene propiedades configurables.</p>;
		default:
			return <p className="text-tdanger text-sm">Tipo de bloque desconocido.</p>;
	}
}
