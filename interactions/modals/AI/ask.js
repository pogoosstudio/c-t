/**
 * @file TaurusAI Ask Modal.
 * @author TechyGiraffe999
 */

/**
 * @type {import("../../../../typings").ModalInteractionCommand}
 */
const fs = require("fs").promises;
const path = require("path");
const { EmbedBuilder } = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
	botInGuild,
	getSafetySettings,
	handleGeminiError,
	handleResponse,
} = require("../../../functions/other/utils");
const { QuickDB } = require("quick.db");
const db = new QuickDB({
	filePath: path.join(__dirname, "../../../functions/other/settings.sqlite"),
});

module.exports = {
	id: "taurus_ai",

	async execute(interaction) {
		const apiKeys = await db.get("apiKeys");
		const geminiApiKey = apiKeys.gemini;
		const modelSettings = await db.get("model");
		let modelId = modelSettings.model;
		const genAI = new GoogleGenerativeAI(geminiApiKey);

		const personalityFilePath = path.join(
			__dirname + "../../../../personality.txt",
		);
		const personalityContent = await fs.readFile(personalityFilePath, "utf-8");
		const personalityLines = personalityContent.split("\n");

		const userQuestion =
			interaction.fields.getTextInputValue("question_taurusai");

		const sendTypingInterval =
			interaction.inGuild() && botInGuild(interaction)
				? setInterval(() => {
						interaction.channel.sendTyping();
					}, 5000)
				: null;

		let loadingInterval;
		let loadingMsg;

		async function run() {
			const loadingEmbed = new EmbedBuilder()
				.setTitle("**Loading your response . . .**")
				.setDescription(
					"*TaurusAI may display innacurate/offensive info.*\n\n> *I am powered by Google's Generative AI, [Gemini](https://gemini.google.com) and was integrated by <@719815864135712799>.*",
				)
				.setFooter({
					text: "⏳ This may take a while",
					iconURL: interaction.user.displayAvatarURL(),
				})
				.setTimestamp();
			loadingMsg = loadingMsg
				? await loadingMsg.edit({ embeds: [loadingEmbed] })
				: await interaction.reply({ embeds: [loadingEmbed] });
			const loadingDots = ["", " .  ", " . . ", " . . ."];
			let i = 0;
			const loadingInterval = setInterval(async () => {
				loadingEmbed.setTitle(`**Loading your response ${loadingDots[i]}**`);
				await loadingMsg.edit({ embeds: [loadingEmbed] });
				i = (i + 1) % loadingDots.length;
			}, 500);

			const user_status =
				interaction.inGuild() && botInGuild(interaction)
					? interaction.member?.presence.clientStatus
					: {};

			const status_devices = Object.entries(user_status)
				.map(([platform, status]) => `${platform}: ${status}`)
				.join("\n");

			instruction = `${personalityLines}\n Please greet the user with a greeting and then their name which is: <@${interaction.user.id}> and limit your responses to 2000 characters or less.`;

			if (Object.keys(user_status).length) {
				instruction += ` The user's status/presence is currently:\n${status_devices}`;
			}

			const generationConfig = {
				maxOutputTokens: 750,
			};

			const model = genAI.getGenerativeModel({
				model: modelId,
				systemInstruction: instruction,
				safetySettings: await getSafetySettings(),
				generationConfig,
			});

			const chat = model.startChat({
				generationConfig: {
					maxOutputTokens: 750,
				},
			});

			clearInterval(loadingInterval);
			clearInterval(sendTypingInterval);
			await handleResponse(
				chat,
				userQuestion,
				interaction,
				false,
				loadingMsg,
				"slashCommand",
			);
		}

		let errorType = null;
		do {
			try {
				await run();
				errorType = null;
			} catch (err) {
				clearInterval(loadingInterval);
				sendTypingInterval && clearInterval(sendTypingInterval);

				errorType = await handleGeminiError(err, loadingMsg);

				if (errorType === "quotaErrorBalance") {
					modelId =
						modelId === "gemini-1.5-pro-latest"
							? "gemini-1.5-flash-latest"
							: "gemini-1.5-pro-latest";
				}
			}
		} while (errorType === "quota_error" || errorType === "quotaErrorBalance");
	},
};
