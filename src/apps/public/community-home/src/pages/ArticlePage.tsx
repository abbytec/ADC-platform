import { useEffect, useState } from "react";
import { router } from "@common/utils/router.js";
import { contentAPI, type Article, type LearningPath } from "../utils/content-api";
import { AUTHORS } from "../utils/constants";

export function ArticlePage({ slug }: { readonly slug: string }) {
	const [article, setArticle] = useState<Article | null>(null);
	const [fromPath, setFromPath] = useState<LearningPath | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Obtener fromPath query param
	const urlParams = new URLSearchParams(globalThis.location?.search);
	const fromPathSlug = urlParams.get("fromPath");

	// URL para compartir
	const shareUrl = typeof globalThis !== "undefined" ? globalThis.location?.href : "";

	useEffect(() => {
		loadArticle();
	}, [slug]);

	async function loadArticle() {
		setLoading(true);
		setError(null);

		try {
			const articleData = await contentAPI.getArticle(slug);
			if (!articleData) {
				setError("Artículo no encontrado");
				return;
			}
			setArticle(articleData);

			// Si viene de un path, cargar info del path
			const pathSlug = fromPathSlug || articleData.pathSlug;
			if (pathSlug) {
				const pathData = await contentAPI.getPath(pathSlug);
				if (pathData) setFromPath(pathData);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error desconocido");
		} finally {
			setLoading(false);
		}
	}

	function handleBack() {
		if (fromPathSlug) {
			router.navigate(`/paths/${fromPathSlug}`);
		} else {
			router.navigate("/articles");
		}
	}

	const pathColorClasses: Record<string, string> = {
		red: "bg-red-200 text-red-700",
		orange: "bg-orange-200 text-orange-700",
		yellow: "bg-yellow-200 text-yellow-700",
		green: "bg-green-200 text-green-700",
		teal: "bg-teal-200 text-teal-700",
		blue: "bg-blue-200 text-blue-700",
		purple: "bg-purple-200 text-purple-700",
		pink: "bg-pink-200 text-pink-700",
	};

	if (loading) {
		return (
			<div style={{ padding: "2rem" }}>
				<div className="text-center py-8">
					<p>Cargando artículo...</p>
				</div>
			</div>
		);
	}

	if (error || !article) {
		return (
			<div style={{ padding: "2rem" }}>
				<div className="text-center py-8">
					<p className="text-red-600">{error || "Artículo no encontrado"}</p>
					<button
						type="button"
						onClick={() => router.navigate("/articles")}
						className="mt-4 px-4 py-2 bg-primary text-tprimary rounded-xxl"
					>
						Volver a artículos
					</button>
				</div>
			</div>
		);
	}

	const pathColor = fromPath?.color || article.pathColor;
	const pathTitle = fromPath?.title || article.pathSlug;
	const colorClass = pathColor ? pathColorClasses[pathColor] || "bg-gray-200 text-gray-700" : "";
	const author = article.authorId ? AUTHORS.get(article.authorId) : null;

	return (
		<div style={{ padding: "2rem" }}>
			{/* Header con botón volver y breadcrumb */}
			<div className="flex items-center gap-2 mb-4">
				<adc-button class="p-2 mr-4" aria-label="Volver" onClick={handleBack}>
					<adc-icon-left-arrow />
					<span className="sr-only">Volver</span>
				</adc-button>

				<nav aria-label="breadcrumb">
					{fromPathSlug ? (
						<ol className="flex flex-wrap items-center breadcumb">
							<li>
								<a
									href="/paths"
									onClick={(e) => {
										e.preventDefault();
										router.navigate("/paths");
									}}
								>
									Learning Paths
								</a>
							</li>
							<li>
								<a
									href={`/paths/${fromPathSlug}`}
									aria-current="page"
									onClick={(e) => {
										e.preventDefault();
										router.navigate(`/paths/${fromPathSlug}`);
									}}
								>
									{pathTitle}
								</a>
							</li>
						</ol>
					) : (
						<ol className="flex flex-wrap items-center breadcumb">
							<li>
								<a
									href="/articles"
									onClick={(e) => {
										e.preventDefault();
										router.navigate("/articles");
									}}
								>
									Artículos
								</a>
							</li>
							<li aria-current="page">{article.title}</li>
						</ol>
					)}
				</nav>
			</div>

			{/* Título y autor */}
			<div className="flex flex-col gap-2 mb-4 md:flex-row md:items-center">
				<h1>{article.title}</h1>
				{author && <p style={{ color: "#666666" }}>por {author.name}</p>}
				<div className="flex items-center gap-2">
					<adc-share-buttons title={article.title} description={article.description || ""} url={shareUrl} />
				</div>
			</div>

			{/* Badge del path y rating */}
			<div className="flex flex-wrap items-center gap-2 mb-4">
				{pathTitle && (
					<a
						href={`/paths/${fromPathSlug || article.pathSlug}`}
						className={`px-3 py-1 rounded-xl text-sm no-underline ${colorClass}`}
						onClick={(e) => {
							e.preventDefault();
							router.navigate(`/paths/${fromPathSlug || article.pathSlug}`);
						}}
					>
						{pathTitle}
					</a>
				)}
				<adc-star-rating average={null} count={null} myRating={null} canRate={false} pending={false} />
			</div>

			{/* Video si existe */}
			{article.videoUrl && (
				<div style={{ margin: "1rem 0" }}>
					<adc-youtube-facade src={article.videoUrl} title={article.title} />
				</div>
			)}

			{/* Contenido con BlocksRenderer */}
			{article.blocks && article.blocks.length > 0 && <adc-blocks-renderer blocks={article.blocks} />}

			{/* Sección de comentarios */}
			<div className="mt-8">
				<h3>Comentarios</h3>
				<div className="paperWarn rounded-xxl border-default p-6">
					<p className="text-sm">
						Solo los usuarios con rol VIP o Server Booster pueden comentar. Obtén estos roles en nuestro servidor de Discord para
						habilitar comentarios.
					</p>
					<a
						href="https://discord.gg/vShXpyWTTq"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-block mt-4 px-4 py-2 bg-twarn text-warn rounded-xxl hover:brightness-105"
					>
						Unirse al Discord
					</a>
				</div>
			</div>
		</div>
	);
}
