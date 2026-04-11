import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getUid } from "../db/uidStore.js";
import { fetchProfile, parsePlayerInfo, parseCharacters } from "../utils/enka.js";
import { rateCV } from "../utils/genshinData.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

/**
 * Utility to merge tailwind classes (useful if extending this to a web dashboard)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("View your Genshin profile & Akasha rankings.")
  .addUserOption(o =>
    o.setName("user")
      .setDescription("View another user's profile")
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

  let rawData;
  try {
    // Akasha pulls from Enka, so we fetch the base data first
    rawData = await fetchProfile(uid);
    if (!rawData) throw new Error("Could not find data for this UID.");
  } catch (err) {
    return interaction.editReply({ content: `❌ Error: ${err.message}` });
  }

  const p = parsePlayerInfo(rawData);
  const characters = parseCharacters(rawData);

  // Formatting character list with Akasha style rankings
  let showcaseList = "";
  if (characters && characters.length > 0) {
    showcaseList = characters.map((c, i) => {
      // Logic for displaying the Akasha Leaderboard rank
      const isTopTier = c.akashaRank <= 1;
      const rankEmoji = isTopTier ? "👑 " : "⭐ ";
      const rankText = c.akashaRank ? `Top **${c.akashaRank}%**` : "*Unranked*";

      return `${i + 1}. ${rankEmoji}**${c.name}** · Lv.${c.level} | ${rankText}\n  └ CV: ${c.totalCV} (${rateCV(c.totalCV)})`;
    }).join("\n");
  } else {
    showcaseList = "❌ **No character details found.**\n*Ensure \"Show Character Details\" is ON in-game and you have refreshed at [Akasha.cv](https://akasha.cv/profile/" + uid + ")!*";
  }

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`✦ ${p.nickname}'s Akasha Profile`)
    .setURL(`https://akasha.cv/profile/${uid}`)
    .setThumbnail(`https://enka.network/ui/${p.avatarIcon}.png`)
    .setDescription(`${DIVIDER}\n🌸 UID: \`${p.uid}\`\n🔗 [Open Akasha Leaderboards](https://akasha.cv/profile/${uid})\n${DIVIDER}`)
    .addFields(
      {
        name: "🗺️ Explorer Info",
        value: `AR: **${p.ar}**\nAchievements: **${p.achievements.toLocaleString()}**`,
        inline: true,
      },
      {
        name: "🌀 Battle Record",
        value: `Abyss: **${p.abyssFloor}-${p.abyssLevel}**\nTheater: **Act ${p.theaterFloor}**`,
        inline: true,
      },
      {
        name: "🏆 Showcase Rankings",
        value: showcaseList,
        inline: false,
      }
    )
    .addFields({ 
        name: "🕒 Last Sync", 
        value: p.updatedAt ? `<t:${Math.floor(p.updatedAt / 1000)}:R>` : "Recently", 
        inline: false 
    })
    .setFooter({ text: "Data provided by Akasha System & Enka.Network" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}