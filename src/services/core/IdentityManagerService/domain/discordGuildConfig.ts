import { Schema } from "mongoose";

/**
 * Configuración de mapeo de roles de Discord por guild.
 * Permite que diferentes guilds (incluyendo guilds de organizaciones)
 * tengan mapeos específicos de roles de Discord → roles de plataforma.
 */
export interface DiscordGuildConfig {
	guildId: string;
	/** Mapeo de Discord Role ID → nombre del rol de plataforma */
	roleMap: Record<string, string>;
	/** Organización asociada (null = guild principal/global) */
	orgId?: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export const discordGuildConfigSchema = new Schema<DiscordGuildConfig>(
	{
		guildId: { type: String, required: true, unique: true },
		roleMap: { type: Schema.Types.Mixed, default: {} },
		orgId: { type: String, default: null },
		createdAt: { type: Date, default: Date.now },
		updatedAt: { type: Date, default: Date.now },
	},
	{ id: false }
);
