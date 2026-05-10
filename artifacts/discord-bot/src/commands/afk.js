import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { afkUsers } from "../data/store.js";
import { setAfk, clearAfk } from "../db/index.js";

const data = new SlashCommandBuilder()
  .setName("afk")
  .setDescription("Set or clear your AFK status")
  .addSubcommand(sub =>
    sub.setName("set").setDescription("Mark yourself as AFK")
      .addStringOption(o => o.setName("reason").setDescription("Why are you AFK?").setRequired(false))
  )
  .addSubcommand(sub => sub.setName("clear").setDescription("Remove your AFK status"));

async function execute(interaction) {
  const sub    = interaction.options.getSubcommand();
  const key    = `${interaction.guildId}:${interaction.user.id}`;
  const reason = interaction.options.getString("reason") || "No reason given";

  if (sub === "set") {
    const since = Date.now();
    afkUsers.set(key, { reason, since, userId: interaction.user.id, guildId: interaction.guildId });
    await setAfk(interaction.guildId, interaction.user.id, reason, since);

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(NILOU_RED).setTitle("✦ AFK Status Set")
        .setDescription(`${DIVIDER}\n🌸 You are now AFK!\nReason: ${reason}\n${DIVIDER}`)
        .setFooter(FOOTER_MAIN).setTimestamp()],
      ephemeral: true,
    });
  } else {
    if (!afkUsers.has(key)) {
      return interaction.reply({ content: "🌸 You are not currently AFK!", ephemeral: true });
    }
    afkUsers.delete(key);
    await clearAfk(interaction.guildId, interaction.user.id);

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(NILOU_RED).setTitle("✦ AFK Cleared")
        .setDescription(`${DIVIDER}\n🌸 Welcome back! Your AFK has been removed.\n${DIVIDER}`)
        .setFooter(FOOTER_MAIN).setTimestamp()],
      ephemeral: true,
    });
  }
}

export { data, execute };
export default { data, execute };
