import * as messageCreateEvent       from "../events/messageCreate.js";
import * as messageDeleteEvent       from "../events/messageDelete.js";
import * as messageUpdateEvent       from "../events/messageUpdate.js";
import * as guildMemberAddEvent      from "../events/guildMemberAdd.js";
import * as guildMemberRemoveEvent   from "../events/guildMemberRemove.js";
import * as guildBanAddEvent         from "../events/guildBanAdd.js";
import * as guildBanRemoveEvent      from "../events/guildBanRemove.js";
import * as messageReactionAddEvent  from "../events/messageReactionAdd.js";
import * as messageReactionRemoveEvent from "../events/messageReactionRemove.js";

export function loadEvents(client) {
  const events = [
    messageCreateEvent,
    messageDeleteEvent,
    messageUpdateEvent,
    guildMemberAddEvent,
    guildMemberRemoveEvent,
    guildBanAddEvent,
    guildBanRemoveEvent,
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
