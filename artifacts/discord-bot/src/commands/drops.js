import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { dropChannels } from "../data/store.js";
import { upsertGuildSettings } from "../db/index.js";
import { getEmojiString } from "../utils/emojiCache.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";

const E = (name, fallback) => getEmojiString(name) || fallback;

export const data = new SlashCommandBuilder()
  .setName("drops")
  .setDescription("Manage Theater Drops redirect channel")
  .addSubcommand(sub =>
    sub.setName("channel")
      .setDescription("Set a channel to redirect all Theater Drops into")
      .addChannelOption(opt =>
        opt.setName("channel")
          .setDescription("The channel where drops should appear")
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName("disable")
      .setDescription("Disable drops redirect and let them appear in their original channel")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();

  if (sub === "channel") {
    const channel = interaction.options.getChannel("channel");
    if (!channel.isTextBased()) {
      return interaction.reply({
        content: `${E("NilouWorried", "❌")} Please select a text-based channel.`,
        ephemeral: true,
      });
    }

    dropChannels.set(guildId, { channelId: channel.id });
    await upsertGuildSettings(guildId, { drops_channel_id: channel.id });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`${E("NilouCheer", "🎉")} Drops Redirect Configured`)
      .setDescription(`${DIVIDER}\nAll **Theater Drops** will now appear in ${channel}.\n\nMembers still use **\`/collect\`** in any channel to claim them.\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "disable") {
    dropChannels.delete(guildId);
    await upsertGuildSettings(guildId, { drops_channel_id: null });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`${E("NilouFlower", "🌸")} Drops Redirect Disabled`)
      .setDescription(`${DIVIDER}\nTheater Drops will now appear in the **same channel** they were triggered in.\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
}
