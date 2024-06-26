const { HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { EmbedBuilder, DiscordAPIError, WebhookClient } = require("discord.js");
const { owner } = require("../../config.json");
const path = require("path");
const { QuickDB } = require("quick.db");
const db = new QuickDB({
	filePath: path.join(__dirname, "./settings.sqlite"),
});
const axios = require("axios");

function botInGuild(interaction) {
	const botGuilds = interaction.client.guilds.cache;
	return botGuilds.has(interaction.guildId);
}

async function getSafetySettings() {
	const model = await db.get("model");
	const safetyEnabled = model.safetySystem;

	const safetySettings = [
		{
			category: HarmCategory.HARM_CATEGORY_HARASSMENT,
			threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
		},
		{
			category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
			threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
		},
		{
			category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
			threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
		},
		{
			category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
			threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
		},
	].map((setting) => {
		if (!safetyEnabled) {
			setting.threshold = HarmBlockThreshold.BLOCK_NONE;
		}
		return setting;
	});
	return safetySettings;
}

async function handleGeminiError(err, loadingMsg) {
	switch (err.message) {
		case "[GoogleGenerativeAI Error]: Candidate was blocked due to SAFETY":
			const safety_error = new EmbedBuilder()
				.setTitle("⚠️ An Error Occurred")
				.setDescription(
					"> *The response was blocked due to **SAFETY**.* \n- *Result based on your input. Safety Blocking may not be 100% correct.*",
				)
				.setColor("Red");

			return await loadingMsg.edit({ embeds: [safety_error] });
		case "Cannot send an empty message":
			const error_empty = new EmbedBuilder()
				.setTitle("⚠️ An Error Occurred")
				.setDescription(
					"An error occurred while processing your request. Please try again later, or in a few minutes. \n▸ *If this issue persists, please contact the Developers.* \n> - Generated response may be too long. *(Fix this by specifying for the generated response to be smaller, e.g. 10 Lines)*\n> - Token Limit for this minute may have been reached.",
				)
				.setColor("Red");

			return await loadingMsg.edit({ embeds: [error_empty] });
	}

	switch (err.status) {
		case 400:
			const location_error = new EmbedBuilder()
				.setTitle("⚠️ An Error Occurred")
				.setDescription(
					"> *The user location is not supported for Gemini API use. Please contact the Developers.*",
				)
				.setColor("Red");

			return await loadingMsg.edit({ embeds: [location_error] });
		case 429:
			const quota_error = new EmbedBuilder()
				.setTitle("⚠️ An Error Occurred")
				.setDescription(
					"There are a lot of requests at the moment. Please try again later, or in a few minutes. \n▸ *If this issue persists after a few minutes, please contact the Developers.* \n - *We are aware of these issues and apologize for the inconvenience.* \n> - Token Limit for this minute has been reached.",
				)
				.setColor("Red");

			const model = await db.get("model");
			const fallbackSystem = model.fallbackSystem;
			if (fallbackSystem) {
				return "quotaErrorBalance";
			} else {
				for (let i = 5; i > 0; i--) {
					quota_error.setFooter({ text: `⏱️ Retrying request in (${i})` });
					await loadingMsg.edit({ embeds: [quota_error] });
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
				return "quota_error";
			}
		case 500:
			const error_internal = new EmbedBuilder()
				.setTitle("⚠️ An Error Occurred")
				.setDescription(
					"An error occurred while processing your request. This error originated from Google's side, not ours.  \n▸ *If this issue persists, please contact the Developers.* \n> - Please retry and make another request.",
				)
				.setColor("Red");

			return await loadingMsg.edit({ embeds: [error_internal] });
		case 403:
			const invalid_api = new EmbedBuilder()
				.setTitle("⚠️ Invalid API Key")
				.setDescription(
					"> **The API Key for Gemini is invalid or not provided.**",
				)
				.setColor("Red");
			return await loadingMsg.edit({ embeds: [invalid_api] });
		default:
			console.error(err.message);
			const error_unknown = new EmbedBuilder()
				.setTitle("⚠️ An Error Occurred")
				.setDescription(
					"An unknown error occurred while processing your request. Please try again later, or in a few minutes. \n▸ *If this issue persists, please contact the Developers.*\n> - Token Limit for this minute may have been reached.",
				)
				.setColor("Red");

			return await loadingMsg.edit({ embeds: [error_unknown] });
	}
}

async function handleResponse(
	chat,
	userQuestion,
	interaction,
	message,
	loadingMsg,
	messageDeleted,
	isContextMenuCommand,
) {
	const result = await chat.sendMessage(userQuestion);
	const response = await result.response;
	let responseText = response.text();

	const responseLength = response.text().length;
	if (responseLength > 2000) {
		responseText =
			response.text().substring(0, 1936 - "... \n\n".length) +
			"... \n\n*Response was cut short due to Discords character limit of 2000*";
	}

	const regex = /<@&?\d+>/g;
	let match;

	while ((match = regex.exec(responseText)) !== null) {
		const id =
			message && message.author ? message.author.id : interaction.user.id;

		if (match[0] !== `<@${id}>`) {
			const ping_error = new EmbedBuilder()
				.setTitle("⚠️ Response Cannot Be Sent")
				.setDescription(
					"> *The generated message contains a mention of a Role or different User to the one that sent the original message/command.*",
				)
				.setColor("Red");
			return await loadingMsg.edit({ embeds: [ping_error] });
		}
	}

	let info_embed = [];
	if (isContextMenuCommand) {
		const footerText = `Response to message by ${message.author.tag}\n\n${message.content}`;
		const truncatedFooterText =
			footerText.length > 2030 ? `${footerText.slice(0, 2027)}...` : footerText;

		const info = new EmbedBuilder()
			.setFooter({ text: truncatedFooterText })
			.setColor("Blue");

		info_embed.push(info);
	}

	switch (messageDeleted) {
		case "threadDeleted":
			const deletedThread = new EmbedBuilder()
				.setFooter({
					text: "A message has been deleted/is not accessible in the reply thread, Taurus does not know the past reply thread history.",
				})
				.setColor("Orange");

			info_embed.push(deletedThread);
			break;
		case "slashCommand":
			const deletedSlashCommand = new EmbedBuilder()
				.setFooter({
					text: "Reply thread history not accessible, utilise history by mentioning me to chat instead.",
				})
				.setColor("Orange");

			info_embed.push(deletedSlashCommand);
			break;
		default:
			break;
	}

	// responseText = responseText.replace(/(https?:\/\/(?!media\.discordapp\.net\/attachments\/)[^\s\)]+)/g, "<$1>");
	return await loadingMsg.edit({ content: responseText, embeds: info_embed });
}

async function fetchThreadMessages(message) {
	let threadMessages = [];
	let messageDeleted;
	userQuestion = message.content;

	try {
		const originalMessage = await message.channel.messages.fetch(
			message.reference.messageId,
		);

		const startStrings = [
			"Response to message by",
			"A message has been deleted",
			"Reply thread history",
		];

		const linkRegex =
			/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

		if (
			originalMessage.author.id !== message.client.user.id ||
			(originalMessage.embeds.length > 0 &&
				(!originalMessage.embeds[0].footer ||
					!originalMessage.embeds[0].footer.text ||
					!startStrings.some((str) =>
						originalMessage.embeds[0].footer.text.startsWith(str),
					)) &&
				!linkRegex.test(originalMessage.content))
		) {
			return {
				userQuestion: null,
				threadMessages: null,
				messageDeleted: "threadDeleted",
			};
		}

		if (originalMessage.author.id === message.client.user.id) {
			let currentMessage = message;

			while (
				currentMessage.reference &&
				!(
					currentMessage.author.id === message.client.user.id &&
					currentMessage.embeds.length > 0 &&
					!linkRegex.test(currentMessage.content)
				)
			) {
				currentMessage = await message.channel.messages.fetch(
					currentMessage.reference.messageId,
				);
				const sender =
					currentMessage.author.id === message.client.user.id
						? "model"
						: "user";
				let content = currentMessage.content;
				if (sender === "user") {
					content = content.replace(/<@\d+>\s*/, "");
				} else if (
					sender === "model" &&
					currentMessage.embeds.length > 0 &&
					currentMessage.embeds[0].footer &&
					currentMessage.embeds[0].footer.text &&
					currentMessage.embeds[0].footer.text.startsWith(
						"Response to message by",
					)
				) {
					const footerText = currentMessage.embeds[0].footer.text;
					const userMessage = footerText.split("\n")[2];
					threadMessages.unshift({ role: sender, parts: [{ text: content }] });
					threadMessages.unshift({
						role: "user",
						parts: [{ text: userMessage }],
					});
					continue;
				}
				threadMessages.unshift({ role: sender, parts: [{ text: content }] });
			}
		}
	} catch (error) {
		if (error instanceof DiscordAPIError && error.code === 10008) {
			messageDeleted = "threadDeleted";
			threadMessages = [];
		} else {
			throw error;
		}
	}

	return { userQuestion, threadMessages, messageDeleted };
}

async function checkWebhook(webhookURL) {
	try {
		const webhookClient = new WebhookClient({ url: webhookURL });
		return true;
	} catch (error) {
		return false;
	}
}

const checkAPIKey = async (type, apiKey) => {
	let url, headers;

	switch (type.toLowerCase()) {
		case "prodia":
			url = "https://api.prodia.com/v1/sd/loras";
			headers = { "X-Prodia-Key": apiKey, accept: "application/json" };
			break;
		case "gemini":
			url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
			headers = {};
			break;
		default:
			throw new Error(`Invalid API type: ${type}`);
	}

	try {
		const response = await axios.get(url, { headers });
		return response.status === 200;
	} catch (error) {
		return false;
	}
};

function checkOwnerAndReply(interaction) {
	const no_access = new EmbedBuilder()
		.setDescription("**⚠️ This is limited to Developers Only!**")
		.setColor("Red");

	if (!owner.includes(interaction.user.id)) {
		interaction.reply({
			embeds: [no_access],
			ephemeral: true,
		});
		return false;
	}
	return true;
}

module.exports = {
	botInGuild,
	getSafetySettings,
	handleGeminiError,
	handleResponse,
	fetchThreadMessages,
	checkWebhook,
	checkAPIKey,
	checkOwnerAndReply,
};
