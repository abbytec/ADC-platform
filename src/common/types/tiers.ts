/**
 * Tier de la cuenta (usuario u organización). Concepto transversal a toda la
 * plataforma — distintos servicios (PM, storage, etc.) consumen este tier para
 * derivar sus propios límites.
 *
 * Hoy todas las cuentas son `free`.
 */

export type AccountTier = "free";
