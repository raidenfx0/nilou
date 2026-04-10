import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { tickets, ticketConfig } from "../data/store.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";

// ABSOLUTE LOCK: Prevents a user from starting any ticket process while one is active.
const creationLock = new Set();

// --- SLASH COMMAND DEFINITION ---
export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Comprehensive ticket system")
  .addSubcommand((sub) =>
    sub
      .setName("panel")
      .setDescription("Send the ticket panel embed with buttons (admin only)")
      .addChannelOption((o) =>
        o.setName("channel").setDescription("Channel to send the panel to").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("setup")
      .setDescription("Configure ticket system settings (admin only)")
      .addStringOption((o) => o.setName("support_category").setDescription("Numeric ID ONLY for Support Category").setRequired(false))
      .addStringOption((o) => o.setName("appeal_category").setDescription("Numeric ID ONLY for Appeal Category").setRequired(false))
      .addStringOption((o) => o.setName("partnership_category").setDescription("Numeric ID ONLY for Partnership Category").setRequired(false))
      .addStringOption((o) => o.setName("staff_role").setDescription("Numeric ID ONLY for Staff Role").setRequired(false))
      .addStringOption((o) => o.setName("log_channel").setDescription("Numeric ID ONLY for Log Channel").setRequired(false))
  )
  .addSubcommand((sub) =>
    sub
      .setName("open")
      .setDescription("Open a ticket via slash command")
      .addStringOption((o) =>
        o.setName("type")
          .setDescription("Select the type of ticket")
          .setRequired(true) 
          .addChoices(
            { name: "Support", value: "Support" },
            { name: "Appeal", value: "Appeal" },
            { name: "Partnership", value: "Partnership" }
          )
      )
      .addStringOption((o) => o.setName("reason").setDescription("Reason for opening").setRequired(false))
  )
  .addSubcommand((sub) => sub.setName("close").setDescription("Close this ticket channel"))
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a user to this ticket")
      .addUserOption((o) => o.setName("user").setDescription("User to add").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a user from this ticket")
      .addUserOption((o) => o.setName("user").setDescription("User to remove").setRequired(true))
  );

// --- SLASH COMMAND EXECUTION ---
export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "setup") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const validateId = (str) => {
      if (!str) return null;
      // Extract only digits (removes tags like <@&...>)
      const cleaned = str.replace(/\D/g, "").trim();
      return cleaned.length >= 17 ? cleaned : "INVALID";
    };

    const inputs = {
      supportCategoryId: validateId(interaction.options.getString("support_category")),
      appealCategoryId: validateId(interaction.options.getString("appeal_category")),
      partnershipCategoryId: validateId(interaction.options.getString("partnership_category")),
      staffRoleId: validateId(interaction.options.getString("staff_role")),
      logChannelId: validateId(interaction.options.getString("log_channel")),
    };

    // If any input was provided but failed validation
    if (Object.values(inputs).some(v => v === "INVALID")) {
      return interaction.reply({ 
        content: "❌ **Setup Failed!** Please use **Numeric IDs** only. Copy the IDs from Developer Mode.", 
        ephemeral: true 
      });
    }

    const existing = ticketConfig.get(interaction.guildId) || {};
    // Only update the ones that were actually provided in the command
    Object.keys(inputs).forEach(k => { 
      if (inputs[k] !== null) existing[k] = inputs[k]; 
    });

    ticketConfig.set(interaction.guildId, existing);

    const setupEmbed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Ticket System Setup")
      .setDescription(`${DIVIDER}\n🌸 **Current Configuration (Raw IDs)**\n\n` +
        `🎫 **Support:** \`${existing.supportCategoryId || 'None'}\`\n` +
        `⚖️ **Appeal:** \`${existing.appealCategoryId || 'None'}\`\n` +
        `🤝 **Partnership:** \`${existing.partnershipCategoryId || 'None'}\`\n` +
        `👤 **Staff Role:** \`${existing.staffRoleId || 'None'}\`\n` +
        `📜 **Logs:** \`${existing.logChannelId || 'None'}\`\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN);

    return interaction.reply({ embeds: [setupEmbed], ephemeral: true });
  }

  if (sub === "panel") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const target = interaction.options.getChannel("channel");
    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Create a Ticket")
      .setDescription(`${DIVIDER}\n🌸 Click a button to open a private ticket.\n\n🎫 **Support**\n⚖️ **Appeal**\n🤝 **Partnership**\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_support").setLabel("Support").setStyle(ButtonStyle.Primary).setEmoji("🎫"),
      new ButtonBuilder().setCustomId("btn_appeal").setLabel("Appeal").setStyle(ButtonStyle.Secondary).setEmoji("⚖️"),
      new ButtonBuilder().setCustomId("btn_partnership").setLabel("Partnership").setStyle(ButtonStyle.Success).setEmoji("🤝")
    );
    await target.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: "🌸 Panel successfully deployed!", ephemeral: true });
  }

  if (sub === "open") {
    const type = interaction.options.getString("type");
    const reason = interaction.options.getString("reason") || "No reason specified";
    await interaction.deferReply({ ephemeral: true });
    const result = await openTicket({ guild: interaction.guild, user: interaction.user, type, reason });
    return interaction.editReply({ content: result.error ? `❌ ${result.error}` : `🌸 Ticket created: ${result.channel}!` });
  }

  if (sub === "close") {
    const ticketId = `${interaction.guildId}:${interaction.channelId}`;
    const ticket = tickets.get(ticketId);

    const isTicketChannel = interaction.channel.name.match(/^(support|appeal|partnership)-/);

    if (!ticket && !isTicketChannel) {
      return interaction.reply({ content: "❌ This is not a valid ticket channel.", ephemeral: true });
    }

    if (ticket && ticket.userId !== interaction.user.id && !isAdmin(interaction.member)) {
      return interaction.reply({ content: "❌ You cannot close this ticket.", ephemeral: true });
    }

    await interaction.reply({ embeds: [closeEmbed(interaction.user)] });
    return closeTicket(interaction.channel, ticket || { type: "Unknown", userId: "0" }, ticketId, interaction.user, interaction.guild);
  }

  if (sub === "add" || sub === "remove") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const targetUser = interaction.options.getUser("user");
    if (sub === "add") {
      await interaction.channel.permissionOverwrites.create(targetUser.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
      return interaction.reply({ content: `🌸 Added ${targetUser} to the ticket.` });
    } else {
      await interaction.channel.permissionOverwrites.delete(targetUser.id);
      return interaction.reply({ content: `🌸 Removed ${targetUser} from the ticket.` });
    }
  }
}

// --- CORE TICKET LOGIC ---

export async function openTicket({ guild, user, type, reason }) {
  const userId = user.id;
  const lockKey = `${guild.id}:${userId}`;

  // Double-check the lock to prevent duplicate clicks from creating two channels
  if (creationLock.has(lockKey)) {
    return { error: "Ticket creation is already in progress. Please wait a moment." };
  }

  creationLock.add(lockKey);

  try {
    const config = ticketConfig.get(guild.id) || {};

    // Check if user already has an open ticket of this type
    const existing = [...tickets.values()].find(t => t.userId === userId && t.guildId === guild.id && t.open && t.type === type);
    if (existing) {
      return { error: `You already have an open **${type}** ticket!` };
    }

    // Determine the correct category ID
    let categoryId = null;
    if (type === "Support") categoryId = config.supportCategoryId;
    if (type === "Appeal") categoryId = config.appealCategoryId;
    if (type === "Partnership") categoryId = config.partnershipCategoryId;

    // Block creation if category isn't set
    if (!categoryId) {
      return { error: `The category for **${type}** tickets has not been set up yet.` };
    }

    // Explicitly fetch category to ensure it exists and we can see it
    const category = await guild.channels.fetch(categoryId).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return { error: `The category ID provided for **${type}** is invalid. Please update it in \`/ticket setup\`.` };
    }

    // Create the ticket channel strictly inside the parent category
    const channel = await guild.channels.create({
      name: `${type.toLowerCase()}-${user.username.slice(0, 15)}`,
      type: ChannelType.GuildText,
      parent: category.id, 
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
        ...(config.staffRoleId ? [{ id: config.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
      ],
      topic: `${type} Ticket | User: ${user.tag}`
    });

    // Save to memory
    tickets.set(`${guild.id}:${channel.id}`, { guildId: guild.id, userId, channelId: channel.id, type, open: true });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`✦ ${type} Ticket`)
      .setDescription(`${DIVIDER}\n🌸 Hello ${user}!\nReason: **${reason}**\n\nStaff will assist you shortly.\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_ticket").setLabel("Close").setStyle(ButtonStyle.Danger).setEmoji("🔒")
    );

    const ping = config.staffRoleId ? `<@&${config.staffRoleId}> ${user}` : `${user}`;
    await channel.send({ content: ping, embeds: [embed], components: [row] });

    return { channel };
  } catch (err) {
    console.error("Ticket Creation Error:", err);
    return { error: "Failed to create the ticket channel. Please check my permissions." };
  } finally {
    // Hold the lock for 10 seconds to ensure the process is fully finished
    setTimeout(() => creationLock.delete(lockKey), 10000);
  }
}

export async function closeTicket(channel, ticket, ticketId, user, guild) {
  try {
    const config = ticketConfig.get(guild.id) || {};
    if (tickets.has(ticketId)) {
      const data = tickets.get(ticketId);
      data.open = false;
      tickets.set(ticketId, data);
    }

    if (config.logChannelId) {
      const logCh = await guild.channels.fetch(config.logChannelId).catch(() => null);
      if (logCh) {
        const log = new EmbedBuilder()
          .setColor(NILOU_RED)
          .setTitle("✦ Ticket Closed")
          .setDescription(`**User:** <@${ticket.userId}>\n**Type:** ${ticket.type}\n**Closed By:** ${user}`)
          .setTimestamp();
        logCh.send({ embeds: [log] }).catch(() => {});
      }
    }

    setTimeout(async () => {
      try { 
        await channel.delete(); 
        tickets.delete(ticketId); 
      } catch (e) {}
    }, 5000);
  } catch (err) {}
}

export function closeEmbed(user) {
  return new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ Closing Ticket")
    .setDescription(`${DIVIDER}\n🌸 This channel will be deleted in **5 seconds**.\nInitiated by: ${user}\n${DIVIDER}`)
    .setFooter(FOOTER_MAIN);
}