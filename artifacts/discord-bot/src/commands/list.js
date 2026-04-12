import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getUid } from "../db/uidStore.js";
import { fetchProfile, parsePlayerInfo, parseCharacters } from "../utils/enka.js";
import { rateCV, EQUIP_TYPE_NAMES } from "../utils/genshinData.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("list")
  .setDescription("List your Genshin Impact showcase characters or artifacts.")
  .addStringOption(o =>
    o.setName("category")
      .setDescription("What to list")
      .setRequired(true)
      .addChoices(
        { name: "Characters — all 8 showcase characters with levels and CV", value: "characters" },
        { name: "Artifacts — top 5 artifacts sorted by CV", value: "artifacts" }
      )
  )
  .addUserOption(o =>
    o.setName("user")
      .setDescription("Check another registered user")
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const category = interaction.options.getString("category");
  const target   = interaction.options.getUser("user") || interaction.user;
  const uid      = getUid(target.id);

  if (!uid) {
    return interaction.editReply({
      content: target.id === interaction.user.id
        ? "❌ You haven't registered your UID yet. Use **/register** first!"
        : `❌ ${target.username} hasn't registered a UID yet.`,
    });
  }

  let raw;
  try { raw = await fetchProfile(uid); }
  catch (err) { return interaction.editReply({ content: `❌ ${err.message}` }); }

  const p          = parsePlayerInfo(raw);
  const characters = await parseCharacters(raw);

  if (characters.length === 0) {
    return interaction.editReply({
      content: "❌ No characters found in showcase. Make sure your Genshin profile is set to public.",
    });
  }

  if (category === "characters") {
    const lines = characters.map((c, i) => {
      const bar = "█".repeat(Math.min(10, Math.floor(c.totalCV / 30)));
      return (
        `**${i + 1}. ${c.name}** · Lv.${c.level}\n` +
        `CR: ${c.critRate}% · CD: ${c.critDmg}% · CV: **${c.totalCV}** ${rateCV(c.totalCV)}\n` +
        `HP: ${Math.round(c.hp).toLocaleString()} · ATK: ${Math.round(c.atk).toLocaleString()} · DEF: ${Math.round(c.def).toLocaleString()}`
      );
    });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`✦ ${p.nickname}'s Showcase Characters`)
      .setDescription(`${DIVIDER}\n🌸 UID: \`${p.uid}\` · AR${p.ar}\n${DIVIDER}`)
      .addFields(lines.map((l, i) => ({
        name: `${["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣"][i] || `${i+1}.`}`,
        value: l,
        inline: false,
      })))
      .setFooter(FOOTER_GENSHIN)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (category === "artifacts") {
    const allArtifacts = characters.flatMap(c => c.artifacts);
    const sorted = allArtifacts.sort((a, b) => b.cv - a.cv).slice(0, 5);

    const lines = sorted.map((art, i) => {
      const crSub = art.subStats.find(s => s.key === "FIGHT_PROP_CRITICAL");
      const cdSub = art.subStats.find(s => s.key === "FIGHT_PROP_CRITICAL_HURT");
      const cr = crSub ? crSub.value.toFixed(1) : "0.0";
      const cd = cdSub ? cdSub.value.toFixed(1) : "0.0";
      return (
        `**${art.type}** · +${art.level || 20}\n` +
        `CR: ${cr}% · CD: ${cd}% → CV **${art.cv}** ${rateCV(art.cv)}\n` +
        `On: *${art.characterName}*`
      );
    });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`✦ ${p.nickname}'s Top 5 Artifacts by CV`)
      .setDescription(`${DIVIDER}\n🌸 UID: \`${p.uid}\` · AR${p.ar}\n${DIVIDER}`)
      .addFields(lines.map((l, i) => ({
        name: `${["🥇","🥈","🥉","4️⃣","5️⃣"][i] || `${i+1}.`}`,
        value: l,
        inline: false,
      })))
      .setFooter(FOOTER_GENSHIN)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
}
