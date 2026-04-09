import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { stickyMessages } from "../data/store.js";

export const data = new SlashCommandBuilder()
  .setName("sticky")
  .setDescription("Manage sticky messages in a channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Set a sticky message in this channel")
      .addStringOption((o) =>
        o
          .setName("content")
          .setDescription("The sticky message content")
          .setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("title").setDescription("Embed title").setRequired(false)
      )
      .addStringOption((o) =>
        o
          .setName("color")
          .setDescription("Hex color (e.g. #FF5733)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove the sticky message from this channel")
  )
  .addSubcommand((sub) =>
    sub.setName("view").setDescription("View the current sticky message")
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const key = `${interaction.guildId}:${interaction.channelId}`;

  if (sub === "set") {
    const content = interaction.options.getString("content");
    const title = interaction.options.getString("title") || "📌 Pinned Message";
    const colorInput = interaction.options.getString("color");

    let color = 0x5865f2;
    if (colorInput) {
      const parsed = parseInt(colorInput.replace("#", ""), 16);
      if (!isNaN(parsed)) color = parsed;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(content)
      .setTimestamp()
      .setFooter({ text: "Sticky Message" });

    const sent = await interaction.channel.send({ embeds: [embed] });

    stickyMessages.set(key, {
      content,
      title,
      color,
      lastMessageId: sent.id,
    });

    await interaction.reply({
      content: `✅ Sticky message set! It will reappear after every new message.`,
      ephemeral: true,
    });
  } else if (sub === "remove") {
    if (!stickyMessages.has(key)) {
      return interaction.reply({
        content: "❌ No sticky message set in this channel.",
        ephemeral: true,
      });
    }

    const sticky = stickyMessages.get(key);
    if (sticky.lastMessageId) {
      try {
        const old = await interaction.channel.messages.fetch(
          sticky.lastMessageId
        );
        if (old) await old.delete();
      } catch {}
    }

    stickyMessages.delete(key);
    await interaction.reply({
      content: "✅ Sticky message removed.",
      ephemeral: true,
    });
  } else if (sub === "view") {
    if (!stickyMessages.has(key)) {
      return interaction.reply({
        content: "❌ No sticky message set in this channel.",
        ephemeral: true,
      });
    }
    const sticky = stickyMessages.get(key);
    await interaction.reply({
      content: `**Current sticky:** ${sticky.title}\n${sticky.content}`,
      ephemeral: true,
    });
  }
}
