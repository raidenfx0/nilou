import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";
import { triggers } from "../data/store.js";

export const data = new SlashCommandBuilder()
  .setName("trigger")
  .setDescription("Auto-response triggers — bot replies when someone says a phrase")
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a trigger (admin only)")
      .addStringOption((o) =>
        o.setName("phrase").setDescription("The phrase that triggers the response (case-insensitive)").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("response").setDescription("What Nilou replies with (use \\n for new lines)").setRequired(true)
      )
      .addBooleanOption((o) =>
        o.setName("exact").setDescription("Match only the exact phrase? (default: contains match)").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a trigger (admin only)")
      .addStringOption((o) =>
        o.setName("phrase").setDescription("The trigger phrase to remove").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all configured triggers")
  )
  .addSubcommand((sub) =>
    sub.setName("clear").setDescription("Remove all triggers for this server (admin only)")
  );

export async function execute(interaction) {
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === "add") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const phrase   = interaction.options.getString("phrase").toLowerCase();
    const response = interaction.options.getString("response").replace(/\\n/g, "\n");
    const exact    = interaction.options.getBoolean("exact") ?? false;

    if (!triggers.has(guildId)) triggers.set(guildId, []);
    const list = triggers.get(guildId);

    const existing = list.findIndex((t) => t.phrase === phrase);
    if (existing !== -1) list.splice(existing, 1);

    list.push({ phrase, response, exact });
    triggers.set(guildId, list);

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Trigger Added")
      .setDescription(`${DIVIDER}\n🌸 Trigger saved!\n\nPhrase: \`${phrase}\`\nMatch type: ${exact ? "Exact" : "Contains"}\nResponse: ${response}\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (sub === "remove") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const phrase = interaction.options.getString("phrase").toLowerCase();
    const list   = triggers.get(guildId) || [];
    const before = list.length;
    const after  = list.filter((t) => t.phrase !== phrase);

    if (before === after.length) {
      return interaction.reply({ content: `❌ No trigger found for phrase: \`${phrase}\``, ephemeral: true });
    }

    triggers.set(guildId, after);
    await interaction.reply({ content: `🌸 Trigger \`${phrase}\` removed!`, ephemeral: true });
    return;
  }

  if (sub === "clear") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    triggers.delete(guildId);
    await interaction.reply({ content: "🌸 All triggers cleared for this server.", ephemeral: true });
    return;
  }

  if (sub === "list") {
    const list = triggers.get(guildId) || [];

    if (list.length === 0) {
      return interaction.reply({ content: "💧 No triggers configured. Add some with `/trigger add`!", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Configured Triggers")
      .setDescription(
        `${DIVIDER}\n` +
        list
          .map((t, i) => `**${i + 1}.** \`${t.phrase}\` → ${t.response.slice(0, 60)}${t.response.length > 60 ? "..." : ""} (${t.exact ? "exact" : "contains"})`)
          .join("\n") +
        `\n${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }
}
