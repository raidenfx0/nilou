import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN } from "../theme.js";
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
        .setDescription("Your AFK status is active. I’ll let others know when they mention you.")
        .addFields(
          { name: "Reason", value: reason, inline: false },
          { name: "Started", value: `<t:${Math.floor(since / 1000)}:R>`, inline: true },
        )
        .setFooter(FOOTER_MAIN).setTimestamp()],
      ephemeral: true,
    });
  } else {
    const wasAfk = afkUsers.delete(key);
    // Always clear the database row too. This handles stale AFK records
    // that were hydrated after a previous automatic in-message clear.
    await clearAfk(interaction.guildId, interaction.user.id);
    if (!wasAfk) {
      return interaction.reply({ content: "🌸 You are not currently AFK!", ephemeral: true });
    }

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(NILOU_RED).setTitle("✦ AFK Cleared")
        .setDescription("Welcome back. Your AFK status has been removed.")
        .addFields({ name: "Status", value: "You’re available again.", inline: true })
        .setFooter(FOOTER_MAIN).setTimestamp()],
      ephemeral: true,
    });
  }
}

export { data, execute };
export default { data, execute };
