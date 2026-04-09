import { Collection } from "discord.js";
import * as embedCmd       from "../commands/embed.js";
import * as timestampCmd   from "../commands/timestamp.js";
import * as stickyCmd      from "../commands/sticky.js";
import * as purgeCmd       from "../commands/purge.js";
import * as welcomeCmd     from "../commands/welcome.js";
import * as ghostpingCmd   from "../commands/ghostping.js";
import * as reactionroleCmd from "../commands/reactionrole.js";
import * as adminroleCmd   from "../commands/adminrole.js";
import * as pingCmd        from "../commands/ping.js";
import * as botinfoCmd     from "../commands/botinfo.js";
import * as serverinfoCmd  from "../commands/serverinfo.js";
import * as countdownCmd   from "../commands/countdown.js";

export function loadCommands(client) {
  client.commands = new Collection();

  const commands = [
    embedCmd,
    timestampCmd,
    stickyCmd,
    purgeCmd,
    welcomeCmd,
    ghostpingCmd,
    reactionroleCmd,
    adminroleCmd,
    pingCmd,
    botinfoCmd,
    serverinfoCmd,
    countdownCmd,
  ];

  for (const cmd of commands) {
    client.commands.set(cmd.data.name, cmd);
  }

  return client.commands;
}
