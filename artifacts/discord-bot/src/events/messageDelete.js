import { Events, EmbedBuilder } from "discord.js";
import { ghostPingChannels } from "../data/store.js";

export const name = Events.MessageDelete;

export async function execute(message) {
  if (!message.guild) return;
  if (message.author?.bot) return;

  const logChannelId = ghostPingChannels.get(message.guildId) ?? null;

  const mentionedUsers = message.mentions?.users;
  const mentionedRoles = message.mentions?.roles;

  const hasPings =
    (mentionedUsers && mentionedUsers.size > 0) ||
    (mentionedRoles && mentionedRoles.size > 0) ||
    message.content?.includes("@everyone") ||
    message.content?.includes("@here");

  if (!hasPings) return;

  const channel = logChannelId
    ? message.guild.channels.cache.get(logChannelId)
    : message.channel;

  if (!channel) return;

  const userMentions =
    mentionedUsers?.map((u) => `<@${u.id}>`).join(", ") || "";
  const roleMentions =
    mentionedRoles?.map((r) => `<@&${r.id}>`).join(", ") || "";
  const specialMentions = [];
  if (message.content?.includes("@everyone")) specialMentions.push("@everyone");
  if (message.content?.includes("@here")) specialMentions.push("@here");

  const allPings = [userMentions, roleMentions, specialMentions.join(", ")]
    .filter(Boolean)
    .join(", ");

  const embed = new EmbedBuilder()
    .setColor(0xff4444)
    .setTitle("👻 Ghost Ping Detected")
    .addFields(
      {
        name: "Author",
        value: `<@${message.author?.id}> (${message.author?.tag || "Unknown"})`,
        inline: true,
      },
      { name: "Channel", value: `<#${message.channelId}>`, inline: true },
      {
        name: "Pinged",
        value: allPings || "Unknown",
        inline: false,
      },
      {
        name: "Deleted Message",
        value: message.content
          ? message.content.slice(0, 1024)
          : "*[no text content]*",
        inline: false,
      },
      {
        name: "Time",
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: true,
      }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}
