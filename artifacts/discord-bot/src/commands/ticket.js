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

// ABSOLUTE LOCK: Prevents a user from starting a second creation process while the first is running.
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
      const trimmed = str.trim();
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
        content: "❌ **Setup Failed!** Please use **numeric IDs only**. Do not use mentions or tags.", 
        ephemeral: true 
      });
    }

    const existing = ticketConfig.get(interaction.guildId) || {};
    Object.keys(inputs).forEach(k => { if (inputs[k]) existing[k] = inputs[k]; });
    ticketConfig.set(interaction.guildId, existing);

    const setupEmbed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Ticket System Configured")
      .setDescription(`${DIVIDER}\n🌸 Configuration Saved (Raw IDs Only):\n\n` +
        `**Support Category:** \`${existing.supportCategoryId || 'Not set'}\`\n` +
        `**Appeal Category:** \`${existing.appealCategoryId || 'Not set'}\`\n` +
        `**Partnership Category:** \`${existing.partnershipCategoryId || 'Not set'}\`\n` +
        `**Staff Role ID:** \`${existing.staffRoleId || 'Not set'}\`\n` +
        `**Log Channel ID:** \`${existing.logChannelId || 'Not set'}\`\n${DIVIDER}`)
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
    return interaction.reply({ content: "🌸 Panel sent!", ephemeral: true });
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

    // Improved detection: if it's named like a ticket, let us close it even if database is out of sync
    const isTicketName = interaction.channel.name.match(/^(support|appeal|partnership|ticket)-/);

    if (!ticket && !isTicketName) {
      return interaction.reply({ content: "❌ This is not a ticket channel.", ephemeral: true });
    }

    if (ticket && ticket.userId !== interaction.user.id && !isAdmin(interaction.member)) {
      return interaction.reply({ content: "❌ Only the owner or an admin can close this.", ephemeral: true });
    }

    await interaction.reply({ embeds: [closeEmbed(interaction.user)] });
    return closeTicket(interaction.channel, ticket || { type: "Unknown", userId: "0" }, ticketId, interaction.user, interaction.guild);
  }

  if (sub === "add" || sub === "remove") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const targetUser = interaction.options.getUser("user");
    if (sub === "add") {
      await interaction.channel.permissionOverwrites.create(targetUser.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
      return interaction.reply({ content: `🌸 Added ${targetUser}.` });
    } else {
      await interaction.channel.permissionOverwrites.delete(targetUser.id);
      return interaction.reply({ content: `🌸 Removed ${targetUser}.` });
    }
  }
}

// --- REPAIRED CORE LOGIC ---

export async function openTicket({ guild, user, type, reason }) {
  const lockKey = `${guild.id}:${user.id}:${type}`;

  // 1. INSTANT LOCK CHECK
  if (creationLock.has(lockKey)) {
    return { error: "Ticket creation already in progress. Please wait." };
  }
  creationLock.add(lockKey);

  try {
    const config = ticketConfig.get(guild.id) || {};

    // 2. DUPLICATE CHANNEL CHECK (DB check)
    const existing = [...tickets.values()].find(t => t.userId === user.id && t.guildId === guild.id && t.open && t.type === type);
    if (existing) {
      return { error: `You already have an open **${type}** ticket!` };
    }

    // 3. CATEGORY REDIRECT CHECK
    let categoryId = config.supportCategoryId;
    if (type === "Appeal") categoryId = config.appealCategoryId;
    if (type === "Partnership") categoryId = config.partnershipCategoryId;

    // IF CATEGORY NOT SET, PREVENT CREATION (Safety to avoid "at the top" duplicates)
    if (!categoryId) {
      return { error: `The **${type}** category ID is not set! Use /ticket setup first.` };
    }

    // 4. CREATE CHANNEL
    const channel = await guild.channels.create({
      name: `${type.toLowerCase()}-${user.username.slice(0, 15)}`,
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
        ...(config.staffRoleId ? [{ id: config.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
      ],
      topic: `${type} Ticket | User: ${user.id}`
    });

    tickets.set(`${guild.id}:${channel.id}`, { guildId: guild.id, userId: user.id, channelId: channel.id, type, open: true });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`✦ ${type} Ticket`)
      .setDescription(`${DIVIDER}\n🌸 Hello ${user}!\nReason: **${reason}**\n\nPlease wait for staff assistance.\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN);

    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("close_ticket").setLabel("Close").setStyle(ButtonStyle.Danger).setEmoji("🔒"));
    const ping = config.staffRoleId ? `<@&${config.staffRoleId}> ${user}` : `${user}`;
    await channel.send({ content: ping, embeds: [embed], components: [row] });

    return { channel };
  } catch (err) {
    console.error("Ticket Error:", err);
    return { error: "Failed to create channel. Check if the Category ID is valid!" };
  } finally {
    // Hold lock for 10 seconds to be absolutely sure no duplicates trigger
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
      const logCh = guild.channels.cache.get(config.logChannelId);
      if (logCh) {
        const log = new EmbedBuilder().setColor(NILOU_RED).setTitle("✦ Ticket Closed").setDescription(`**User:** <@${ticket.userId}>\n**Type:** ${ticket.type}\n**Closed By:** ${user}`).setTimestamp();
        logCh.send({ embeds: [log] }).catch(() => {});
      }
    }

    setTimeout(async () => {
      try { await channel.delete(); tickets.delete(ticketId); } catch (e) {}
    }, 5000);
  } catch (err) {}
}

export function closeEmbed(user) {
  return new EmbedBuilder().setColor(NILOU_RED).setTitle("✦ Closing Ticket").setDescription(`${DIVIDER}\n🌸 Channel will be deleted in **5 seconds**.\nInitiated by: ${user}\n${DIVIDER}`).setFooter(FOOTER_MAIN);
}