import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getUid } from "../db/uidStore.js";
import { fetchProfile, parsePlayerInfo, parseCharacters } from "../utils/enka.js";
import { rateCV } from "../utils/genshinData.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("View your Genshin profile & Akasha rankings.")
  .addUserOption(o =>
    o.setName("user")
      .setDescription("View another user's profile (they must have registered their UID)")
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const target = interaction.options.getUser("user") || interaction.user;
  const uid = getUid(target.id);

  if (!uid) {
    return interaction.editReply({
      content: target.id === interaction.user.id
        ? "❌ You haven't registered your UID yet. Use **/register** first!"
        : `❌ ${target.username} hasn't registered a UID yet.`,
    });
  }

  let profileData;
  try {
    profileData = await fetchProfile(uid);
    if (!profileData) throw new Error("Could not find data for this UID.");
  } catch (err) {
    return interaction.editReply({ content: `❌ ${err.message}` });
  }

  const p = parsePlayerInfo(profileData);
  const characters = parseCharacters(profileData);

  const leadCharacterIcon = characters[0] ? `UI_AvatarIcon_${characters[0].avatarId}` : null;

  const showcaseList = characters.length > 0
    ? characters.map((c, i) => {
        return `${i + 1}. ⭐ **${c.name}** · Lv.${c.level}\n  └ CV ${c.totalCV} (${rateCV(c.totalCV)})`;
      }).join("\n")
    : p.showcaseIds.length > 0
    ? `${p.showcaseIds.length} characters (set profile to public for details)`
    : "No characters in showcase.";

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`✦ ${p.nickname}'s Akasha Profile`)
    .setURL(`https://akasha.cv/profile/${uid}`)
    .setDescription(`${DIVIDER}\n🌸 UID: \`${p.uid}\`\n🔗 [Open Akasha Leaderboards](https://akasha.cv/profile/${uid})\n${DIVIDER}`)
    .addFields(
      {
        name: "🗺️ Explorer Info",
        value:
          `AR: **${p.ar}** (WL${p.worldLevel})\n` +
          `Achievements: **${p.achievements?.toLocaleString() || 0}**\n` +
          (p.signature ? `Signature: *${p.signature}*` : ""),
        inline: true,
      },
      {
        name: "🌀 Battle Record",
        value: 
          `Abyss: **${p.abyssFloor > 0 ? `${p.abyssFloor}-${p.abyssLevel}` : "No data"}**\n` +
          `Theater: **${p.theaterFloor > 0 ? `Act ${p.theaterFloor} · ${p.theaterStars}★` : "No data"}**`,
        inline: true,
      },
      {
        name: "🏆 Showcase Rankings",
        value: showcaseList,
        inline: false,
      }
    )
    .setFooter(FOOTER_GENSHIN)
    .setTimestamp();

  if (leadCharacterIcon) {
    embed.setThumbnail(`https://enka.network/ui/${leadCharacterIcon}.png`);
  }

  await interaction.editReply({ embeds: [embed] });
}