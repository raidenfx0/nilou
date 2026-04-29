import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { NILOU_RED, DIVIDER } from "../theme.js";

/**
 * Utility to format time in HH:MM:SS or MM:SS
 */
function formatTime(ms) {
  if (!ms || isNaN(ms) || ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const m = minutes.toString().padStart(2, "0");
  const s = seconds.toString().padStart(2, "0");

  if (hours > 0) {
    const h = hours.toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  }
  return `${m}:${s}`;
}

/**
 * Generates a clean progress bar for the performance
 */
function createProgressBar(current, total, size = 18) {
  if (!current || !total) return "─── 🌸 ───";
  const progress = Math.min(size, Math.round((size * current) / total));
  const emptyProgress = size - progress;
  const progressText = "▬".repeat(progress);
  const emptyProgressText = "─".repeat(emptyProgress);
  return `**${progressText}**🌸**${emptyProgressText}**`;
}

/**
 * Helper to create a consistent Now Performing embed
 */
export function createNowPlayingEmbed(player) {
  const track = player.queue.current;
  if (!track) return null;

  const position = player.position || 0;
  const duration = track.duration || track.length || 0;

  return new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("🎭 ✦ Now Performing")
    .setThumbnail(
      track.thumbnail || track.displayThumbnail?.("maxresdefault") || null,
    )
    .setDescription(
      `**[${track.title}](${track.uri})**\n` +
        `*By ${track.author}*\n\n` +
        `${createProgressBar(position, duration)}\n` +
        `\`${formatTime(position)} / ${formatTime(duration)}\``,
    )
    .setFooter({
      text: `Requested by ${track.requester?.username || "Audience"} • 24/7: ${player.data.get("247") ? "ON" : "OFF"}`,
    });
}

/**
 * Updates or Clears the Voice Channel Status
 */
async function updateVoiceStatus(player, client, clear = false) {
  try {
    const channelId = player.voiceId;
    if (!channelId) return;

    let status = "";
    if (!clear) {
      const track = player.queue.current;
      status = track ? `Nilou is dancing`.substring(0, 490) : "";
    }

    await client.rest.put(`/channels/${channelId}/voice-status`, {
      body: { status: status },
    });
  } catch (err) {
    // Silently fail if permissions are missing
  }
}

export const data = new SlashCommandBuilder()
  .setName("music")
  .setDescription("Nilou's Grand Theater Musical Performance System")
  .addSubcommand((sub) =>
    sub
      .setName("play")
      .setDescription("Start a beautiful performance")
      .addStringOption((opt) =>
        opt
          .setName("query")
          .setDescription("Song name, Spotify/YT link, or Playlist")
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("Preferred source")
          .addChoices(
            { name: "YouTube Music", value: "youtube_music" },
            { name: "YouTube", value: "youtube" },
            { name: "SoundCloud", value: "soundcloud" },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("insert")
      .setDescription("Add a melody to the absolute top of the program")
      .addStringOption((opt) =>
        opt
          .setName("query")
          .setDescription("The song name or link")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("move")
      .setDescription("Move a melody to a new position")
      .addIntegerOption((opt) =>
        opt
          .setName("from")
          .setDescription("Current position")
          .setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt.setName("to").setDescription("New position").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a melody from the program")
      .addIntegerOption((opt) =>
        opt
          .setName("position")
          .setDescription("The song number to remove")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("join").setDescription("Invite Nilou to the stage"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("leave")
      .setDescription("Ask Nilou to take a final bow and exit"),
  )
  .addSubcommand((sub) =>
    sub.setName("pause").setDescription("Pause the current dance"),
  )
  .addSubcommand((sub) =>
    sub.setName("resume").setDescription("Continue the performance"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("stop")
      .setDescription("End the performance and clear the program"),
  )
  .addSubcommand((sub) =>
    sub.setName("skip").setDescription("Move gracefully to the next melody"),
  )
  .addSubcommand((sub) =>
    sub.setName("previous").setDescription("Return to the previous melody"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("skipto")
      .setDescription("Jump to a specific song in the program")
      .addIntegerOption((opt) =>
        opt
          .setName("position")
          .setDescription("The song number in queue")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("seek")
      .setDescription("Shift to a specific time in the song")
      .addIntegerOption((opt) =>
        opt
          .setName("seconds")
          .setDescription("Time in seconds")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("queue").setDescription("View the theater's musical program"),
  )
  .addSubcommand((sub) =>
    sub.setName("nowplaying").setDescription("Details of the current dance"),
  )
  .addSubcommand((sub) =>
    sub.setName("shuffle").setDescription("Rearrange upcoming melodies"),
  )
  .addSubcommand((sub) =>
    sub.setName("clear").setDescription("Empty the upcoming program list"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("volume")
      .setDescription("Adjust the theater's acoustics")
      .addIntegerOption((opt) =>
        opt
          .setName("percent")
          .setDescription("Volume (0-100)")
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(100),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("loop")
      .setDescription("Set the repeat mode")
      .addStringOption((opt) =>
        opt
          .setName("mode")
          .setDescription("Repeat type")
          .setRequired(true)
          .addChoices(
            { name: "None", value: "none" },
            { name: "Track", value: "track" },
            { name: "Queue", value: "queue" },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("autoplay")
      .setDescription("Let the theater choose the next melodies"),
  )
  .addSubcommand((sub) =>
    sub.setName("247").setDescription("Keep Nilou on stage indefinitely"),
  );

export async function execute(interaction) {
  const { options, member, guild, channel, client } = interaction;
  const voiceChannel = member.voice.channel;
  const manager = client.manager;

  if (!manager)
    return interaction.reply({
      content: "🌸 ✦ Audio engine offline!",
      ephemeral: true,
    });

  const subcommand = options.getSubcommand();
  if (!voiceChannel && !["queue", "nowplaying"].includes(subcommand)) {
    return interaction.reply({
      content: "🌸 ✦ Please join a voice channel first!",
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    let player = manager.players.get(guild.id);
    const needsPlayer = [
      "pause",
      "resume",
      "skip",
      "previous",
      "stop",
      "queue",
      "nowplaying",
      "shuffle",
      "clear",
      "volume",
      "loop",
      "leave",
      "skipto",
      "seek",
      "move",
      "remove",
      "autoplay",
      "247",
    ];

    if (needsPlayer.includes(subcommand) && !player) {
      return interaction.editReply(
        "🌸 ✦ The stage is silent. Start a performance first!",
      );
    }

    switch (subcommand) {
      case "join": {
        if (!player) {
          player = await manager.createPlayer({
            guildId: guild.id,
            voiceId: voiceChannel.id,
            textId: channel.id,
            deaf: true,
          });
          return interaction.editReply("🌸 ✦ I have arrived on stage!");
        }
        return interaction.editReply("🌸 ✦ I am already here.");
      }

      case "play":
      case "insert": {
        let query = options.getString("query");
        let type = options.getString("type") || "youtube_music";

        if (!player) {
          player = await manager.createPlayer({
            guildId: guild.id,
            voiceId: voiceChannel.id,
            textId: channel.id,
            deaf: true,
          });
        }

        const result = await manager.search(query, {
          requester: member.user,
          engine: type,
        });

        if (!result?.tracks?.length)
          return interaction.editReply("🌸 ✦ No melody found.");

        if (
          result.type === "PLAYLIST" ||
          result.loadType === "PLAYLIST_LOADED"
        ) {
          player.queue.add(result.tracks);
          if (!player.playing && !player.paused) {
            await player.play();
            updateVoiceStatus(player, client);
          }
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(NILOU_RED)
                .setDescription(
                  `✨ ✦ Added **${result.tracks.length}** songs from playlist **${result.playlistName || "Unknown"}**!`,
                ),
            ],
          });
        }

        const track = result.tracks[0];
        const isStarting = !player.playing && !player.paused;

        if (subcommand === "insert") {
          player.queue.unshift
            ? player.queue.unshift(track)
            : player.queue.add(track, 0);
        } else {
          player.queue.add(track);
        }

        if (isStarting) {
          await player.play();
          updateVoiceStatus(player, client);
          await new Promise((r) => setTimeout(r, 800));
          return interaction.editReply({
            embeds: [createNowPlayingEmbed(player)],
          });
        }

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription(
                subcommand === "insert"
                  ? `✨ ✦ **High Priority:** Added **[${track.title}](${track.uri})** to the very top of the program!`
                  : `🎵 ✦ Added: **[${track.title}](${track.uri})** to the program.`,
              ),
          ],
        });
      }

      case "move": {
        const from = options.getInteger("from") - 1;
        const to = options.getInteger("to") - 1;

        if (
          from < 0 ||
          from >= player.queue.length ||
          to < 0 ||
          to >= player.queue.length
        ) {
          return interaction.editReply(
            "🌸 ✦ Invalid positions. Please check the current program order.",
          );
        }

        const track = player.queue[from];
        player.queue.splice(from, 1);
        player.queue.splice(to, 0, track);

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription(
                `✨ ✦ Repositioned **${track.title}** to spot **#${to + 1}** in the program.`,
              ),
          ],
        });
      }

      case "remove": {
        const pos = options.getInteger("position") - 1;
        if (pos < 0 || pos >= player.queue.length)
          return interaction.editReply("🌸 ✦ Invalid position.");

        const removed = player.queue[pos];
        player.queue.splice(pos, 1);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription(
                `🗑️ ✦ Removed **${removed.title}** from the program.`,
              ),
          ],
        });
      }

      case "shuffle": {
        if (!player.queue.length)
          return interaction.editReply(
            "🌸 ✦ Not enough melodies to rearrange.",
          );
        for (let i = player.queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [player.queue[i], player.queue[j]] = [
            player.queue[j],
            player.queue[i],
          ];
        }
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription(
                "🔀 ✦ The upcoming program has been beautifully rearranged!",
              ),
          ],
        });
      }

      case "clear": {
        player.queue.clear();
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription("🧹 ✦ The upcoming list is now clean."),
          ],
        });
      }

      case "skipto": {
        const pos = options.getInteger("position") - 1;
        if (pos < 0 || pos >= player.queue.length)
          return interaction.editReply("🌸 ✦ Invalid position.");

        player.queue.splice(0, pos);
        player.skip();
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription(`⏭️ ✦ Jumping ahead to act **#${pos + 1}**!`),
          ],
        });
      }

      case "seek": {
        const seconds = options.getInteger("seconds");
        const track = player.queue.current;
        if (!track) return interaction.editReply("🌸 ✦ Nothing is playing.");
        const ms = seconds * 1000;
        if (ms > track.duration)
          return interaction.editReply(
            "🌸 ✦ You cannot seek past the end of the melody!",
          );
        player.seek(ms);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription(
                `⏩ ✦ Shifted performance to \`${formatTime(ms)}\`.`,
              ),
          ],
        });
      }

      case "nowplaying": {
        const embed = createNowPlayingEmbed(player);
        return interaction.editReply({
          embeds: [
            embed ||
              new EmbedBuilder()
                .setColor(NILOU_RED)
                .setDescription("🌸 ✦ Stage is silent."),
          ],
        });
      }

      case "queue": {
        const tracks = player.queue;
        const current = player.queue.current;
        if (!tracks.length && !current)
          return interaction.editReply("🌸 ✦ Program is empty.");

        let page = 0;
        const pageSize = 10;
        const totalPages = Math.ceil(tracks.length / pageSize) || 1;

        const generateEmbed = (p) => {
          const start = p * pageSize;
          const end = start + pageSize;
          const qList = tracks
            .slice(start, end)
            .map(
              (t, i) =>
                `\`${start + i + 1}.\` **${t.title.substring(0, 45)}**\n└ *${t.author}*`,
            )
            .join("\n\n");
          return new EmbedBuilder()
            .setColor(NILOU_RED)
            .setTitle(`📜 ✦ Theater Program: ${guild.name}`)
            .setDescription(
              `**Performing:**\n${current ? `**${current.title}**` : "None"}\n\n**Upcoming:**\n${qList || "_No more acts..._"}`,
            )
            .setFooter({ text: `Page ${p + 1} of ${totalPages}` });
        };

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("first")
            .setLabel("⏮")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("prev")
            .setLabel("◀")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("next")
            .setLabel("▶")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(totalPages <= 1),
          new ButtonBuilder()
            .setCustomId("last")
            .setLabel("⏭")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(totalPages <= 1),
        );

        const msg = await interaction.editReply({
          embeds: [generateEmbed(0)],
          components: totalPages > 1 ? [row] : [],
        });
        if (totalPages <= 1) return;

        const collector = msg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 60000,
        });
        collector.on("collect", async (i) => {
          if (i.user.id !== interaction.user.id)
            return i.reply({ content: "🌸 ✦ Not for you!", ephemeral: true });
          if (i.customId === "first") page = 0;
          else if (i.customId === "prev") page--;
          else if (i.customId === "next") page++;
          else if (i.customId === "last") page = totalPages - 1;

          row.components[0].setDisabled(page === 0);
          row.components[1].setDisabled(page === 0);
          row.components[2].setDisabled(page >= totalPages - 1);
          row.components[3].setDisabled(page >= totalPages - 1);
          await i.update({ embeds: [generateEmbed(page)], components: [row] });
        });
        return;
      }

      case "skip": {
        if (!player.queue.current)
          return interaction.editReply("🌸 ✦ Nothing is playing.");
        player.skip();
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription("⏭️ ✦ Skipping to the next dance move."),
          ],
        });
      }

      case "previous": {
        const prev = player.queue.previous;
        if (!prev)
          return interaction.editReply("🌸 ✦ No previous melody found.");
        player.queue.add(prev, 0);
        player.skip();
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription("⏪ ✦ Returning to the previous melody."),
          ],
        });
      }

      case "autoplay": {
        const current = player.data.get("autoplay") || false;
        player.data.set("autoplay", !current);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription(
                !current
                  ? "✨ ✦ **Autoplay Enabled.** The theater will now choose the next melodies!"
                  : "🔇 ✦ **Autoplay Disabled.**",
              ),
          ],
        });
      }

      case "stop":
      case "leave":
        await updateVoiceStatus(player, client, true);
        player.destroy();
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription(
                "🛑 ✦ The theater has closed. Thank you for watching!",
              ),
          ],
        });

      case "pause":
        player.pause(true);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription(
                "⏸️ ✦ Intermission starts now. The music is paused.",
              ),
          ],
        });

      case "resume":
        player.pause(false);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription("▶️ ✦ Let the performance continue!"),
          ],
        });

      case "volume": {
        const vol = options.getInteger("percent");
        player.setVolume(vol);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription(`🔊 ✦ Acoustics adjusted to **${vol}%**.`),
          ],
        });
      }

      case "loop": {
        const mode = options.getString("mode");
        player.setLoop(mode);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription(`🔁 ✦ Loop mode: **${mode.toUpperCase()}**.`),
          ],
        });
      }

      case "247": {
        const current = player.data.get("247") || false;
        player.data.set("247", !current);
        player.stayOn = !current;
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(NILOU_RED)
              .setDescription(
                !current
                  ? "🏠 ✦ **24/7 Mode Enabled.** I'll stay on stage indefinitely."
                  : "👋 ✦ **24/7 Mode Disabled.**",
              ),
          ],
        });
      }

      default:
        return interaction.editReply("🌸 ✦ Move not recognized.");
    }
  } catch (err) {
    console.error(err);
    return interaction.editReply("🌸 ✦ A theater error occurred.");
  }
}
