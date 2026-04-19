import { useEffect, useState } from "react";
import { router } from "@common/utils/router.js";
import { contentAPI, type Article } from "../../utils/content-api";
import { adminApi } from "../../utils/admin-api";
import { AdminGate } from "../../components/admin/AdminGate";
import { ArticleForm } from "../../components/admin/ArticleForm";

function EditorBody({ slug, canDeleteUnpublished }: { readonly slug: string; readonly canDeleteUnpublished: (a: Article) => boolean }) {
	const [article, setArticle] = useState<Article | null | undefined>(undefined);
	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		contentAPI.getArticle(slug).then((a) => setArticle(a ?? null));
	}, [slug]);

	async function handleDelete() {
		if (!article) return;
		if (!globalThis.confirm("¿Eliminar este artículo no publicado? Esta acción es permanente.")) return;
		setDeleting(true);
		const ok = await adminApi.deleteArticle(article.slug);
		setDeleting(false);
		if (ok) router.navigate("/admin/articles");
	}

	if (article === undefined) return <p className="text-muted p-8">Cargando...</p>;
	if (article === null) return <p className="text-tdanger p-8">Artículo no encontrado</p>;

	return (
		<div className="p-8">
			<h1>Editar artículo</h1>
			<ArticleForm article={article} />
			{canDeleteUnpublished(article) && (
				<div className="mt-4">
					<button
						type="button"
						onClick={handleDelete}
						disabled={deleting}
						className="px-4 py-2 bg-tdanger text-danger rounded-xxl disabled:opacity-50"
					>
						{deleting ? "Eliminando..." : "Eliminar artículo"}
					</button>
				</div>
			)}
		</div>
	);
}

export function AdminArticleEditPage({ slug }: { readonly slug: string }) {
	return (
		<AdminGate>
			{(session, isReviewer) => (
				<EditorBody slug={slug} canDeleteUnpublished={(a) => !a.listed && (isReviewer || a.authorId === session.user?.id)} />
			)}
		</AdminGate>
	);
}
