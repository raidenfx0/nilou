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

// Map to track active creation processes to prevent duplicates (UserId -> Timestamp)
const activeCreations = new Map();

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
      .addStringOption((o) => o.setName("support_category").setDescription("Category ID for Support").setRequired(false))
      .addStringOption((o) => o.setName("appeal_category").setDescription("Category ID for Appeal").setRequired(false))
      .addStringOption((o) => o.setName("partnership_category").setDescription("Category ID for Partnership").setRequired(false))
      .addStringOption((o) => o.setName("staff_role").setDescription("Staff Role (ID or @Tag)").setRequired(false))
      .addStringOption((o) => o.setName("log_channel").setDescription("Log Channel (ID or #Tag)").setRequired(false))
  )
  .addSubcommand((sub) =>
    sub
      .setName("open")
      .setDescription("Open a ticket via slash command")
      .addStringOption((o) =>
        o.setName("type")
          .setDescription("Select the type of ticket")
          .setRequired(true) // Required for slash command
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

    // Improved helper: Strips all non-numeric characters (handles <@&...>, <#...>, etc)
    const getRawId = (str) => {
      if (!str) return null;
      const clean = str.replace(/[^0-9]/g, "");
      return clean.length > 0 ? clean : null;
    };

    const updates = {
      supportCategoryId: getRawId(interaction.options.getString("support_category")),
      appealCategoryId: getRawId(interaction.options.getString("appeal_category")),
      partnershipCategoryId: getRawId(interaction.options.getString("partnership_category")),
      staffRoleId: getRawId(interaction.options.getString("staff_role")),
      logChannelId: getRawId(interaction.options.getString("log_channel")),
    };

    // Quick verify for the staff role specifically
    if (updates.staffRoleId) {
      const role = interaction.guild.roles.cache.get(updates.staffRoleId);
      if (!role) {
        return interaction.reply({ 
          content: `❌ I couldn't find a role with ID \`${updates.staffRoleId}\`. Please make sure you paste the ID or tag a real role.`, 
          ephemeral: true 
        });
      }
    }

    const existing = ticketConfig.get(interaction.guildId) || {};
    Object.keys(updates).forEach(k => { if (updates[k]) existing[k] = updates[k]; });
    ticketConfig.set(interaction.guildId, existing);

    return interaction.reply({ 
      content: "🌸 **Setup Complete!** I have saved your settings and converted all tags/mentions into raw IDs.", 
      ephemeral: true 
    });
  }

  // 2. PANEL COMMAND
  if (sub === "panel") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const target = interaction.options.getChannel("channel");
    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Support Tickets")
      .setDescription(`${DIVIDER}\n🌸 Click a button below to open a ticket channel.\n\n🎫 **Support**\n⚖️ **Appeal**\n🤝 **Partnership**\n${DIVIDER}`)
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
    const type = interaction.options.getString("type");
    const reason = interaction.options.getString("reason") || "No reason provided";

    // Avoid "Interaction Failed" errors while processing
    await interaction.deferReply({ ephemeral: true });

    const result = await openTicket({ guild: interaction.guild, user: interaction.user, type, reason });
    return interaction.editReply({ 
      content: result.error ? `❌ ${result.error}` : `🌸 Your ticket has been created: ${result.channel}!` 
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
      return interaction.reply({ content: "❌ Only the ticket owner or staff can close this.", ephemeral: true });
    }

    await interaction.reply({ embeds: [closeEmbed(interaction.user)] });
    return closeTicket(interaction.channel, ticket || { type: "Manual", userId: interaction.user.id }, ticketId, interaction.user, interaction.guild);
  }

  // 5. ADD/REMOVE USERS
  if (sub === "add" || sub === "remove") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const targetUser = interaction.options.getUser("user");

    if (sub === "add") {
      await interaction.channel.permissionOverwrites.create(targetUser.id, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true
      });
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
  const now = Date.now();

  // Anti-Duplicate Lock: 5 second cooldown per user per guild
  if (activeCreations.has(userId)) {
    const lastCreation = activeCreations.get(userId);
    if (now - lastCreation < 5000) {
      return { error: "Please wait a few seconds before opening another ticket." };
    }
  }

  activeCreations.set(userId, now);

  try {
    const config = ticketConfig.get(guild.id) || {};

    // Check if user already has this specific type of ticket open
    const existing = [...tickets.values()].find(t => t.userId === userId && t.guildId === guild.id && t.open && t.type === type);
    if (existing) return { error: `You already have an active **${type}** ticket!` };

    // Determine category based on type
    const categoryId = type === "Appeal" ? config.appealCategoryId : type === "Partnership" ? config.partnershipCategoryId : config.supportCategoryId;

    const overwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
      { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
    ];

    if (config.staffRoleId) {
      overwrites.push({ id: config.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
    }

    const channel = await guild.channels.create({
      name: `ticket-${user.username}`,
      type: ChannelType.GuildText,
      parent: categoryId || null,
      permissionOverwrites: overwrites,
      topic: `${type} Ticket | User: ${user.tag}`
    });

    const ticketId = `${guild.id}:${channel.id}`;
    tickets.set(ticketId, { 
      guildId: guild.id, userId: userId, channelId: channel.id, type, open: true 
    });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`✦ ${type} Ticket`)
      .setDescription(`${DIVIDER}\n🌸 Hello ${user}!\n\n**Reason:** ${reason}\n\nPlease wait for staff assistance.\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_ticket").setLabel("Close").setStyle(ButtonStyle.Danger).setEmoji("🔒")
    );

    const ping = config.staffRoleId ? `<@&${config.staffRoleId}> ${user}` : `${user}`;
    await channel.send({ 
      content: ping, 
      embeds: [embed], 
      components: [row] 
    });

    return { channel };
  } catch (err) {
    console.error("Error creating ticket:", err);
    return { error: "I couldn't create the ticket. Check if I have 'Manage Channels' permissions." };
  } finally {
    // Clear lock after 5 seconds
    setTimeout(() => activeCreations.delete(userId), 5000);
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
      } catch (err) {}
    }, 5000);
  } catch (err) {}
}

export function closeEmbed(user) {
  return new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ Closing Ticket")
    .setDescription(`${DIVIDER}\n🌸 Ticket is being closed by ${user}.\nDeleting in **5 seconds**...\n${DIVIDER}`)
    .setFooter(FOOTER_MAIN);
}