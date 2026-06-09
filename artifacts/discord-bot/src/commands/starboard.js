import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { starboards } from "../data/store.js";
import { createStarboard, deleteStarboard, getStarboard, getStarboardsByGuild, updateStarboard, getStarboardStats } from "../db/index.js";
import { NILOU_RED, FOOTER_MAIN } from "../theme.js";

const starEmoji = "⭐";

export const data = new SlashCommandBuilder()
  .setName("starboard")
  .setDescription("Manage starboards — create multiple starboards with different emojis!")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub.setName("create").setDescription("Create a new starboard")
    .addStringOption(o => o.setName("name").setDescription("Name for this starboard (e.g. 'main', 'heart')").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel for starred messages").setRequired(true))
    .addStringOption(o => o.setName("emoji").setDescription("Emoji to trigger this starboard (e.g. ⭐, ❤️)").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("delete").setDescription("Delete a starboard")
    .addStringOption(o => o.setName("name").setDescription("Name of the starboard to delete").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("list").setDescription("List all starboards in this server"))
  .addSubcommand(sub => sub.setName("threshold").setDescription("Set minimum star count")
    .addStringOption(o => o.setName("name").setDescription("Starboard name").setRequired(true))
    .addIntegerOption(o => o.setName("count").setDescription("Minimum stars needed (1-50)").setRequired(true).setMinValue(1).setMaxValue(50))
  )
  .addSubcommand(sub => sub.setName("self").setDescription("Toggle self-starring")
    .addStringOption(o => o.setName("name").setDescription("Starboard name").setRequired(true))
    .addBooleanOption(o => o.setName("enabled").setDescription("Allow users to star their own messages?").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("blacklist").setDescription("Block a channel from a starboard")
    .addStringOption(o => o.setName("name").setDescription("Starboard name").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel to blacklist").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("unblacklist").setDescription("Unblock a channel from a starboard")
    .addStringOption(o => o.setName("name").setDescription("Starboard name").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel to unblock").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("stats").setDescription("View starboard statistics")
    .addStringOption(o => o.setName("name").setDescription("Starboard name (optional, defaults to all)").setRequired(false))
  )
  .addSubcommand(sub => sub.setName("config").setDescription("View starboard configuration")
    .addStringOption(o => o.setName("name").setDescription("Starboard name (optional, defaults to all)").setRequired(false))
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  const refreshCache = (sb) => {
    starboards.set(`${guildId}:${sb.emoji}`, {
      id: sb.id,
      name: sb.name,
      emoji: sb.emoji,
      channelId: sb.channel_id,
      threshold: sb.threshold,
      selfStar: sb.self_star,
      enabled: sb.enabled,
      blacklist: JSON.parse(sb.blacklist || "[]"),
    });
  };

  if (sub === "create") {
    const name = interaction.options.getString("name").trim().toLowerCase();
    const channel = interaction.options.getChannel("channel");
    const emoji = interaction.options.getString("emoji").trim();
    const sb = await createStarboard(guildId, name, emoji, channel.id);
    refreshCache(sb);
    return interaction.reply({
      content: `${starEmoji} Created starboard **${name}**!\n- Channel: <#${channel.id}>\n- Emoji: ${emoji}\n- Messages with ${sb.threshold} ${emoji} reactions will be posted.`,
      flags: [1 << 6], // ephemeral
    });
  }

  if (sub === "delete") {
    const name = interaction.options.getString("name").trim().toLowerCase();
    const sb = await getStarboard(guildId, name);
    if (!sb) return interaction.reply({ content: `Starboard **${name}** doesn't exist.`, flags: [1 << 6] });
    starboards.delete(`${guildId}:${sb.emoji}`);
    await deleteStarboard(guildId, name);
    return interaction.reply({ content: `${starEmoji} Starboard **${name}** deleted.`, flags: [1 << 6] });
  }

  if (sub === "list") {
    const rows = await getStarboardsByGuild(guildId);
    if (!rows.length) return interaction.reply({ content: "No starboards set up. Use `/starboard create` to make one!", flags: [1 << 6] });
    const lines = rows.map(r => {
      const status = r.enabled ? "✅" : "❌";
      return `${status} **${r.name}** — ${r.emoji} in <#${r.channel_id}> (threshold: ${r.threshold})`;
    });
    return interaction.reply({ content: `${starEmoji} Starboards:\n${lines.join("\n")}`, flags: [1 << 6] });
  }

  if (sub === "threshold") {
    const name = interaction.options.getString("name").trim().toLowerCase();
    const count = interaction.options.getInteger("count");
    const sb = await getStarboard(guildId, name);
    if (!sb) return interaction.reply({ content: `Starboard **${name}** doesn't exist.`, flags: [1 << 6] });
    await updateStarboard(guildId, name, { threshold: count });
    const updated = await getStarboard(guildId, name);
    refreshCache(updated);
    return interaction.reply({ content: `${starEmoji} Starboard **${name}** threshold set to **${count}** ${sb.emoji}.`, flags: [1 << 6] });
  }

  if (sub === "self") {
    const name = interaction.options.getString("name").trim().toLowerCase();
    const enabled = interaction.options.getBoolean("enabled");
    const sb = await getStarboard(guildId, name);
    if (!sb) return interaction.reply({ content: `Starboard **${name}** doesn't exist.`, flags: [1 << 6] });
    await updateStarboard(guildId, name, { self_star: enabled });
    const updated = await getStarboard(guildId, name);
    refreshCache(updated);
    return interaction.reply({ content: `Self-starring on **${name}** is now **${enabled ? "enabled" : "disabled"}**.`, flags: [1 << 6] });
  }

  if (sub === "blacklist") {
    const name = interaction.options.getString("name").trim().toLowerCase();
    const channel = interaction.options.getChannel("channel");
    const sb = await getStarboard(guildId, name);
    if (!sb) return interaction.reply({ content: `Starboard **${name}** doesn't exist.`, flags: [1 << 6] });
    const bl = [...new Set([...JSON.parse(sb.blacklist || "[]"), channel.id])];
    await updateStarboard(guildId, name, { blacklist: JSON.stringify(bl) });
    const updated = await getStarboard(guildId, name);
    refreshCache(updated);
    return interaction.reply({ content: `${starEmoji} <#${channel.id}> blacklisted from **${name}**.`, flags: [1 << 6] });
  }

  if (sub === "unblacklist") {
    const name = interaction.options.getString("name").trim().toLowerCase();
    const channel = interaction.options.getChannel("channel");
    const sb = await getStarboard(guildId, name);
    if (!sb) return interaction.reply({ content: `Starboard **${name}** doesn't exist.`, flags: [1 << 6] });
    const bl = JSON.parse(sb.blacklist || "[]").filter(c => c !== channel.id);
    await updateStarboard(guildId, name, { blacklist: JSON.stringify(bl) });
    const updated = await getStarboard(guildId, name);
    refreshCache(updated);
    return interaction.reply({ content: `${starEmoji} <#${channel.id}> unblocked from **${name}**.`, flags: [1 << 6] });
  }

  if (sub === "stats") {
    const name = interaction.options.getString("name")?.trim().toLowerCase();
    const rows = name ? [await getStarboard(guildId, name)].filter(Boolean) : await getStarboardsByGuild(guildId);
    if (!rows.length) return interaction.reply({ content: "No starboards found.", flags: [1 << 6] });

    const embed = new EmbedBuilder().setColor(NILOU_RED).setTitle("⭐ Starboard Statistics").setFooter(FOOTER_MAIN).setTimestamp();
    const fields = [];
    for (const sb of rows) {
      const stats = await getStarboardStats(guildId, sb.id);
      fields.push({
        name: `${sb.emoji} ${sb.name}`,
        value: `Entries: ${stats.total} | Stars: ${stats.totalStars}\n${stats.top}`,
        inline: true,
      });
    }
    embed.addFields(fields);
    return interaction.reply({ embeds: [embed], flags: [1 << 6] });
  }

  if (sub === "config") {
    const name = interaction.options.getString("name")?.trim().toLowerCase();
    const rows = name ? [await getStarboard(guildId, name)].filter(Boolean) : await getStarboardsByGuild(guildId);
    if (!rows.length) return interaction.reply({ content: "No starboards found.", flags: [1 << 6] });

    const embed = new EmbedBuilder().setColor(NILOU_RED).setTitle("⭐ Starboard Configuration").setFooter(FOOTER_MAIN).setTimestamp();
    const fields = [];
    for (const sb of rows) {
      const bl = JSON.parse(sb.blacklist || "[]");
      fields.push({
        name: `${sb.emoji} ${sb.name}`,
        value: `Enabled: ${sb.enabled ? "✅" : "❌"}\nChannel: <#${sb.channel_id}>\nThreshold: ${sb.threshold}\nSelf-star: ${sb.self_star ? "✅" : "❌"}\nBlacklisted: ${bl.length} channels`,
        inline: true,
      });
    }
    embed.addFields(fields);
    return interaction.reply({ embeds: [embed], flags: [1 << 6] });
  }
}
