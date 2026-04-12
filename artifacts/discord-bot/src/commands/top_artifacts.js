import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getUid } from "../db/uidStore.js";
import { fetchProfile, parsePlayerInfo, parseCharacters } from "../utils/enka.js";
import { rateCV, STAT_NAMES } from "../utils/genshinData.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("top_artifacts")
  .setDescription("View your Hall of Fame — best artifacts from all showcase characters by CV.")
  .addUserOption(o =>
    o.setName("user")
      .setDescription("Check another registered user")
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const target = interaction.options.getUser("user") || interaction.user;
  const uid    = getUid(target.id);

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

  const allArtifacts = characters.flatMap(c => c.artifacts);
  const bestByType = {};
  for (const art of allArtifacts) {
    if (!bestByType[art.equipType] || art.cv > bestByType[art.equipType].cv) {
      bestByType[art.equipType] = art;
    }
  }

  const slotOrder = [
    { equipType: "EQUIP_BRACER", label: "🥇 Best Flower" },
    { equipType: "EQUIP_NECKLACE", label: "🥇 Best Feather" },
    { equipType: "EQUIP_SHOES", label: "🥇 Best Sands" },
    { equipType: "EQUIP_RING", label: "🥇 Best Goblet" },
    { equipType: "EQUIP_DRESS", label: "🥇 Best Circlet" },
  ];

  const slotWinners = slotOrder
    .map(slot => ({ ...slot, art: bestByType[slot.equipType] }))
    .filter(slot => Boolean(slot.art));

  const overallBest = [...allArtifacts].sort((a, b) => b.cv - a.cv).slice(0, 3);

  const fieldLines = slotWinners.map(slot => {
    const art = slot.art;
    const mainName = STAT_NAMES[art.mainStat?.key] || art.mainStat?.key || "?";
    const crSub    = art.subStats.find(s => s.key === "FIGHT_PROP_CRITICAL");
    const cdSub    = art.subStats.find(s => s.key === "FIGHT_PROP_CRITICAL_HURT");
    const cr       = crSub?.value.toFixed(1) || "0.0";
    const cd       = cdSub?.value.toFixed(1) || "0.0";
    return {
      label: slot.label,
      value: `${art.type} — **${art.cv} CV** ${rateCV(art.cv)}\nMain: ${mainName} · CR ${cr}% + CD ${cd}% · On: *${art.characterName}*`,
    };
  });

  const totalCV = allArtifacts.reduce((s, a) => s + a.cv, 0);
  const avgCV   = allArtifacts.length > 0 ? (totalCV / allArtifacts.length).toFixed(1) : "0";

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`✦ ${p.nickname}'s Artifact Hall of Fame`)
    .setDescription(
      `${DIVIDER}\n` +
      `🌸 UID: \`${p.uid}\` · AR${p.ar}\n` +
      `Total artifacts scanned: **${allArtifacts.length}** · Average CV: **${avgCV}**\n` +
      `${DIVIDER}`
    )
    .addFields(
      ...fieldLines.map((field) => ({
        name: field.label,
        value: field.value,
        inline: false,
      })),
      {
        name: "🏆 Overall Top 3 Artifacts",
        value: overallBest.map((art, i) =>
          `${["🥇","🥈","🥉"][i]} ${art.type} — **${art.cv} CV** on *${art.characterName}*`
        ).join("\n") || "None",
        inline: false,
      }
    )
    .setFooter(FOOTER_GENSHIN)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
