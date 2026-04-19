import { useEffect, useState } from "react";
import { router } from "@common/utils/router.js";
import { contentAPI, type Article } from "../../utils/content-api";
import { AdminGate } from "../../components/admin/AdminGate";

function status(a: Article) {
	if (a.listed) return { text: "Publicado", cls: "text-tsuccess" };
	if (!a.description) return { text: "Para revisar", cls: "text-warn" };
	return { text: "Preparado", cls: "text-tinfo" };
}

function ArticlesList({ authorId }: { readonly authorId?: string }) {
	const [articles, setArticles] = useState<Article[] | null>(null);
	const heading = authorId ? "Mis artículos" : "Artículos";

	useEffect(() => {
		const opts: Record<string, unknown> = { listed: undefined };
		if (authorId) opts.authorId = authorId;
		contentAPI.listArticles(opts).then(setArticles);
	}, [authorId]);

	if (articles === null) return <p className="text-muted">Cargando...</p>;

	return (
		<div className="p-8">
			<h1>{heading}</h1>
			<div className="my-4">
				<button
					type="button"
					onClick={() => router.navigate("/admin/publish")}
					className="px-4 py-2 bg-button text-tprimary rounded-xxl"
				>
					+ Nuevo artículo
				</button>
			</div>
			{articles.length === 0 ? (
				<p className="text-muted">No hay artículos.</p>
			) : (
				<ul className="flex flex-col gap-2">
					{articles.map((a) => {
						const s = status(a);
						return (
							<li key={a.slug} className="p-3 bg-surface rounded-xxl shadow-cozy flex items-center justify-between gap-2">
								<a
									href={`/admin/articles/${a.slug}`}
									onClick={(e) => {
										e.preventDefault();
										router.navigate(`/admin/articles/${a.slug}`);
									}}
									className="underline text-text"
								>
									{a.title}
								</a>
								<span className={`text-sm font-medium ${s.cls}`}>{s.text}</span>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

export function AdminArticlesPage() {
	return <AdminGate>{(session, isReviewer) => <ArticlesList authorId={isReviewer ? undefined : session.user?.id} />}</AdminGate>;
}
