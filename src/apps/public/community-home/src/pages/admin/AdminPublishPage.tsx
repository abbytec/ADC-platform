import { AdminGate } from "../../components/admin/AdminGate";
import { ArticleForm } from "../../components/admin/ArticleForm";

export function AdminPublishPage() {
	return (
		<AdminGate>
			{() => (
				<div className="p-8">
					<h1>Publicar artículo</h1>
					<ArticleForm />
				</div>
			)}
		</AdminGate>
	);
}
