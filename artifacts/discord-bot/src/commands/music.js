import { 
  SlashCommandBuilder, 
  EmbedBuilder 
} from "discord.js";
import { NILOU_RED, DIVIDER } from "../theme.js";

/**
 * Nilou Music System - Professional Theater Version
 * Features: Jockie-style paginated queue, Auto-cleanup, and 24/7 logic.
 */

export const data = new SlashCommandBuilder()
  .setName("music")
  .setDescription("Nilou's Musical Performance System")
  .addSubcommand(sub => 
    sub.setName("play")
      .setDescription("Start a beautiful performance")
      .addStringOption(opt => opt.setName("query").setDescription("The song name, link, or playlist").setRequired(true))
      .addStringOption(opt => opt.setName("type").setDescription("Source engine").addChoices(
        { name: 'Youtube', value: 'youtube' },
        { name: 'Youtube Music', value: 'youtube_music' },
        { name: 'Soundcloud', value: 'soundcloud' },
        { name: 'Spotify', value: 'spotify' }
      ))
  )
  .addSubcommand(sub => sub.setName("join").setDescription("Invite Nilou to the stage"))
  .addSubcommand(sub => sub.setName("leave").setDescription("Ask Nilou to take a final bow"))
  .addSubcommand(sub => sub.setName("pause").setDescription("Pause the current dance"))
  .addSubcommand(sub => sub.setName("resume").setDescription("Continue the performance"))
  .addSubcommand(sub => sub.setName("stop").setDescription("End the performance entirely"))
  .addSubcommand(sub => sub.setName("skip").setDescription("Move to the next melody"))
  .addSubcommand(sub => 
    sub.setName("skipto")
      .setDescription("Jump to a specific song in the program")
      .addIntegerOption(opt => opt.setName("position").setDescription("The song number in queue").setRequired(true))
  )
  .addSubcommand(sub => sub.setName("queue").setDescription("View the musical program"))
  .addSubcommand(sub => sub.setName("nowplaying").setDescription("Details of the current dance"))
  .addSubcommand(sub => sub.setName("shuffle").setDescription("Rearrange the upcoming melodies"))
  .addSubcommand(sub => sub.setName("clear").setDescription("Empty the upcoming list"))
  .addSubcommand(sub => 
    sub.setName("remove")
      .setDescription("Remove a melody from the program")
      .addIntegerOption(opt => opt.setName("position").setDescription("The song number to remove").setRequired(true))
  )
  .addSubcommand(sub => 
    sub.setName("volume")
      .setDescription("Adjust the theater's acoustics")
      .addIntegerOption(opt => opt.setName("percent").setDescription("Volume (0-100)").setRequired(true).setMinValue(0).setMaxValue(100))
  )
  .addSubcommand(sub => 
    sub.setName("loop")
      .setDescription("Set the repeat mode")
      .addStringOption(opt => opt.setName("mode").setDescription("Repeat type").setRequired(true)
        .addChoices(
          { name: 'None', value: 'none' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' }
        )
      )
  )
  .addSubcommand(sub => sub.setName("autoplay").setDescription("Let the music discover itself"))
  .addSubcommand(sub => sub.setName("247").setDescription("Keep Nilou on stage indefinitely"));

export async function execute(interaction) {
  const { options, member, guild, channel, client } = interaction;
  const voiceChannel = member.voice.channel;
  const manager = client.manager;

  if (!manager) {
    return interaction.reply({ content: "🌸 ✦ The theater's audio engine is currently resting!", ephemeral: true });
  }

  const subcommand = options.getSubcommand();
  if (!voiceChannel && !['queue', 'nowplaying'].includes(subcommand)) {
    return interaction.reply({ content: "🌸 ✦ Please join a voice channel first!", ephemeral: true });
  }

  await interaction.deferReply();

  try {
    let player = manager.players.get(guild.id);
    const needsPlayer = ['pause', 'resume', 'skip', 'stop', 'queue', 'nowplaying', 'shuffle', 'clear', 'volume', 'loop', 'leave', 'skipto', 'remove', 'autoplay', '247'];

    if (needsPlayer.includes(subcommand) && !player) {
      return interaction.editReply("🌸 ✦ The stage is quiet. Shall we start a new performance?");
    }

    switch (subcommand) {
      case "play": {
        let query = options.getString("query");
        let type = options.getString("type") || "youtube";

        if (!player) {
          player = await manager.createPlayer({
            guildId: guild.id,
            voiceId: voiceChannel.id,
            textId: channel.id,
            deaf: true
          });
        }

        let result = await manager.search(query, { requester: member.user, engine: type });

        // Auto-resolver for broken links
        if ((!result || !result.tracks.length) && query.includes("http")) {
            result = await manager.search(query, { requester: member.user, engine: "youtube" });
        }

        if (!result || !result.tracks.length) {
          return interaction.editReply("🌸 ✦ I couldn't find that specific melody in our archives.");
        }

        if (result.type === "PLAYLIST") {
          // Optimization: Add tracks in bulk for large playlists (200+)
          player.queue.add(result.tracks);
          if (!player.playing && !player.paused) await player.play();
          return interaction.editReply(`✨ ✦ The program **${result.playlistName}** (${result.tracks.length} tracks) has been added to the theater!`);
        } else {
          const track = result.tracks[0];
          player.queue.add(track);
          if (!player.playing && !player.paused) await player.play();
          return interaction.editReply(`🎵 ✦ Added to program: **${track.title}**`);
        }
      }

      case "queue": {
        const current = player.queue.current;
        const tracks = player.queue;
        const totalTracks = tracks.length;

        // Jockie-style: Paginated view showing only the next 10 items
        const pageSize = 10;
        const qList = tracks.slice(0, pageSize).map((t, i) => `\`${i + 1}.\` [${t.title}](${t.uri}) | \`${t.requester.username}\``).join("\n");

        const totalDuration = tracks.reduce((acc, cur) => acc + (cur.length || 0), 0) + (current?.length || 0);
        const durationStr = new Date(totalDuration).toISOString().substr(11, 8);

        const qEmbed = new EmbedBuilder()
          .setColor(NILOU_RED)
          .setTitle(`🌸 ✦ Performance Queue for ${guild.name}`)
          .setDescription(
            `**Now Performing:**\n${current ? `[${current.title}](${current.uri})` : "Silence"}\n\n` +
            `**Upcoming Melodies:**\n${qList || "_The stage is empty after this track..._"}`
          )
          .addFields(
            { name: "Program Details", value: `Tracks: \`${totalTracks + (current ? 1 : 0)}\` | Total Duration: \`${durationStr}\``, inline: true }
          )
          .setFooter({ text: `Theater: ${guild.name} • This message will vanish in 60s.` });

        const msg = await interaction.editReply({ embeds: [qEmbed] });

        // Auto-cleanup: Delete the queue message after 60 seconds
        setTimeout(() => {
          msg.delete().catch(() => {});
        }, 60000);
        return;
      }

      case "247": {
        const current247 = player.data.get("247") || false;
        player.data.set("247", !current247);

        if (!current247) {
          return interaction.editReply("🏠 ✦ **24/7 Mode Active.** I shall remain on stage even when the audience leaves!");
        } else {
          return interaction.editReply("👋 ✦ **24/7 Mode Inactive.** I will now leave the stage when it becomes empty to save energy.");
        }
      }

      case "leave":
        player.destroy();
        return interaction.editReply("🕊️ ✦ Thank you for watching. I'll take my bow and head backstage now.");

      case "join":
        if (!player) {
           await manager.createPlayer({ guildId: guild.id, voiceId: voiceChannel.id, textId: channel.id, deaf: true });
        }
        return interaction.editReply("🌸 ✦ I have arrived on stage!");

      case "pause":
        player.pause(true);
        return interaction.editReply("⏸️ ✦ Intermission starts now.");

      case "resume":
        player.pause(false);
        return interaction.editReply("▶️ ✦ Let the performance continue!");

      case "stop":
        player.destroy();
        return interaction.editReply("🛑 ✦ The theater has been closed.");

      case "skip":
        player.skip();
        return interaction.editReply("⏭️ ✦ Skipping to the next dance move.");

      case "skipto": {
        const pos = options.getInteger("position");
        if (pos > player.queue.length || pos <= 0) return interaction.editReply("🌸 ✦ That song number is not in the script.");
        player.skip(pos);
        return interaction.editReply(`⏭️ ✦ Jumping to melody #${pos}!`);
      }

      case "nowplaying": {
        const track = player.queue.current;
        if (!track) return interaction.editReply("🌸 ✦ The stage is empty.");
        const npEmbed = new EmbedBuilder()
          .setColor(NILOU_RED)
          .setTitle("🎵 ✦ Now Playing")
          .setThumbnail(track.thumbnail || null)
          .setDescription(`[${track.title}](${track.uri})\n${DIVIDER}\n*Requested by ${track.requester.username}*`);
        return interaction.editReply({ embeds: [npEmbed] });
      }

      case "remove": {
        const pos = options.getInteger("position");
        if (pos > player.queue.length || pos <= 0) return interaction.editReply("🌸 ✦ I couldn't find that melody.");
        const removed = player.queue.remove(pos - 1);
        return interaction.editReply(`🧹 ✦ Removed **${removed.title}**.`);
      }

      case "shuffle":
        player.queue.shuffle();
        return interaction.editReply("🔀 ✦ The melodies have been shuffled!");

      case "clear":
        player.queue.clear();
        return interaction.editReply("🧹 ✦ The upcoming list is now clean.");

      case "volume": {
        const v = options.getInteger("percent");
        player.setVolume(v);
        return interaction.editReply(`🔊 ✦ Volume set to **${v}%**.`);
      }

      case "loop": {
        const mode = options.getString("mode"); 
        player.setLoop(mode);
        return interaction.editReply(`🔁 ✦ Loop mode: **${mode}**.`);
      }

      case "autoplay": {
        const currentAutoplay = player.data.get("autoplay") || false;
        player.data.set("autoplay", !currentAutoplay);
        const state = !currentAutoplay ? "enabled" : "disabled";
        return interaction.editReply(`✨ ✦ Autoplay is now **${state}**.`);
      }

      default:
        return interaction.editReply("🌸 ✦ Unknown movement requested.");
    }
  } catch (err) {
    console.error("Music Error:", err);
    return interaction.editReply({ content: "🌸 ✦ A stage error occurred! Please check the theater settings." });
  }
}