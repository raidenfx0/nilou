import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { reactionRoles } from "../data/store.js";

export const data = new SlashCommandBuilder()
  .setName("reactionrole")
  .setDescription("Manage reaction roles")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a reaction role to a message")
      .addStringOption((o) =>
        o
          .setName("messageid")
          .setDescription("Message ID to add reaction role to")
          .setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName("emoji")
          .setDescription("Emoji to react with (e.g. ✅ or custom emoji name)")
          .setRequired(true)
      )
      .addRoleOption((o) =>
        o
          .setName("role")
          .setDescription("Role to assign when reacted")
          .setRequired(true)
      )
      .addChannelOption((o) =>
        o
          .setName("channel")
          .setDescription("Channel the message is in (default: current)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a reaction role from a message")
      .addStringOption((o) =>
        o
          .setName("messageid")
          .setDescription("Message ID")
          .setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName("emoji")
          .setDescription("Emoji to remove")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a reaction role embed and set up roles automatically")
      .addStringOption((o) =>
        o
          .setName("title")
          .setDescription("Embed title")
          .setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName("description")
          .setDescription("Embed description (explain the roles)")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all reaction roles in this server")
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === "add") {
    const messageId = interaction.options.getString("messageid");
    const emojiInput = interaction.options.getString("emoji").trim();
    const role = interaction.options.getRole("role");
    const channel =
      interaction.options.getChannel("channel") || interaction.channel;

    let message;
    try {
      message = await channel.messages.fetch(messageId);
    } catch {
      return interaction.reply({
        content: `❌ Message not found in <#${channel.id}>. Make sure the ID is correct.`,
        ephemeral: true,
      });
    }

    const emojiMatch = emojiInput.match(/^<a?:(\w+):(\d+)>$/);
    let reactionEmoji = emojiInput;
    let storeKey;

    if (emojiMatch) {
      reactionEmoji = emojiMatch[2];
      storeKey = `${guildId}:${messageId}:${emojiMatch[2]}`;
    } else {
      storeKey = `${guildId}:${messageId}:${emojiInput}`;
    }

    try {
      await message.react(emojiInput);
    } catch {
      return interaction.reply({
        content: `❌ Could not react with that emoji. Make sure the bot has access to it.`,
        ephemeral: true,
      });
    }

    reactionRoles.set(storeKey, role.id);

    await interaction.reply({
      content: `✅ Reaction role set! Reacting with ${emojiInput} on [that message](${message.url}) will give the **${role.name}** role.`,
      ephemeral: true,
    });
  } else if (sub === "remove") {
    const messageId = interaction.options.getString("messageid");
    const emojiInput = interaction.options.getString("emoji").trim();

    const emojiMatch = emojiInput.match(/^<a?:(\w+):(\d+)>$/);
    const emojiKey = emojiMatch ? emojiMatch[2] : emojiInput;
    const storeKey = `${guildId}:${messageId}:${emojiKey}`;

    if (!reactionRoles.has(storeKey)) {
      return interaction.reply({
        content: "❌ No reaction role found for that message + emoji combination.",
        ephemeral: true,
      });
    }

    reactionRoles.delete(storeKey);
    await interaction.reply({
      content: `✅ Reaction role removed.`,
      ephemeral: true,
    });
  } else if (sub === "create") {
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: "React below to get a role" })
      .setTimestamp();

    const sent = await interaction.channel.send({ embeds: [embed] });

    await interaction.reply({
      content: `✅ Reaction role embed created! Message ID: \`${sent.id}\`\nNow use \`/reactionrole add\` with that ID to link emojis to roles.`,
      ephemeral: true,
    });
  } else if (sub === "list") {
    const entries = [...reactionRoles.entries()].filter(([key]) =>
      key.startsWith(`${guildId}:`)
    );

    if (entries.length === 0) {
      return interaction.reply({
        content: "❌ No reaction roles configured in this server.",
        ephemeral: true,
      });
    }

    const lines = entries.map(([key, roleId]) => {
      const parts = key.split(":");
      const msgId = parts[1];
      const emoji = parts[2];
      return `Message \`${msgId}\` + ${emoji} → <@&${roleId}>`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Reaction Roles")
      .setDescription(lines.join("\n"))
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
