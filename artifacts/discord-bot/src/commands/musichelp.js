import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ComponentType 
} from "discord.js";
import { NILOU_RED, DIVIDER } from "../theme.js";

/**
 * Nilou Music Specific Help Command (Subcommand Aware)
 * Updated to reflect the /music <subcommand> structure.
 * Location: ./commands/musichelp.js
 */

export const data = new SlashCommandBuilder()
  .setName("musichelp")
  .setDescription("View the detailed program for Nilou's musical performances");

export async function execute(interaction) {
  const client = interaction.client;

  const mainEmbed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("🌸 ✦ Musical Performance Guide")
    .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
    .setDescription(
      `${DIVIDER}\n` +
      `*"The rhythm of the water matches the heartbeat of the theater."*\n\n` +
      `I am ready to perform! Since I use a consolidated system, all commands start with \`/music\`.\n\n` +
      `**Select a category below to see the specific movements!**\n` +
      `${DIVIDER}`
    )
    .setFooter({ text: "Nilou — Zubayr Theater Star", iconURL: client.user.displayAvatarURL() })
    .setTimestamp();

  const menuRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('music_help_select')
      .setPlaceholder('Select a music category...')
      .addOptions([
        {
          label: 'Performance Basics',
          description: 'Play, search, join, and leave.',
          value: 'm_basics',
          emoji: '🎵',
        },
        {
          label: 'Playback & Navigation',
          description: 'Pause, skip, and time seeking.',
          value: 'm_playback',
          emoji: '⏯️',
        },
        {
          label: 'Queue Management',
          description: 'Shuffle, move, and remove songs.',
          value: 'm_queue',
          emoji: '📋',
        },
        {
          label: 'Audio & Stage Settings',
          description: 'Volume, autoplay, and 24/7 mode.',
          value: 'm_config',
          emoji: '⚙️',
        },
      ]),
  );

  const response = await interaction.reply({ 
    embeds: [mainEmbed], 
    components: [menuRow] 
  });

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 120000 
  });

  collector.on('collect', async (i) => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({ content: "🌸 This program is for the person who started the show!", ephemeral: true });
    }

    let title = "";
    let list = "";

    switch (i.values[0]) {
      case 'm_basics':
        title = "🎵 Performance Basics";
        list = 
          "`/music play <query>` — Start a performance\n" +
          "*Tip: You can search or use links for playlists and albums here!*\n" +
          "`/music join` — Invite me to the stage\n" +
          "`/music leave` — Ask me to take a bow and leave";
        break;

      case 'm_playback':
        title = "⏯️ Playback & Seeking";
        list = 
          "`/music pause` — Pause the dance\n" +
          "`/music resume` — Continue the rhythm\n" +
          "`/music stop` — End the performance\n" +
          "`/music skip` — Next melody\n" +
          "`/music previous` — Last melody\n" +
          "`/music seek seconds: 0` — Restart the track\n" +
          "`/music skipto <index>` — Jump to a specific song\n" +
          "`/music forward` • `/music backward` — Shift time";
        break;

      case 'm_queue':
        title = "📋 Queue Management";
        list = 
          "`/music queue` — View the program\n" +
          "`/music nowplaying` — Current song details\n" +
          "`/music shuffle` — Mix the program\n" +
          "`/music move` — Change song order\n" +
          "`/music swap` — Swap two song positions\n" +
          "`/music remove` — Remove from program\n" +
          "`/music clear` — Empty the upcoming list";
        break;

      case 'm_config':
        title = "⚙️ Audio & Stage Settings";
        list = 
          "`/music volume <%>` — Adjust stage sound\n" +
          "`/music autoplay` — Automatic discovery\n" +
          "`/music 247` — Stay on stage forever\n" +
          "`/music repeat <mode>` — Loop song or queue";
        break;
    }

    const updatedEmbed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`🌸 ✦ ${title}`)
      .setDescription(`${DIVIDER}\n${list}\n${DIVIDER}\n*Use the menu again to switch categories!*`)
      .setFooter({ text: "Nilou — Dance of the Sabzeruz", iconURL: client.user.displayAvatarURL() });

    await i.update({ embeds: [updatedEmbed] });
  });

  collector.on('end', () => {
    const disabledRow = new ActionRowBuilder().addComponents(
      menuRow.components[0].setDisabled(true)
    );
    interaction.editReply({ components: [disabledRow] }).catch(() => {});
  });
}