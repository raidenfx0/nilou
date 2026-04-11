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
    // We still fetch through Enka as it is the data source for Akasha
    rawData = await fetchProfile(uid);
    if (!rawData) throw new Error("No data received.");
  } catch (err) {
    return interaction.editReply({ content: `❌ Error: ${err.message}` });
  }

  const p = parsePlayerInfo(rawData);
  const characters = parseCharacters(rawData);

  // Formatting character list with Akasha style rankings
  let showcaseList = "";
  if (characters && characters.length > 0) {
    showcaseList = characters.map((c, i) => {
      // If your utils/enka.js parser supports Akasha ranks, we show them here
      const rankInfo = c.akashaRank ? ` | **Top ${c.akashaRank}%**` : "";
      return `${i + 1}. **${c.name}** · Lv.${c.level}${rankInfo}\n  └ CV: ${c.totalCV} (${rateCV(c.totalCV)})`;
    }).join("\n");
  } else {
    showcaseList = "❌ **No character details found.**\n*Go to [Akasha.cv](https://akasha.cv/profile/" + uid + ") and hit 'Refresh' to wake up the system!*";
  }

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`✦ ${p.nickname}'s Akasha Profile`)
    .setURL(`https://akasha.cv/profile/${uid}`) // Direct link to Akasha
    .setThumbnail(`https://enka.network/ui/${p.avatarIcon}.png`)
    .setDescription(`${DIVIDER}\n🌸 UID: \`${p.uid}\`\n🔗 [View on Akasha System](https://akasha.cv/profile/${uid})\n${DIVIDER}`)
    .addFields(
      {
        name: "🗺️ Explorer",
        value: `AR: **${p.ar}**\nAchievements: **${p.achievements}**`,
        inline: true,
      },
      {
        name: "🌀 Battle Record",
        value: `Abyss: **${p.abyssFloor}-${p.abyssLevel}**\nTheater: **Act ${p.theaterFloor}**`,
        inline: true,
      },
      {
        name: "🏆 Character Leaderboards",
        value: showcaseList,
        inline: false,
      }
    )
    .addFields({ 
        name: "🕒 Last Sync", 
        value: p.updatedAt ? `<t:${Math.floor(p.updatedAt / 1000)}:R>` : "Recent", 
        inline: false 
    })
    .setFooter({ text: "Data synced via Akasha & Enka Network" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}