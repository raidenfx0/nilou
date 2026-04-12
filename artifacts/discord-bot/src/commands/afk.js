import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { afkUsers } from "../data/store.js";

// Define the data object
const data = new SlashCommandBuilder()
  .setName("afk")
  .setDescription("Set or clear your AFK status")
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Mark yourself as AFK")
      .addStringOption((o) =>
        o.setName("reason").setDescription("Why are you AFK?").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("clear").setDescription("Remove your AFK status")
  );

// Define the execute function
async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const key = `${interaction.guildId}:${interaction.user.id}`;
  const reason = interaction.options.getString("reason") || "No reason given";

  if (sub === "set") {
    afkUsers.set(key, { 
      reason, 
      since: Date.now(), 
      userId: interaction.user.id, 
      guildId: interaction.guildId 
    });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ AFK Status Set")
      .setDescription(`${DIVIDER}\n🌸 You are now AFK!\nReason: ${reason}\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else {
    if (!afkUsers.has(key)) {
      await interaction.reply({
        content: "🌸 You are not currently AFK!",
        ephemeral: true,
      });
      return;
    }

    afkUsers.delete(key);

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ AFK Cleared")
      .setDescription(`${DIVIDER}\n🌸 Welcome back! Your AFK has been removed.\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

// Named exports for loaders that destructure
export { data, execute };

// Default export for loaders that import the whole object
export default { data, execute };