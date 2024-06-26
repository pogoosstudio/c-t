/**
 * @file Help Command
 * @author TechyGiraffe999
 */

const { EmbedBuilder, SlashCommandBuilder, Embed } = require("discord.js");

/**
 * @type {import('../../../typings').SlashInteractionCommand}
 */
module.exports = {
	data: new SlashCommandBuilder()
		.setName("help")
		.setDescription("Mostrar los comandos disponibles"),
	async execute(interaction) {
		const commands = (
			await interaction.client.application.commands.fetch()
		).filter((command) => command.type === 1);

		const commandList = commands
			.map(
				(command) =>
					`**</${command.name}:${command.id}>**: ${command.description}`,
			)
			.join("\n");

		const embed = new EmbedBuilder()
			.setTitle("⚙️ Comandos disponibles")
			.setDescription(commandList)
			.setColor("Blurple");

		await interaction.reply({ embeds: [embed] });
	},
};
