import type { FastifyRequest, FastifyReply } from "../../../../interfaces/modules/providers/IHttpServer.js";
import { UncommonResponse, type RegisteredEndpoint, type EndpointCtx, type AuthenticatedUserInfo } from "../types.js";
import ADCCustomError from "@common/types/ADCCustomError.js";
import type SessionManagerService from "../../../security/SessionManagerService/index.ts";
import type { ILogger } from "../../../../interfaces/utils/ILogger.d.ts";

function extractToken(
	req: FastifyRequest<any>,
	getSessionManager: () => SessionManagerService | null,
): string | null {
	// 1. Intentar desde cookie via SessionManager
	const sessionManager = getSessionManager();
	if (sessionManager) {
		const cookieToken = sessionManager.extractSessionToken(req as any);
		if (cookieToken) return cookieToken;
	}

	// 2. Intentar desde header Authorization
	const authHeader = req.headers?.authorization;
	if (authHeader && authHeader.startsWith("Bearer ")) {
		return authHeader.substring(7);
	}

	// 3. Intentar desde query parameter (para WebSockets, etc.)
	const queryToken = (req.query as any)?.token;
	if (queryToken) {
		return queryToken;
	}

	return null;
}

export function createHttpWrapper(
	endpoint: RegisteredEndpoint,
	getSessionManager: () => SessionManagerService | null,
	logger: ILogger,
): (req: FastifyRequest<any>, reply: FastifyReply<any>) => Promise<void> {
	return async (req: FastifyRequest<any>, reply: FastifyReply<any>) => {
		// Extraer token si existe
		const token = extractToken(req, getSessionManager);

		// Obtener usuario si hay token (ya sea público o protegido)
		let user: AuthenticatedUserInfo | null = null;
		const sessionManager = getSessionManager();
		if (token && sessionManager) {
			const result = await sessionManager.verifyToken(token);
			if (result.valid && result.session) {
				user = result.session.user;
			}
		}

		// Construir EndpointCtx
		const ctx: EndpointCtx<any, any> = {
			params: (req.params as Record<string, string>) || {},
			query: (req.query as Record<string, string | undefined>) || {},
			data: req.body,
			user,
			token,
			cookies: ((req as any).cookies as Record<string, string | undefined>) || {},
			headers: req.headers as Record<string, string | undefined>,
			ip: req.ip,
		};

		try {
			// Llamar al handler (ya incluye validación de permisos en el decorator)
			const result = await endpoint.handler(ctx);

			// El handler devuelve datos, nosotros manejamos la respuesta HTTP
			if (result === undefined || result === null) {
				reply.status(204).send();
			} else {
				reply.status(200).send(result);
			}
		} catch (error: any) {
			// Capturar UncommonResponse para respuestas especiales (cookies, redirects)
			if (error instanceof UncommonResponse) {
				const rep = reply as any;
				// Establecer cookies
				for (const cookie of error.cookies) {
					rep.setCookie(cookie.name, cookie.value, cookie.options || {});
				}
				// Limpiar cookies
				for (const cookie of error.clearCookies) {
					rep.clearCookie(cookie.name, cookie.options || {});
				}
				// Establecer headers custom
				for (const [name, value] of Object.entries(error.headers)) {
					reply.header(name, value);
				}
				// Redirect o JSON
				if (error.type === "redirect") {
					reply.status(error.status).redirect(error.redirectUrl!);
				} else {
					reply.status(error.status).send(error.body);
				}
				return;
			}

			// Capturar ADCCustomError (HttpError y otros) para errores de negocio
			else if (error instanceof ADCCustomError) {
				reply.status(error.status).send(error.toJSON());
				return;
			}

			// Error inesperado
			logger.logError(`Error en endpoint ${endpoint.method} ${endpoint.url}: ${error.message}`);

			reply.status(500).send({
				error: "INTERNAL_ERROR",
				message: process.env.NODE_ENV === "development" ? error.message : "Error interno del servidor",
			});
		}
	};
}
