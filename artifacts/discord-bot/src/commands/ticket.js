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

// Global lock to prevent duplication (UserId -> Boolean)
const processingUsers = new Map();

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
      .addStringOption((o) => o.setName("support_category").setDescription("Raw ID for Support Category").setRequired(false))
      .addStringOption((o) => o.setName("appeal_category").setDescription("Raw ID for Appeal Category").setRequired(false))
      .addStringOption((o) => o.setName("partnership_category").setDescription("Raw ID for Partnership Category").setRequired(false))
      .addStringOption((o) => o.setName("staff_role").setDescription("Raw ID for Staff Role").setRequired(false))
      .addStringOption((o) => o.setName("log_channel").setDescription("Raw ID for Log Channel").setRequired(false))
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

  // 1. SETUP COMMAND
  if (sub === "setup") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const validateId = (str) => {
      if (!str) return null;
      const trimmed = str.trim();
      if (/^\d+$/.test(trimmed)) return trimmed;
      return "INVALID";
    };

    const inputs = {
      supportCategoryId: validateId(interaction.options.getString("support_category")),
      appealCategoryId: validateId(interaction.options.getString("appeal_category")),
      partnershipCategoryId: validateId(interaction.options.getString("partnership_category")),
      staffRoleId: validateId(interaction.options.getString("staff_role")),
      logChannelId: validateId(interaction.options.getString("log_channel")),
    };

    if (Object.values(inputs).some(v => v === "INVALID")) {
      return interaction.reply({ 
        content: "❌ **Invalid Input!** Please provide numeric IDs only. Do not use mentions.", 
        ephemeral: true 
      });
    }

    const updates = {};
    Object.keys(inputs).forEach(k => { if (inputs[k]) updates[k] = inputs[k]; });

    if (updates.staffRoleId && !interaction.guild.roles.cache.has(updates.staffRoleId)) {
      return interaction.reply({ content: `❌ I can't find a role with ID \`${updates.staffRoleId}\`.`, ephemeral: true });
    }

    const existing = ticketConfig.get(interaction.guildId) || {};
    Object.assign(existing, updates);
    ticketConfig.set(interaction.guildId, existing);

    return interaction.reply({ content: "🌸 **Setup Complete!** Configuration updated successfully.", ephemeral: true });
  }

  // 2. PANEL COMMAND
  if (sub === "panel") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const target = interaction.options.getChannel("channel");
    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Create a Ticket")
      .setDescription(`${DIVIDER}\n🌸 Click one of the buttons below to talk to our staff team.\n\n🎫 **Support** - General inquiries\n⚖️ **Appeal** - Ban/Mute appeals\n🤝 **Partnership** - Collaboration requests\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_support").setLabel("Support").setStyle(ButtonStyle.Primary).setEmoji("🎫"),
      new ButtonBuilder().setCustomId("btn_appeal").setLabel("Appeal").setStyle(ButtonStyle.Secondary).setEmoji("⚖️"),
      new ButtonBuilder().setCustomId("btn_partnership").setLabel("Partnership").setStyle(ButtonStyle.Success).setEmoji("🤝")
    );
    await target.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: "🌸 Panel deployed!", ephemeral: true });
  }

  // 3. OPEN COMMAND (Slash)
  if (sub === "open") {
    const type = interaction.options.getString("type");
    const reason = interaction.options.getString("reason") || "No reason specified";

    await interaction.deferReply({ ephemeral: true });

    const result = await openTicket({ guild: interaction.guild, user: interaction.user, type, reason });
    return interaction.editReply({ 
      content: result.error ? `❌ ${result.error}` : `🌸 Ticket created: ${result.channel}!` 
    });
  }

  // 4. CLOSE COMMAND
  if (sub === "close") {
    const ticketId = `${interaction.guildId}:${interaction.channelId}`;
    const ticket = tickets.get(ticketId);

    if (!ticket && !interaction.channel.name.startsWith("ticket-")) {
      return interaction.reply({ content: "❌ This is not a ticket channel.", ephemeral: true });
    }

    if (ticket && ticket.userId !== interaction.user.id && !isAdmin(interaction.member)) {
      return interaction.reply({ content: "❌ You don't have permission to close this.", ephemeral: true });
    }

    await interaction.reply({ embeds: [closeEmbed(interaction.user)] });
    return closeTicket(interaction.channel, ticket || { type: "General", userId: interaction.user.id }, ticketId, interaction.user, interaction.guild);
  }

  // 5. ADD/REMOVE USERS
  if (sub === "add" || sub === "remove") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const targetUser = interaction.options.getUser("user");

    if (sub === "add") {
      await interaction.channel.permissionOverwrites.create(targetUser.id, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true
      });
      return interaction.reply({ content: `🌸 ${targetUser} has been added to the ticket.` });
    } else {
      await interaction.channel.permissionOverwrites.delete(targetUser.id);
      return interaction.reply({ content: `🌸 ${targetUser} has been removed from the ticket.` });
    }
  }
}

// --- CORE LOGIC ---

export async function openTicket({ guild, user, type, reason }) {
  const userId = user.id;

  // 1. HARD DUPLICATION LOCK
  if (processingUsers.has(userId)) {
    return { error: "Your ticket is already being created. Please wait!" };
  }

  // Check if user already has an open ticket of the SAME type
  const existing = [...tickets.values()].find(t => t.userId === userId && t.guildId === guild.id && t.open && t.type === type);
  if (existing) return { error: `You already have an active **${type}** ticket!` };

  processingUsers.set(userId, true);

  try {
    const config = ticketConfig.get(guild.id) || {};
    const categoryId = type === "Appeal" ? config.appealCategoryId : type === "Partnership" ? config.partnershipCategoryId : config.supportCategoryId;

    // Create channel
    const channel = await guild.channels.create({
      name: `${type.toLowerCase()}-${user.username.slice(0, 15)}`,
      type: ChannelType.GuildText,
      parent: categoryId || null,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
        ...(config.staffRoleId ? [{ id: config.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
      ],
      topic: `${type} Ticket | ID: ${userId}`
    });

    tickets.set(`${guild.id}:${channel.id}`, { 
      guildId: guild.id, userId, channelId: channel.id, type, open: true 
    });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`✦ ${type} Ticket Created`)
      .setDescription(`${DIVIDER}\n🌸 Hello ${user}!\n\n**Reason:** ${reason}\n\nPlease wait patiently for our staff team to assist you.\n${DIVIDER}`)
      .setTimestamp()
      .setFooter(FOOTER_MAIN);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_ticket").setLabel("Close Ticket").setStyle(ButtonStyle.Danger).setEmoji("🔒")
    );

    const ping = config.staffRoleId ? `<@&${config.staffRoleId}> ${user}` : `${user}`;
    await channel.send({ content: ping, embeds: [embed], components: [row] });

    return { channel };
  } catch (err) {
    console.error("Ticket Creation Error:", err);
    return { error: "I failed to create your ticket. Check my permissions (Manage Channels)!" };
  } finally {
    // Clear lock after a small safety delay
    setTimeout(() => processingUsers.delete(userId), 3000);
  }
}

export async function closeTicket(channel, ticket, ticketId, user, guild) {
  try {
    const config = ticketConfig.get(guild.id) || {};

    // Update local state
    if (tickets.has(ticketId)) {
      const data = tickets.get(ticketId);
      data.open = false;
      tickets.set(ticketId, data);
    }

    // Log the event
    if (config.logChannelId) {
      const logCh = guild.channels.cache.get(config.logChannelId);
      if (logCh) {
        const log = new EmbedBuilder()
          .setColor(NILOU_RED)
          .setTitle("✦ Ticket Log")
          .addFields(
            { name: "User", value: `<@${ticket.userId}>`, inline: true },
            { name: "Type", value: ticket.type, inline: true },
            { name: "Closed By", value: `${user}`, inline: true }
          )
          .setTimestamp();
        logCh.send({ embeds: [log] }).catch(() => {});
      }
    }

    // Delayed deletion
    setTimeout(async () => {
      try { 
        await channel.delete(); 
        tickets.delete(ticketId); 
      } catch (e) {}
    }, 5000);
  } catch (err) {
    console.error("Close Ticket Error:", err);
  }
}

export function closeEmbed(user) {
  return new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ Closing Ticket")
    .setDescription(`${DIVIDER}\n🌸 This channel will be deleted in **5 seconds**.\nInitiated by: ${user}\n${DIVIDER}`)
    .setFooter(FOOTER_MAIN);
}