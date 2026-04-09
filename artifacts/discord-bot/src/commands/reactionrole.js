import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { reactionRoles } from "../data/store.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";

export const data = new SlashCommandBuilder()
  .setName("reactionrole")
  .setDescription("Manage reaction roles")
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a reaction role to a message")
      .addStringOption((o) => o.setName("messageid").setDescription("Message ID").setRequired(true))
      .addStringOption((o) => o.setName("emoji").setDescription("Emoji to react with").setRequired(true))
      .addRoleOption((o)   => o.setName("role").setDescription("Role to assign").setRequired(true))
      .addChannelOption((o) => o.setName("channel").setDescription("Channel the message is in").setRequired(false))
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a reaction role")
      .addStringOption((o) => o.setName("messageid").setDescription("Message ID").setRequired(true))
      .addStringOption((o) => o.setName("emoji").setDescription("Emoji to remove").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a reaction role embed")
      .addStringOption((o) => o.setName("title").setDescription("Embed title").setRequired(true))
      .addStringOption((o) => o.setName("description").setDescription("Describe the roles").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all reaction roles in this server")
  );

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) return denyAdmin(interaction);
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === "add") {
    const messageId  = interaction.options.getString("messageid");
    const emojiInput = interaction.options.getString("emoji").trim();
    const role       = interaction.options.getRole("role");
    const channel    = interaction.options.getChannel("channel") || interaction.channel;

    let message;
    try {
      message = await channel.messages.fetch(messageId);
    } catch {
      return interaction.reply({
        content: `💧 Message not found in <#${channel.id}>. Double-check the ID!`,
        ephemeral: true,
      });
    }

    const emojiMatch = emojiInput.match(/^<a?:(\w+):(\d+)>$/);
    const storeKey   = emojiMatch
      ? `${guildId}:${messageId}:${emojiMatch[2]}`
      : `${guildId}:${messageId}:${emojiInput}`;

    try {
      await message.react(emojiInput);
    } catch {
      return interaction.reply({
        content: `💧 Nilou couldn't react with that emoji — make sure she has access to it!`,
        ephemeral: true,
      });
    }

    reactionRoles.set(storeKey, role.id);

    await interaction.reply({
      content: `🌸 Reaction role set! ${emojiInput} on [that message](${message.url}) grants **${role.name}**.`,
      ephemeral: true,
    });
  } else if (sub === "remove") {
    const messageId  = interaction.options.getString("messageid");
    const emojiInput = interaction.options.getString("emoji").trim();
    const emojiMatch = emojiInput.match(/^<a?:(\w+):(\d+)>$/);
    const emojiKey   = emojiMatch ? emojiMatch[2] : emojiInput;
    const storeKey   = `${guildId}:${messageId}:${emojiKey}`;

    if (!reactionRoles.has(storeKey)) {
      return interaction.reply({
        content: "💧 No reaction role found for that message + emoji.",
        ephemeral: true,
      });
    }
    reactionRoles.delete(storeKey);
    await interaction.reply({ content: "✨ Reaction role gracefully removed.", ephemeral: true });
  } else if (sub === "create") {
    const title       = interaction.options.getString("title");
    const description = interaction.options.getString("description");

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`🌺 ✦ ${title}`)
      .setDescription(`${DIVIDER}\n${description}\n${DIVIDER}\nReact below to receive your role~`)
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    const sent = await interaction.channel.send({ embeds: [embed] });

    await interaction.reply({
      content: `🌸 Reaction role embed created!\nMessage ID: \`${sent.id}\`\nNow use \`/reactionrole add\` to link emojis to roles.`,
      ephemeral: true,
    });
  } else if (sub === "list") {
    const entries = [...reactionRoles.entries()].filter(([key]) => key.startsWith(`${guildId}:`));

    if (entries.length === 0) {
      return interaction.reply({ content: "💧 No reaction roles configured in this server yet.", ephemeral: true });
    }

    const lines = entries.map(([key, roleId]) => {
      const parts = key.split(":");
      return `📌 Message \`${parts[1]}\` + ${parts[2]} → <@&${roleId}>`;
    });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("🌺 ✦ Reaction Roles")
      .setDescription(`${DIVIDER}\n${lines.join("\n")}\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
