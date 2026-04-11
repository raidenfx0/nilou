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
    rawData = await fetchProfile(uid);
    if (!rawData) throw new Error("No data received from Enka.");
  } catch (err) {
    return interaction.editReply({ content: `❌ Error fetching data: ${err.message}` });
  }

  const p = parsePlayerInfo(rawData);
  const characters = parseCharacters(rawData);

  // Format the character list with a fallback if empty
  let showcaseList = "";
  if (characters && characters.length > 0) {
    showcaseList = characters.map((c, i) =>
      `${i + 1}. **${c.name}** · Lv.${c.level} · CV ${c.totalCV} (${rateCV(c.totalCV)})`
    ).join("\n");
  } else {
    showcaseList = "❌ **No character details found.**\n*Ensure \"Show Character Details\" is ON in-game and you've refreshed on Enka.network!*";
  }

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`✦ ${p.nickname}'s Profile`)
    .setThumbnail(`https://enka.network/ui/${p.avatarIcon}.png`) // Optional: adds player avatar
    .setDescription(`${DIVIDER}\n🌸 UID: \`${p.uid}\`\n${DIVIDER}`)
    .addFields(
      {
        name: "🗺️ Player Info",
        value:
          `AR: **${p.ar}** (WL${p.worldLevel})\n` +
          `Achievements: **${p.achievements.toLocaleString()}**\n` +
          (p.signature ? `Sig: *${p.signature}*` : ""),
        inline: true,
      },
      {
        name: "🌀 Battle Stats",
        value: `Abyss: **${p.abyssFloor}-${p.abyssLevel}**\n` +
               `Theater: **Act ${p.theaterFloor}** (⭐${p.theaterStars})`,
        inline: true,
      },
      {
        name: "🌸 Showcase Characters",
        value: showcaseList,
        inline: false,
      }
    )
    // Adding a relative timestamp helps users see if the data is old
    .addFields({ 
        name: "🕒 Data Last Updated", 
        value: p.updatedAt ? `<t:${Math.floor(p.updatedAt / 1000)}:R>` : "Just now", 
        inline: false 
    })
    .setFooter(FOOTER_GENSHIN)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}