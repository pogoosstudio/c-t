/**
 * @file Main File of the bot, responsible for registering events, commands, interactions etc.
 * @author Naman Vrati
 * @contributor TechyGiraffe999
 * @since 1.0.0
 * @version 3.3.0
 */

// Declare constants which will be used throughout the bot.

const fs = require("fs");
const {
	Client,
	Collection,
	GatewayIntentBits,
	Partials,
	REST,
	Routes,
	SlashCommandBuilder,
} = require("discord.js");
const { token, client_id } = require("./config.json");

/**
 * From v13, specifying the intents is compulsory.
 * @type {import('./typings').Client}
 * @description Main Application Client */

// @ts-ignore
const client = new Client({
	// Please add all intents you need, more detailed information @ https://ziad87.net/intents/
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildPresences,
	],
	partials: [Partials.Channel],
});

/**********************************************************************/
// Below we will be making an event handler!

/**
 * @description All event files of the event handler.
 * @type {String[]}
 */

const eventFiles = fs
	.readdirSync("./events")
	.filter((file) => file.endsWith(".js"));

// Loop through all files and execute the event when it is actually emmited.
for (const file of eventFiles) {
	const event = require(`./events/${file}`);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args, client));
	} else {
		client.on(
			event.name,
			async (...args) => await event.execute(...args, client),
		);
	}
}

/**********************************************************************/
// Define Collection of Slash/Modal Commands and Cooldowns

client.slashCommands = new Collection();
client.buttonCommands = new Collection();
client.modalCommands = new Collection();
client.contextCommands = new Collection();
client.cooldowns = new Collection();
client.autocompleteInteractions = new Collection();
client.functions = new Collection();

/**********************************************************************/
// Registration of Slash-Command Interactions.

/**
 * @type {String[]}
 * @description All slash commands.
 */

const slashCommands = fs.readdirSync("./interactions/slash");

// Loop through all files and store slash-commands in slashCommands collection.

for (const module of slashCommands) {
	const commandFiles = fs
		.readdirSync(`./interactions/slash/${module}`)
		.filter((file) => file.endsWith(".js"));

	for (const commandFile of commandFiles) {
		const command = require(`./interactions/slash/${module}/${commandFile}`);
		client.slashCommands.set(command.data.name, command);
	}
}

/**********************************************************************/
// Registration of Autocomplete Interactions.

/**
 * @type {String[]}
 * @description All autocomplete interactions.
 */

const autocompleteInteractions = fs.readdirSync("./interactions/autocomplete");

// Loop through all files and store autocomplete interactions in autocompleteInteractions collection.

for (const module of autocompleteInteractions) {
	const files = fs
		.readdirSync(`./interactions/autocomplete/${module}`)
		.filter((file) => file.endsWith(".js"));

	for (const interactionFile of files) {
		const interaction = require(
			`./interactions/autocomplete/${module}/${interactionFile}`,
		);
		client.autocompleteInteractions.set(interaction.name, interaction);
	}
}

/**********************************************************************/
// Registration of Context-Menu Interactions

/**
 * @type {String[]}
 * @description All Context Menu commands.
 */

const contextMenus = fs.readdirSync("./interactions/context-menus");

// Loop through all files and store context-menus in contextMenus collection.

for (const folder of contextMenus) {
	const files = fs
		.readdirSync(`./interactions/context-menus/${folder}`)
		.filter((file) => file.endsWith(".js"));
	for (const file of files) {
		const menu = require(`./interactions/context-menus/${folder}/${file}`);
		const keyName = `${folder.toUpperCase()} ${menu.data.name}`;
		client.contextCommands.set(keyName, menu);
	}
}

/**********************************************************************/
// Registration of Button-Command Interactions.

/**
 * @type {String[]}
 * @description All button commands.
 */

const buttonCommands = fs.readdirSync("./interactions/buttons");

// Loop through all files and store button-commands in buttonCommands collection.

for (const module of buttonCommands) {
	const commandFiles = fs
		.readdirSync(`./interactions/buttons/${module}`)
		.filter((file) => file.endsWith(".js"));

	for (const commandFile of commandFiles) {
		const command = require(`./interactions/buttons/${module}/${commandFile}`);
		for (const id of command.id) {
			client.buttonCommands.set(id, command);
		}
	}
}

/**********************************************************************/
// Registration of Modal-Command Interactions.

/**
 * @type {String[]}
 * @description All modal commands.
 */

const modalCommands = fs.readdirSync("./interactions/modals");

// Loop through all files and store modal-commands in modalCommands collection.

for (const module of modalCommands) {
	const commandFiles = fs
		.readdirSync(`./interactions/modals/${module}`)
		.filter((file) => file.endsWith(".js"));

	for (const commandFile of commandFiles) {
		const command = require(`./interactions/modals/${module}/${commandFile}`);
		if (Array.isArray(command.id)) {
			for (const id of command.id) {
				client.modalCommands.set(id, command);
			}
		} else {
			client.modalCommands.set(command.id, command);
		}
	}
}

/**********************************************************************/
// Registration of Functions

/**
 * @type {String[]}
 * @description All functions.
 */

client.once("ready", () => {
	const functionFiles = fs.readdirSync("./functions");

	for (const functionFile of functionFiles) {
		if (functionFile.endsWith(".js")) {
			const func = require(`./functions/${functionFile}`);
			client.functions.set(functionFile.replace(".js", ""), func);
			func(client);
		}
	}
});

/**********************************************************************/
// Registration of Slash-Commands in Discord API

const rest = new REST({ version: "9" }).setToken(token);

const commandJsonData = [
	...Array.from(client.slashCommands.values()).map((c) => {
		const commandData =
			c.data instanceof SlashCommandBuilder ? c.data.toJSON() : c.data;
		commandData.integration_types = [0, 1];
		commandData.contexts = [0, 1, 2];
		return commandData;
	}),
	...Array.from(client.contextCommands.values()).map((c) => {
		const commandData = c.data;
		commandData.integration_types = [0, 1];
		commandData.contexts = [0, 1, 2];
		return commandData;
	}),
];

(async () => {
	try {
		console.log("Comenzó a actualizar los comandos de la aplicación (/).");

		await rest.put(
			Routes.applicationCommands(client_id),

			{ body: commandJsonData },
		);

		console.log("Comandos de aplicación (/) recargados correctamente.");
	} catch (error) {
		console.error(error);
	}
})();

// Login into your client application with bot's token.

client.login(token);

/**********************************************************************/
// Anti Crash script
process.on("unhandledRejection", (reason, promise) => {
	console.error(`🚫 Error crítico detectado:\n\n`, reason, promise);

	// Uncomment the below lines below to see the full error details. - ADVANCED DEBUGGING //

	// console.dir(reason, { showHidden: true, depth: null });
	// console.log("Promise: ", promise);
});

process.on("uncaughtException", (error, origin) => {
	console.error(`🚫 Error crítico detectado:\n\n`, error, origin);

	// Uncomment the below lines below to see the full error details. - ADVANCED DEBUGGING //

	// console.dir(error, { showHidden: true, depth: null });
	// console.log("Origin: ", origin);
});
