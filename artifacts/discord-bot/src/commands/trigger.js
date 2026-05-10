import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";
import { triggers } from "../data/store.js";
import { upsertTrigger, deleteTrigger, pool } from "../db/index.js";

export const data = new SlashCommandBuilder()
  .setName("trigger")
  .setDescription("Auto-response triggers")
  .addSubcommand(sub =>
    sub.setName("add").setDescription("Add a trigger (admin only)")
      .addStringOption(o => o.setName("phrase").setDescription("Trigger phrase (case-insensitive)").setRequired(true))
      .addStringOption(o => o.setName("response").setDescription("Bot reply (use \\n for new lines)").setRequired(true))
      .addBooleanOption(o => o.setName("exact").setDescription("Exact match only?").setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName("remove").setDescription("Remove a trigger (admin only)")
      .addStringOption(o => o.setName("phrase").setDescription("Trigger phrase to remove").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("list").setDescription("List all triggers"))
  .addSubcommand(sub => sub.setName("clear").setDescription("Remove all triggers (admin only)"));

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
    const idx  = list.findIndex(t => t.phrase === phrase);
    if (idx !== -1) list.splice(idx, 1);
    list.push({ phrase, response, exact });
    triggers.set(guildId, list);
    await upsertTrigger(guildId, phrase, response, exact);

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(NILOU_RED).setTitle("✦ Trigger Added")
        .setDescription(`${DIVIDER}\n🌸 Trigger saved!\n\nPhrase: \`${phrase}\`\nMatch: ${exact?"Exact":"Contains"}\nResponse: ${response}\n${DIVIDER}`)
        .setFooter(FOOTER_MAIN).setTimestamp()],
      ephemeral: true,
    });
    return;
  }

  if (sub === "remove") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const phrase = interaction.options.getString("phrase").toLowerCase();
    const list   = triggers.get(guildId) || [];
    const after  = list.filter(t => t.phrase !== phrase);
    if (after.length === list.length) return interaction.reply({ content: `❌ No trigger: \`${phrase}\``, ephemeral: true });
    triggers.set(guildId, after);
    await deleteTrigger(guildId, phrase);
    await interaction.reply({ content: `🌸 Trigger \`${phrase}\` removed!`, ephemeral: true });
    return;
  }

  if (sub === "clear") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    triggers.delete(guildId);
    await pool.query("DELETE FROM triggers WHERE guild_id=$1", [guildId]);
    await interaction.reply({ content: "🌸 All triggers cleared.", ephemeral: true });
    return;
  }

  if (sub === "list") {
    const list = triggers.get(guildId) || [];
    if (!list.length) return interaction.reply({ content: "💧 No triggers yet. Use `/trigger add`!", ephemeral: true });
    const embed = new EmbedBuilder().setColor(NILOU_RED).setTitle("✦ Configured Triggers")
      .setDescription(`${DIVIDER}\n${list.map((t,i) =>
        `**${i+1}.** \`${t.phrase}\` → ${t.response.slice(0,60)}${t.response.length>60?"...":""} (${t.exact?"exact":"contains"})`
      ).join("\n")}\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN).setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }
}
