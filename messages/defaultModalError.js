/**
 * @file Default Error Message On Error Modal Interaction
 * @author Naman Vrati & TechyGiraffe999
 */
const { EmbedBuilder } = require("discord.js");

const error = new EmbedBuilder()
	.setDescription(
		"**¡Hubo un problema al obtener este modal!\n\nPor favor contacte a los Desarrolladores.**",
	)
	.setColor("Red");

module.exports = {
	/**
	 * @description Executes when the modal interaction could not be fetched.
	 * @author Naman Vrati
	 * @param {import('discord.js').ModalSubmitInteraction} interaction The Interaction Object of the command.
	 */

	async execute(interaction) {
		await interaction.reply({
			embeds: [error],
			ephemeral: true,
		});
		return;
	},
};
