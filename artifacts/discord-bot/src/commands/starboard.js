import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { starboardConfig } from "../data/store.js";
import { upsertGuildSettings, getStarboardStats } from "../db/index.js";
import { NILOU_RED, FOOTER_MAIN } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("starboard")
  .setDescription("Manage the starboard — where starred messages shine!")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub.setName("setup").setDescription("Set the starboard channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel for starred messages").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("remove").setDescription("Remove the starboard"))
  .addSubcommand(sub => sub.setName("emoji").setDescription("Set the star emoji (default: ⭐)")
    .addStringOption(o => o.setName("emoji").setDescription("Emoji to use for starring (can be custom emoji)").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("threshold").setDescription("Set the minimum star count (default: 3)")
    .addIntegerOption(o => o.setName("count").setDescription("Minimum stars needed to show on starboard").setRequired(true).setMinValue(1).setMaxValue(50))
  )
  .addSubcommand(sub => sub.setName("self").setDescription("Toggle self-starring (default: off)")
    .addBooleanOption(o => o.setName("enabled").setDescription("Allow users to star their own messages?").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("blacklist").setDescription("Block a channel from starboard")
    .addChannelOption(o => o.setName("channel").setDescription("Channel to blacklist").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("unblacklist").setDescription("Unblock a channel from starboard")
    .addChannelOption(o => o.setName("channel").setDescription("Channel to unblock").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("stats").setDescription("View starboard statistics"))
  .addSubcommand(sub => sub.setName("config").setDescription("View current starboard configuration"));

export async function execute(interaction) {
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guildId;
  let   cfg     = starboardConfig.get(guildId) || { enabled: false, channelId: null, emoji: "⭐", threshold: 3, selfStar: false, blacklist: [] };

  if (sub === "setup") {
    const channel = interaction.options.getChannel("channel");
    cfg = { ...cfg, enabled: true, channelId: channel.id };
    starboardConfig.set(guildId, cfg);
    await upsertGuildSettings(guildId, {
      starboard_channel_id: channel.id,
      starboard_enabled: true,
      starboard_emoji: cfg.emoji,
      starboard_threshold: cfg.threshold,
      starboard_self_star: cfg.selfStar,
    });
    return interaction.reply({
      content: `⭐ Starboard set to <#${channel.id}>! Messages with **${cfg.threshold}** ${cfg.emoji} reactions will be posted.`,
      ephemeral: true,
    });
  }

  if (sub === "remove") {
    if (!cfg.enabled) return interaction.reply({ content: "💧 No starboard is set up.", ephemeral: true });
    starboardConfig.set(guildId, { enabled: false, channelId: null, emoji: "⭐", threshold: 3, selfStar: false, blacklist: cfg.blacklist });
    await upsertGuildSettings(guildId, { starboard_enabled: false, starboard_channel_id: null });
    return interaction.reply({ content: "⭐ Starboard removed. Messages will no longer be starred.", ephemeral: true });
  }

  if (sub === "emoji") {
    const emoji = interaction.options.getString("emoji").trim();
    cfg.emoji = emoji;
    starboardConfig.set(guildId, cfg);
    await upsertGuildSettings(guildId, { starboard_emoji: emoji });
    return interaction.reply({ content: `Emoji set to ${emoji}`, ephemeral: true });
  }

  if (sub === "threshold") {
    const count = interaction.options.getInteger("count");
    cfg.threshold = count;
    starboardConfig.set(guildId, cfg);
    await upsertGuildSettings(guildId, { starboard_threshold: count });
    return interaction.reply({ content: `⭐ Starboard threshold set to **${count}** stars.`, ephemeral: true });
  }

  if (sub === "self") {
    const enabled = interaction.options.getBoolean("enabled");
    cfg.selfStar = enabled;
    starboardConfig.set(guildId, cfg);
    await upsertGuildSettings(guildId, { starboard_self_star: enabled });
    return interaction.reply({ content: `Self-starring is now **${enabled ? "enabled" : "disabled"}**.`, ephemeral: true });
  }

  if (sub === "blacklist") {
    const channel = interaction.options.getChannel("channel");
    const bl = [...(cfg.blacklist || [])];
    if (!bl.includes(channel.id)) bl.push(channel.id);
    cfg.blacklist = bl;
    starboardConfig.set(guildId, cfg);
    await upsertGuildSettings(guildId, { starboard_blacklist: JSON.stringify(bl) });
    return interaction.reply({ content: `🚫 <#${channel.id}> is now blacklisted from starboard.`, ephemeral: true });
  }

  if (sub === "unblacklist") {
    const channel = interaction.options.getChannel("channel");
    const bl = [...(cfg.blacklist || [])].filter(c => c !== channel.id);
    cfg.blacklist = bl;
    starboardConfig.set(guildId, cfg);
    await upsertGuildSettings(guildId, { starboard_blacklist: JSON.stringify(bl) });
    return interaction.reply({ content: `⭐ <#${channel.id}> is now unblocked from starboard.`, ephemeral: true });
  }

  if (sub === "stats") {
    const stats = await getStarboardStats(guildId);
    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle("⭐ Starboard Statistics")
      .addFields(
        { name: "📰 Total Entries", value: String(stats.total || 0), inline: true },
        { name: "💡 Total Stars Given", value: String(stats.totalStars || 0), inline: true },
        { name: "🏆 Top Starred", value: stats.top || "No entries yet", inline: true },
      )
      .setFooter(FOOTER_MAIN).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === "config") {
    const embed = new EmbedBuilder().setColor(NILOU_RED)
      .setTitle("⭐ Starboard Configuration")
      .addFields(
        { name: "Enabled",     value: cfg.enabled ? "✅ Yes" : "❌ No", inline: true },
        { name: "Channel",     value: cfg.channelId ? `<#${cfg.channelId}>` : "Not set", inline: true },
        { name: "Emoji",       value: cfg.emoji || "⭐", inline: true },
        { name: "Threshold",   value: String(cfg.threshold || 3), inline: true },
        { name: "Self Star",   value: cfg.selfStar ? "✅ Yes" : "❌ No", inline: true },
        { name: "Blacklisted", value: (cfg.blacklist?.length || 0) + " channels", inline: true },
      )
      .setFooter(FOOTER_MAIN).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
