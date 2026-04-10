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
      // Hard cleaning: extract only numbers.
      const cleaned = str.replace(/\D/g, "").trim();
      return cleaned.length > 10 ? cleaned : "INVALID";
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
        content: "❌ **Setup Failed!** Use raw Numeric IDs only. Tagging doesn't work here.", 
        ephemeral: true 
      });
    }

    const existing = ticketConfig.get(interaction.guildId) || {};
    Object.keys(inputs).forEach(k => { if (inputs[k]) existing[k] = inputs[k]; });
    ticketConfig.set(interaction.guildId, existing);

    const setupEmbed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Ticket System Setup")
      .setDescription(`${DIVIDER}\n🌸 **Configuration Updated (Raw IDs Only)**\n\n` +
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

    // Safety check for any channel named like a ticket
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
  // One lock per user per guild for 10 seconds. No double-clicking allowed.
  const lockKey = `${guild.id}:${userId}`;

  if (creationLock.has(lockKey)) {
    return { error: "You are doing that too fast! Please wait." };
  }

  // Set lock immediately
  creationLock.add(lockKey);

  try {
    const config = ticketConfig.get(guild.id) || {};

    // Check database for existing same-type ticket
    const existing = [...tickets.values()].find(t => t.userId === userId && t.guildId === guild.id && t.open && t.type === type);
    if (existing) {
      return { error: `You already have an open **${type}** ticket!` };
    }

    // Determine category ID
    let categoryId = config.supportCategoryId;
    if (type === "Appeal") categoryId = config.appealCategoryId;
    if (type === "Partnership") categoryId = config.partnershipCategoryId;

    // FORCE REDIRECT: If no category ID is found, kill the process.
    if (!categoryId) {
      return { error: `The category for **${type}** is not set. Use /ticket setup.` };
    }

    // Attempt to verify category exists via fetch (cache-safe)
    const category = await guild.channels.fetch(categoryId).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return { error: `The category ID \`${categoryId}\` is invalid or I can't see it.` };
    }

    // Create channel INSIDE the category
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

    // Register in memory
    tickets.set(`${guild.id}:${channel.id}`, { guildId: guild.id, userId, channelId: channel.id, type, open: true });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`✦ ${type} Ticket`)
      .setDescription(`${DIVIDER}\n🌸 Hello ${user}!\nReason: **${reason}**\n\nStaff will be with you shortly.\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN);

    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("close_ticket").setLabel("Close").setStyle(ButtonStyle.Danger).setEmoji("🔒"));

    // Raw ID mention for staff
    const ping = config.staffRoleId ? `<@&${config.staffRoleId}> ${user}` : `${user}`;
    await channel.send({ content: ping, embeds: [embed], components: [row] });

    return { channel };
  } catch (err) {
    console.error("Critical Ticket Error:", err);
    return { error: "Something went wrong. Please check my permissions or the setup IDs." };
  } finally {
    // 10-second cool down on the creation button for this user
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