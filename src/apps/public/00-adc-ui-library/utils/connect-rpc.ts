/**
 * Cliente Connect RPC real usando @connectrpc/connect-web
 * Proporciona acceso tipado a los servicios definidos en Protocol Buffers
 *
 * - Desarrollo: JSON (protocolo Connect) para debugging fácil
 * - Producción: gRPC-web (binario) para eficiencia
 */

import { createClient, type Client } from "@connectrpc/connect";
import { createConnectTransport, createGrpcWebTransport } from "@connectrpc/connect-web";
import { LearningService } from "@common/ADC/gen/learning/learning_pb.js";

// Configuración del transporte
// Detectamos desarrollo por hostname (localhost = dev server con backend en :3000)
const isDevelopment = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const baseUrl = isDevelopment ? "http://localhost:3000" : "";

// JSON en desarrollo para debugging, gRPC-web binario en producción
const transport = isDevelopment
	? createConnectTransport({ baseUrl })
	: createGrpcWebTransport({ baseUrl });

/**
 * Cliente tipado para LearningService
 * Uso:
 *   const paths = await learningClient.listPaths({});
 *   const article = await learningClient.getArticle({ slug: "my-article" });
 */
export const learningClient: Client<typeof LearningService> = createClient(LearningService, transport);

// Re-exportar tipos útiles para los consumidores
export type {
	LearningPath,
	Article,
	PathItem,
	Image,
	ListPathsRequest,
	ListPathsResponse,
	GetPathRequest,
	GetPathResponse,
	CreatePathRequest,
	CreatePathResponse,
	UpdatePathRequest,
	UpdatePathResponse,
	DeletePathRequest,
	DeletePathResponse,
	ListArticlesRequest,
	ListArticlesResponse,
	GetArticleRequest,
	GetArticleResponse,
	CreateArticleRequest,
	CreateArticleResponse,
	UpdateArticleRequest,
	UpdateArticleResponse,
	DeleteArticleRequest,
	DeleteArticleResponse,
} from "@common/ADC/gen/learning/learning_pb.js";

export { PathItemType, PathItemLevel } from "@common/ADC/gen/learning/learning_pb.js";
