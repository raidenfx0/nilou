import * as messageCreateEvent from "../events/messageCreate.js";
import * as messageDeleteEvent from "../events/messageDelete.js";
import * as guildMemberAddEvent from "../events/guildMemberAdd.js";
import * as messageReactionAddEvent from "../events/messageReactionAdd.js";
import * as messageReactionRemoveEvent from "../events/messageReactionRemove.js";

export function loadEvents(client) {
  const events = [
    messageCreateEvent,
    messageDeleteEvent,
    guildMemberAddEvent,
    messageReactionAddEvent,
    messageReactionRemoveEvent,
  ];

  for (const event of events) {
    const handler = (...args) => event.execute(...args);
    if (event.once) {
      client.once(event.name, handler);
    } else {
      client.on(event.name, handler);
    }
  }
}
