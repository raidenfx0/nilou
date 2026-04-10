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

// Prevent double-creation if the command is triggered multiple times quickly
const creationLocks = new Set();

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
      .addStringOption((o) => o.setName("support_category").setDescription("Category ID for Support tickets").setRequired(false))
      .addStringOption((o) => o.setName("appeal_category").setDescription("Category ID for Appeal tickets").setRequired(false))
      .addStringOption((o) => o.setName("partnership_category").setDescription("Category ID for Partnership tickets").setRequired(false))
      .addStringOption((o) => o.setName("staff_role").setDescription("Staff Role ID - can see all tickets").setRequired(false))
      .addStringOption((o) => o.setName("log_channel").setDescription("Channel ID to log ticket activity").setRequired(false))
  )
  .addSubcommand((sub) =>
    sub
      .setName("open")
      .setDescription("Open a ticket via slash command")
      .addStringOption((o) =>
        o.setName("type").setDescription("Ticket type").setRequired(false)
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

  // 1. SETUP COMMAND
  if (sub === "setup") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const updates = {
      supportCategoryId: interaction.options.getString("support_category"),
      appealCategoryId: interaction.options.getString("appeal_category"),
      partnershipCategoryId: interaction.options.getString("partnership_category"),
      staffRoleId: interaction.options.getString("staff_role"),
      logChannelId: interaction.options.getString("log_channel"),
    };
    const existing = ticketConfig.get(interaction.guildId) || {};
    Object.keys(updates).forEach(k => { if (updates[k]) existing[k] = updates[k]; });
    ticketConfig.set(interaction.guildId, existing);
    return interaction.reply({ content: "🌸 Ticket configuration has been updated successfully!", ephemeral: true });
  }

  // 2. PANEL COMMAND
  if (sub === "panel") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const target = interaction.options.getChannel("channel");
    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Support Tickets")
      .setDescription(`${DIVIDER}\n🌸 Click one of the buttons below to open a ticket.\n\n🎫 **Support**\n⚖️ **Appeal**\n🤝 **Partnership**\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_support").setLabel("Support").setStyle(ButtonStyle.Primary).setEmoji("🎫"),
      new ButtonBuilder().setCustomId("btn_appeal").setLabel("Appeal").setStyle(ButtonStyle.Secondary).setEmoji("⚖️"),
      new ButtonBuilder().setCustomId("btn_partnership").setLabel("Partnership").setStyle(ButtonStyle.Success).setEmoji("🤝")
    );
    await target.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: "🌸 Ticket panel sent!", ephemeral: true });
  }

  // 3. OPEN COMMAND (Slash)
  if (sub === "open") {
    await interaction.deferReply({ ephemeral: true });
    const type = interaction.options.getString("type") || "Support";
    const reason = interaction.options.getString("reason") || "No reason provided";
    const result = await openTicket({ guild: interaction.guild, user: interaction.user, type, reason });
    return interaction.editReply({ content: result.error ? `❌ ${result.error}` : `🌸 Your ticket has been opened in ${result.channel}!` });
  }

  // 4. CLOSE COMMAND
  if (sub === "close") {
    const ticketId = `${interaction.guildId}:${interaction.channelId}`;
    const ticket = tickets.get(ticketId);

    // Security & Fallback check
    if (!ticket && !interaction.channel.name.startsWith("ticket-")) {
      return interaction.reply({ content: "❌ This is not a recognized ticket channel.", ephemeral: true });
    }
    if (ticket && ticket.userId !== interaction.user.id && !isAdmin(interaction.member)) {
      return interaction.reply({ content: "❌ Only the ticket owner or staff can close this.", ephemeral: true });
    }

    await interaction.reply({ embeds: [closeEmbed(interaction.user)] });
    return closeTicket(interaction.channel, ticket || { type: "Unknown", userId: interaction.user.id }, ticketId, interaction.user, interaction.guild);
  }

  // 5. ADD USER COMMAND
  if (sub === "add") {
    const ticketId = `${interaction.guildId}:${interaction.channelId}`;
    const ticket = tickets.get(ticketId);
    if (!ticket) return interaction.reply({ content: "❌ You can only use this inside an active ticket.", ephemeral: true });
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const userToAdd = interaction.options.getUser("user");
    await interaction.channel.permissionOverwrites.create(userToAdd.id, {
      ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true
    });
    return interaction.reply({ content: `🌸 Added ${userToAdd} to the ticket.` });
  }

  // 6. REMOVE USER COMMAND
  if (sub === "remove") {
    const ticketId = `${interaction.guildId}:${interaction.channelId}`;
    const ticket = tickets.get(ticketId);
    if (!ticket) return interaction.reply({ content: "❌ You can only use this inside an active ticket.", ephemeral: true });
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const userToRemove = interaction.options.getUser("user");
    if (userToRemove.id === ticket.userId) return interaction.reply({ content: "❌ You cannot remove the ticket owner!", ephemeral: true });

    await interaction.channel.permissionOverwrites.delete(userToRemove.id);
    return interaction.reply({ content: `🌸 Removed ${userToRemove} from the ticket.` });
  }
}

// --- CORE TICKET LOGIC ---

export async function openTicket({ guild, user, type, reason }) {
  const lockKey = `${guild.id}:${user.id}`;
  if (creationLocks.has(lockKey)) return { error: "Processing... Please wait a moment." };

  creationLocks.add(lockKey);
  try {
    const config = ticketConfig.get(guild.id) || {};

    // User Limit
    const active = [...tickets.values()].filter(t => t.userId === user.id && t.open && t.guildId === guild.id);
    if (active.length >= 3) return { error: "You already have 3 open tickets! Close one before opening more." };

    // Permissions logic
    const overwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
      { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
    ];

    // Safely add Staff Role if it exists
    if (config.staffRoleId) {
      const role = guild.roles.cache.get(config.staffRoleId);
      if (role) {
        overwrites.push({ id: config.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
      }
    }

    // Category routing
    const categoryId = type === "Appeal" ? config.appealCategoryId : type === "Partnership" ? config.partnershipCategoryId : config.supportCategoryId;

    const channel = await guild.channels.create({
      name: `ticket-${user.username}`,
      type: ChannelType.GuildText,
      parent: categoryId || null,
      permissionOverwrites: overwrites,
      topic: `${type} Ticket | Opened by: ${user.tag} | Reason: ${reason}`
    });

    const ticketId = `${guild.id}:${channel.id}`;
    tickets.set(ticketId, { 
      guildId: guild.id, 
      userId: user.id, 
      channelId: channel.id, 
      type, 
      open: true, 
      openedAt: Date.now() 
    });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`✦ ${type} Ticket`)
      .setDescription(`${DIVIDER}\n🌸 Welcome ${user}!\n\n**Reason:** ${reason}\n\nPlease wait patiently for a staff member.\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_ticket").setLabel("Close Ticket").setStyle(ButtonStyle.Danger).setEmoji("🔒")
    );

    const ping = config.staffRoleId ? `<@&${config.staffRoleId}> ${user}` : `${user}`;
    await channel.send({ content: ping, embeds: [embed], components: [row] });

    return { channel };
  } catch (err) {
    console.error("Ticket Creation Error:", err);
    return { error: `Bot error: ${err.message}` };
  } finally {
    creationLocks.delete(lockKey);
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
      const logCh = guild.channels.cache.get(config.logChannelId);
      if (logCh) {
        const log = new EmbedBuilder()
          .setColor(NILOU_RED)
          .setTitle("✦ Ticket Logs")
          .setDescription(`**Status:** Closed\n**Type:** ${ticket.type || "Unknown"}\n**User:** <@${ticket.userId}>\n**Closed By:** ${user}`)
          .setTimestamp();
        logCh.send({ embeds: [log] }).catch(() => {});
      }
    }

    // Delay deletion so users can see the "Closing" message
    setTimeout(async () => {
      try {
        await channel.delete();
        tickets.delete(ticketId);
      } catch (err) {
        // Channel might already be gone
      }
    }, 5000);
  } catch (err) {
    console.error("Error closing ticket:", err);
  }
}

export function closeEmbed(user) {
  return new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ Closing Ticket")
    .setDescription(`${DIVIDER}\n🌸 This ticket is being closed by ${user}.\nChannel will be deleted in **5 seconds**.\n${DIVIDER}`)
    .setFooter(FOOTER_MAIN);
}