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

// LOCK: Prevents race conditions and duplication.
const creationLock = new Map();

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

  // 1. SETUP COMMAND (STRICT RAW ID ONLY)
  if (sub === "setup") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const validateId = (str) => {
      if (!str) return null;
      const trimmed = str.trim();
      // Strictly enforce numbers only. This stops @tags and #channels.
      return /^\d+$/.test(trimmed) ? trimmed : "INVALID";
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
        content: "❌ **Setup Failed!** Please use **numeric IDs only**. Do not tag roles/channels (no @ or #).", 
        ephemeral: true 
      });
    }

    const existing = ticketConfig.get(interaction.guildId) || {};
    Object.keys(inputs).forEach(k => { if (inputs[k]) existing[k] = inputs[k]; });
    ticketConfig.set(interaction.guildId, existing);

    // Nice response showing exactly what was set
    const setupEmbed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Ticket System Configured")
      .setDescription(`${DIVIDER}\n🌸 Ticket config updated!\n\n` +
        `**Support Category:** \`${existing.supportCategoryId || 'Not set'}\`\n` +
        `**Appeal Category:** \`${existing.appealCategoryId || 'Not set'}\`\n` +
        `**Partnership Category:** \`${existing.partnershipCategoryId || 'Not set'}\`\n` +
        `**Staff Role:** \`${existing.staffRoleId || 'Not set'}\`\n` +
        `**Log Channel:** \`${existing.logChannelId || 'Not set'}\`\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN);

    return interaction.reply({ embeds: [setupEmbed], ephemeral: true });
  }

  // 2. PANEL COMMAND
  if (sub === "panel") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const target = interaction.options.getChannel("channel");
    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Support Center")
      .setDescription(`${DIVIDER}\n🌸 Click the buttons below to open a ticket.\n\n🎫 **Support**\n⚖️ **Appeal**\n🤝 **Partnership**\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_support").setLabel("Support").setStyle(ButtonStyle.Primary).setEmoji("🎫"),
      new ButtonBuilder().setCustomId("btn_appeal").setLabel("Appeal").setStyle(ButtonStyle.Secondary).setEmoji("⚖️"),
      new ButtonBuilder().setCustomId("btn_partnership").setLabel("Partnership").setStyle(ButtonStyle.Success).setEmoji("🤝")
    );
    await target.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: "🌸 Panel successfully sent!", ephemeral: true });
  }

  // 3. OPEN COMMAND (Slash)
  if (sub === "open") {
    const type = interaction.options.getString("type");
    const reason = interaction.options.getString("reason") || "No reason specified";

    await interaction.deferReply({ ephemeral: true });

    const result = await openTicket({ guild: interaction.guild, user: interaction.user, type, reason });
    return interaction.editReply({ 
      content: result.error ? `❌ ${result.error}` : `🌸 Ticket opened: ${result.channel}!` 
    });
  }

  // 4. CLOSE COMMAND
  if (sub === "close") {
    const ticketId = `${interaction.guildId}:${interaction.channelId}`;
    const ticket = tickets.get(ticketId);

    if (!ticket && !interaction.channel.name.startsWith("ticket-") && !interaction.channel.name.match(/support-|appeal-|partnership-/)) {
      return interaction.reply({ content: "❌ This channel is not an active ticket.", ephemeral: true });
    }

    if (ticket && ticket.userId !== interaction.user.id && !isAdmin(interaction.member)) {
      return interaction.reply({ content: "❌ You cannot close this ticket.", ephemeral: true });
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
  const lockKey = `${guild.id}:${userId}:${type}`;

  // STEP 1: ATOMIC DUPLICATION LOCK
  if (creationLock.has(lockKey)) {
    return { error: "Ticket creation already in progress. Please wait." };
  }

  // Set the lock immediately
  creationLock.set(lockKey, true);

  try {
    const config = ticketConfig.get(guild.id) || {};

    // Double-check existing tickets in store
    const existing = [...tickets.values()].find(t => 
      t.userId === userId && 
      t.guildId === guild.id && 
      t.open && 
      t.type === type
    );

    if (existing) {
      return { error: `You already have an active **${type}** ticket!` };
    }

    // Determine category based on type
    let categoryId = config.supportCategoryId;
    if (type === "Appeal") categoryId = config.appealCategoryId;
    if (type === "Partnership") categoryId = config.partnershipCategoryId;

    // Create channel inside the specified category
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
      topic: `${type} Ticket | User: ${user.tag}`
    });

    // Save to store
    tickets.set(`${guild.id}:${channel.id}`, { 
      guildId: guild.id, userId, channelId: channel.id, type, open: true 
    });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`✦ ${type} Ticket`)
      .setDescription(`${DIVIDER}\n🌸 Hello ${user}!\nReason: **${reason}**\n\nStaff will assist you soon.\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_ticket").setLabel("Close").setStyle(ButtonStyle.Danger).setEmoji("🔒")
    );

    const ping = config.staffRoleId ? `<@&${config.staffRoleId}> ${user}` : `${user}`;
    await channel.send({ content: ping, embeds: [embed], components: [row] });

    return { channel };
  } catch (err) {
    console.error("Critical Ticket Error:", err);
    return { error: "Failed to create channel. Check my permissions or category ID." };
  } finally {
    // Release lock after a safety delay (5 seconds)
    setTimeout(() => creationLock.delete(lockKey), 5000);
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
          .setTitle("✦ Ticket Log")
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
    .setDescription(`${DIVIDER}\n🌸 Deleting channel in **5 seconds**...\nInitiated by: ${user}\n${DIVIDER}`)
    .setFooter(FOOTER_MAIN);
}