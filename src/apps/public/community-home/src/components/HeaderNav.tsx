import "@ui-library/utils/react-jsx";
import { useEffect, useState } from "react";
import { getSession } from "@ui-library/utils/session";
import { canEditContent, canPublish } from "../utils/permissions";

/**
 * Contenido dinámico para el header del layout.
 * Muestra enlaces de administración sólo cuando el usuario tiene permisos.
 */
export default function HeaderNav() {
	const [showAdmin, setShowAdmin] = useState(false);
	const [showPublish, setShowPublish] = useState(false);

	useEffect(() => {
		getSession().then((s) => {
			const perms = s.user?.permissions || [];
			setShowAdmin(s.authenticated && canEditContent(perms));
			setShowPublish(s.authenticated && canPublish(perms));
		});
	}, []);

	return (
		<ul className="flex flex-wrap items-center gap-x-10">
			<li>
				<a href="/articles" className="hover:underline">
					Artículos
				</a>
			</li>
			<li>
				<a href="/paths" className="hover:underline">
					Paths
				</a>
			</li>
			{showAdmin && (
				<>
					<li>
						<a href="/admin/articles" className="hover:underline">
							Mis artículos
						</a>
					</li>
					<li>
						<a href="/admin/publish" className="hover:underline">
							Publicar
						</a>
					</li>
				</>
			)}
			{showPublish && (
				<li>
					<a href="/admin/paths" className="hover:underline">
						Paths admin
					</a>
				</li>
			)}
		</ul>
	);
}
