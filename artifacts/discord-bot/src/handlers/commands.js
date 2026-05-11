import { Collection } from "discord.js";
import * as embedCmd         from "../commands/embed.js";
import * as timestampCmd     from "../commands/timestamp.js";
import * as stickyCmd        from "../commands/sticky.js";
import * as purgeCmd         from "../commands/purge.js";
import * as welcomeCmd       from "../commands/welcome.js";
import * as ghostpingCmd     from "../commands/ghostping.js";
import * as reactionroleCmd  from "../commands/reactionrole.js";
import * as adminroleCmd     from "../commands/adminrole.js";
import * as pingCmd          from "../commands/ping.js";
import * as botinfoCmd       from "../commands/botinfo.js";
import * as serverinfoCmd    from "../commands/serverinfo.js";
import * as countdownCmd     from "../commands/countdown.js";
import * as helpCmd          from "../commands/help.js";
import * as musichelpCmd     from "../commands/musichelp.js";
import * as musicCmd         from "../commands/music.js";
import * as afkCmd           from "../commands/afk.js";
import * as ticketCmd        from "../commands/ticket.js";
import * as giveawayCmd      from "../commands/giveaway.js";
import * as triggerCmd       from "../commands/trigger.js";
import * as nilouCmd         from "../commands/nilou.js";
import * as registerCmd      from "../commands/register.js";
import * as aboutCmd         from "../commands/about.js";
import * as profileCmd       from "../commands/profile.js";
import * as listCmd          from "../commands/list.js";
import * as buildCmd         from "../commands/build.js";
import * as cvCalcCmd        from "../commands/cv_calc.js";
import * as topArtifactsCmd  from "../commands/top_artifacts.js";
import * as banCmd           from "../commands/ban.js";
import * as kickCmd          from "../commands/kick.js";
import * as timeoutCmd       from "../commands/timeout.js";
import * as roleCmd          from "../commands/role.js";
import * as echoCmd          from "../commands/echo.js";
import * as emojihuntCmd     from "../commands/emojihunt.js";
import * as warnCmd          from "../commands/warn.js";
import * as loggingCmd       from "../commands/logging.js";
import * as economyCmd       from "../commands/economy.js";
import * as gamblingCmd      from "../commands/gambling.js";
import * as countingCmd      from "../commands/counting.js";
import * as collectCmd       from "../commands/collect.js";

export function loadCommands(client) {
  client.commands = new Collection();

  const commands = [
    embedCmd, timestampCmd, stickyCmd, purgeCmd, welcomeCmd,
    ghostpingCmd, reactionroleCmd, adminroleCmd, pingCmd, botinfoCmd,
    serverinfoCmd, countdownCmd, helpCmd, musichelpCmd, musicCmd,
    afkCmd, ticketCmd, giveawayCmd, triggerCmd, nilouCmd,
    registerCmd, aboutCmd, profileCmd, listCmd, buildCmd, cvCalcCmd,
    topArtifactsCmd, banCmd, kickCmd, timeoutCmd,
    roleCmd, echoCmd, emojihuntCmd,
    warnCmd, loggingCmd, economyCmd, gamblingCmd, countingCmd,
    collectCmd,
  ];

  for (const cmd of commands) {
    if (cmd.data && cmd.data.name) {
      client.commands.set(cmd.data.name, cmd);
    }
  }

  return client.commands;
}
