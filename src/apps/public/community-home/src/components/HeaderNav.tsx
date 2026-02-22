import "@ui-library/utils/react-jsx";

/**
 * Contenido dinámico para el header del layout.
 * Este componente se exporta como remote y es consumido por adc-layout.
 */
export default function HeaderNav() {
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
		</ul>
	);
}
