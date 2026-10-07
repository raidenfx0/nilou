import { boosterConfigs, twitchSubscriberConfigs } from "../data/store.js";
import { buildSupportEmbed, renderSupportText } from "../utils/supportEmbeds.js";

export const name = "guildMemberUpdate";

function hasEmbedContent(template = {}) {
  return Boolean(
    template.title?.trim()
    || template.description?.trim()
    || template.footer?.trim()
    || template.imageUrl?.trim()
    || template.thumbnailUrl?.trim()
  );
}

async function sendAnnouncement(member, config, variables, label) {
  if (!config?.enabled || !config.channelId) return;
  try {
    const channel = await member.guild.channels.fetch(config.channelId).catch(() => null);
    if (!channel?.isTextBased?.()) {
      console.warn(`${label} announcement channel is unavailable in guild ${member.guild.id}`);
      return;
    }

    const content = renderSupportText(config.content, variables).trim().slice(0, 2000);
    const payload = {
      allowedMentions: { parse: [], users: [member.id] },
    };
    if (content) payload.content = content;
    if (hasEmbedContent(config.embed)) {
      payload.embeds = [buildSupportEmbed(config.embed, variables)];
    }
    if (!content && !payload.embeds) return;

    await channel.send(payload);
  } catch (error) {
    console.error(`Could not send ${label} announcement in guild ${member.guild.id}:`, error);
  }
}

function announcementVariables(member, additional = {}) {
  return {
    user: `<@${member.id}>`,
    "user.name": member.user.username,
    "user.tag": member.user.tag || member.user.username,
    server: member.guild.name,
    ...additional,
  };
}

export async function execute(oldMember, newMember) {
  const guildId = newMember.guild.id;

  if (!oldMember.premiumSinceTimestamp && newMember.premiumSinceTimestamp) {
    const config = boosterConfigs.get(guildId);
    await sendAnnouncement(
      newMember,
      config,
      announcementVariables(newMember, {
        boosts: String(newMember.guild.premiumSubscriptionCount ?? 0),
        tier: String(newMember.guild.premiumTier ?? 0),
      }),
      "server boost",
    );
  }

  const twitchConfig = twitchSubscriberConfigs.get(guildId);
  const roleId = twitchConfig?.roleId;
  if (
    twitchConfig?.enabled
    && roleId
    && !oldMember.roles.cache.has(roleId)
    && newMember.roles.cache.has(roleId)
  ) {
    const role = newMember.guild.roles.cache.get(roleId);
    await sendAnnouncement(
      newMember,
      twitchConfig,
      announcementVariables(newMember, {
        role: role?.name || "Twitch subscriber",
        subscriberRole: `<@&${roleId}>`,
      }),
      "Twitch subscriber",
    );
  }
}
