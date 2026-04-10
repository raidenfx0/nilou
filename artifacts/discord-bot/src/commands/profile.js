import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getUid } from "../db/uidStore.js";
import { fetchProfile, parsePlayerInfo, parseCharacters } from "../utils/enka.js";
import { rateCV } from "../utils/genshinData.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("View your Genshin Impact player profile.")
  .addUserOption(o =>
    o.setName("user")
      .setDescription("View another user's profile (they must have registered their UID)")
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

  let data;
  try {
    data = await fetchProfile(uid);
  } catch (err) {
    return interaction.editReply({ content: `❌ ${err.message}` });
  }

  const p          = parsePlayerInfo(data);
  const characters = parseCharacters(data);

  const showcaseList = characters.length > 0
    ? characters.map((c, i) =>
        `${i + 1}. **${c.name}** · Lv.${c.level} · CV ${c.totalCV} (${rateCV(c.totalCV)})`
      ).join("\n")
    : p.showcaseIds.length > 0
    ? `${p.showcaseIds.length} characters (set profile to public for details)`
    : "No characters in showcase.";

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`✦ ${p.nickname}'s Profile`)
    .setDescription(`${DIVIDER}\n🌸 UID: \`${p.uid}\`\n${DIVIDER}`)
    .addFields(
      {
        name: "🗺️ Player Info",
        value:
          `Adventure Rank: **${p.ar}** (WL${p.worldLevel})\n` +
          `Achievements: **${p.achievements.toLocaleString()}**\n` +
          (p.signature ? `Signature: *${p.signature}*` : ""),
        inline: true,
      },
      {
        name: "🌀 Spiral Abyss",
        value: p.abyssFloor > 0
          ? `Floor **${p.abyssFloor}**-${p.abyssLevel}` : "No data",
        inline: true,
      },
      {
        name: "🎭 Imaginarium Theater",
        value: p.theaterFloor > 0
          ? `Act **${p.theaterFloor}** · ⭐ ${p.theaterStars}` : "No data",
        inline: true,
      },
      {
        name: "🌸 Showcase Characters",
        value: showcaseList,
        inline: false,
      }
    )
    .setFooter(FOOTER_GENSHIN)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
