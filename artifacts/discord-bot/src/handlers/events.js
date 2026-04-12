import * as messageCreateEvent from "../events/messageCreate.js";
import * as messageDeleteEvent from "../events/messageDelete.js";
import * as guildMemberAddEvent from "../events/guildMemberAdd.js";
import * as messageReactionAddEvent from "../events/messageReactionAdd.js";
import * as messageReactionRemoveEvent from "../events/messageReactionRemove.js";

/**
 * Loads and registers event handlers for the Discord client.
 * @param {import('discord.js').Client} client - The Discord client instance.
 */
export function loadEvents(client) {
  const events = [
    messageCreateEvent,
    messageDeleteEvent,
    guildMemberAddEvent,
    messageReactionAddEvent,
    messageReactionRemoveEvent,
  ];

  for (const event of events) {
    // Create a handler that passes all arguments to the event's execute function
    const handler = (...args) => event.execute(...args);

    if (event.once) {
      client.once(event.name, handler);
    } else {
      client.on(event.name, handler);
    }
  }
}