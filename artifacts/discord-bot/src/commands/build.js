import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from "discord.js";
import { getUid } from "../db/uidStore.js";
import { fetchProfile, parsePlayerInfo, parseCharacters } from "../utils/enka.js";
import { rateCV, EQUIP_TYPE_NAMES, STAT_NAMES } from "../utils/genshinData.js";
import { generateBuildCard } from "../utils/buildCard.js";
import { NILOU_RED, FOOTER_GENSHIN, DIVIDER } from "../theme.js";

export const data = new SlashCommandBuilder()
  .setName("build")
  .setDescription("Generate a character build card from your showcase.")
  .addStringOption(o =>
    o.setName("character")
      .setDescription("Character name (from your showcase)")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addBooleanOption(o =>
    o.setName("hide_details")
      .setDescription("Redact your UID and username from the build card")
      .setRequired(false)
  )
  .addUserOption(o =>
    o.setName("user")
      .setDescription("View another registered user's build")
      .setRequired(false)
  );

export async function autocomplete(interaction) {
  const target   = interaction.options.getUser("user") || interaction.user;
  const uid      = getUid(target.id);
  if (!uid) return interaction.respond([]);

  try {
    const raw        = await fetchProfile(uid);
    const characters = parseCharacters(raw);
    const focused    = interaction.options.getFocused().toLowerCase();
    const choices    = characters
      .filter(c => c.name.toLowerCase().includes(focused))
      .slice(0, 8)
      .map(c => ({ name: `${c.name} (Lv.${c.level})`, value: c.name }));
    await interaction.respond(choices);
  } catch {
    await interaction.respond([]);
  }
}

export async function execute(interaction) {
  await interaction.deferReply();

  const charName   = interaction.options.getString("character");
  const normalizedQuery = charName.trim().toLowerCase();
  const hideDetails = interaction.options.getBoolean("hide_details") ?? false;
  const target     = interaction.options.getUser("user") || interaction.user;
  const uid        = getUid(target.id);

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
  const characters = parseCharacters(raw);

  const exactMatches = characters.filter(c => c.name.toLowerCase() === normalizedQuery);
  const prefixMatches = characters.filter(c => c.name.toLowerCase().startsWith(normalizedQuery));
  const containsMatches = characters.filter(c => c.name.toLowerCase().includes(normalizedQuery));

  const candidatePool = exactMatches.length
    ? exactMatches
    : (prefixMatches.length ? prefixMatches : containsMatches);

  if (candidatePool.length > 1) {
    const suggestions = candidatePool.slice(0, 8).map(c => c.name).join(", ");
    return interaction.editReply({
      content: `❌ Multiple characters match "${charName}". Please use a more specific name: ${suggestions}`,
    });
  }

  const character = candidatePool[0];

  if (!character) {
    const names = characters.map(c => c.name).join(", ");
    return interaction.editReply({
      content: `❌ Character not found in showcase. Available: ${names}`,
    });
  }

  let imageBuffer = null;
  try {
    imageBuffer = await generateBuildCard(character, p, hideDetails);
  } catch (err) {
    console.error("Canvas build card error:", err.message);
  }

  const summaryLines = character.artifacts.map(art => {
    const crSub = art.subStats.find(s => s.key === "FIGHT_PROP_CRITICAL");
    const cdSub = art.subStats.find(s => s.key === "FIGHT_PROP_CRITICAL_HURT");
    const cr = crSub?.value.toFixed(1) || "0.0";
    const cd = cdSub?.value.toFixed(1) || "0.0";
    return `${art.type}: CR ${cr}% + CD ${cd}% → **${art.cv} CV**`;
  });

  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`✦ ${character.name} Build Card`)
    .setDescription(
      `${DIVIDER}\n` +
      `🌸 Player: ${hideDetails ? "Hidden" : `${p.nickname} (\`${p.uid}\`)`} · AR${p.ar}\n` +
      `${DIVIDER}`
    )
    .addFields(
      {
        name: "📊 Stats",
        value:
          `HP: **${Math.round(character.hp).toLocaleString()}** · ATK: **${Math.round(character.atk).toLocaleString()}** · DEF: **${Math.round(character.def).toLocaleString()}**\n` +
          `EM: **${Math.round(character.em)}** · ER: **${character.er}%**\n` +
          `CR: **${character.critRate}%** · CD: **${character.critDmg}%** · Total CV: **${character.totalCV}** ${rateCV(character.totalCV)}`,
        inline: false,
      },
      {
        name: "🏆 Artifact CV Breakdown",
        value: summaryLines.length > 0 ? summaryLines.join("\n") : "No artifact data.",
        inline: false,
      }
    )
    .setFooter(FOOTER_GENSHIN)
    .setTimestamp();

  if (imageBuffer) {
    const attachment = new AttachmentBuilder(imageBuffer, { name: `${character.name.replace(/ /g, "_")}_build.png` });
    embed.setImage(`attachment://${character.name.replace(/ /g, "_")}_build.png`);
    await interaction.editReply({ embeds: [embed], files: [attachment] });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}
