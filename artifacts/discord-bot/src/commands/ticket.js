import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} from "discord.js";
import { NILOU_RED, FOOTER_MAIN, DIVIDER } from "../theme.js";
import { tickets, ticketConfig } from "../data/store.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";
import {
  upsertTicket,
  closeTicketDb,
  setTicketTranscript,
  upsertGuildSettings,
} from "../db/index.js";
import { buildSupportEmbed } from "../utils/supportEmbeds.js";

// ABSOLUTE LOCK: Prevents a user from starting any ticket process while one is active.
const creationLock = new Set();
const DEFAULT_PANEL_OPTIONS = [
  { key: "support", label: "Support", description: "Get help from the staff team", emoji: "🎫", categoryField: "supportCategoryId", style: "primary" },
  { key: "appeal", label: "Appeal", description: "Appeal a moderation decision", emoji: "⚖️", categoryField: "appealCategoryId", style: "secondary" },
  { key: "partnership", label: "Partnership", description: "Discuss a partnership", emoji: "🤝", categoryField: "partnershipCategoryId", style: "success" },
];

function ticketPanelOptions(config = {}) {
  if (Array.isArray(config.panelOptions) && config.panelOptions.length) {
    return config.panelOptions;
  }
  return DEFAULT_PANEL_OPTIONS.map(({ categoryField, ...option }) => ({
    ...option,
    categoryId: config[categoryField] || "",
  }));
}

function findTicketOption(config, type) {
  const value = String(type || "").toLowerCase();
  return ticketPanelOptions(config).find((option) =>
    String(option.key || "").toLowerCase() === value ||
    String(option.label || "").toLowerCase() === value
  ) || null;
}

function optionStyle(style) {
  return ({
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger,
  })[style] || ButtonStyle.Primary;
}

export function canManageTicket(member, guildId, ticket) {
  if (!member) return false;
  if (ticket?.userId === member.id) return true;
  if (isAdmin(member)
      || member.permissions?.has(PermissionFlagsBits.Administrator)
      || member.permissions?.has(PermissionFlagsBits.ManageGuild)
      || member.permissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  const staffRoleId = ticketConfig.get(guildId)?.staffRoleId;
  return Boolean(staffRoleId && member.roles?.cache?.has(staffRoleId));
}

export function getTicketDashboardConfig(guildId) {
  const config = ticketConfig.get(guildId) || {};
  return {
    panelMode: config.panelMode === "select" ? "select" : "buttons",
    panelOptions: ticketPanelOptions(config).map(({ categoryField, ...option }) => ({
      key: option.key,
      label: option.label,
      description: option.description || "",
      emoji: option.emoji || "",
      categoryId: option.categoryId || "",
      style: option.style || "primary",
    })),
    panelEmbed: config.panelEmbed || {
      title: "✦ Create a Ticket",
      description: `${DIVIDER}\nChoose a topic to open a private ticket.\n${DIVIDER}`,
      color: "#E84057",
      footer: FOOTER_MAIN.text,
      imageUrl: "",
      thumbnailUrl: "",
    },
    openedEmbed: config.openedEmbed || {
      title: "✦ {type} Ticket",
      description: `${DIVIDER}\nHello {user}!\nReason: **{reason}**\n\nStaff will assist you shortly.\n${DIVIDER}`,
      color: "#E84057",
      footer: FOOTER_MAIN.text,
      imageUrl: "",
      thumbnailUrl: "",
    },
    closedEmbed: config.closedEmbed || {
      title: "Ticket closed",
      description: "This ticket is now closed. The channel and transcript are retained; use `/delete` when you are ready to remove it.",
      color: "#E84057",
      footer: FOOTER_MAIN.text,
      imageUrl: "",
      thumbnailUrl: "",
    },
  };
}

export async function publishTicketPanel(target) {
  const config = ticketConfig.get(target.guild.id) || {};
  const settings = getTicketDashboardConfig(target.guild.id);
  const embed = buildSupportEmbed(settings.panelEmbed, { server: target.guild.name }, {
    title: "✦ Create a Ticket",
    description: `${DIVIDER}\nChoose a topic to open a private ticket.\n${DIVIDER}`,
    color: "#E84057",
    footer: FOOTER_MAIN.text,
  });
  const options = ticketPanelOptions(config).filter((option) => option.key && option.label);
  let components = [];
  if (settings.panelMode === "select") {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket:select")
      .setPlaceholder("Choose a ticket topic")
      .addOptions(options.slice(0, 25).map((option) => ({
        label: String(option.label).slice(0, 100),
        value: String(option.key).slice(0, 100),
        description: String(option.description || option.label).slice(0, 100),
        ...(option.emoji ? { emoji: option.emoji } : {}),
      })));
    components = [new ActionRowBuilder().addComponents(menu)];
  } else {
    const rows = [];
    for (let index = 0; index < Math.min(options.length, 25); index += 5) {
      const row = new ActionRowBuilder();
      for (const option of options.slice(index, index + 5)) {
        const button = new ButtonBuilder()
          .setCustomId(`ticket:open:${option.key}`)
          .setLabel(String(option.label).slice(0, 80))
          .setStyle(optionStyle(option.style));
        if (option.emoji) button.setEmoji(option.emoji);
        row.addComponents(button);
      }
      rows.push(row);
    }
    components = rows;
  }
  if (!components.length) throw new Error("Add at least one ticket option before publishing the panel.");
  return target.send({ embeds: [embed], components });
}

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
    await upsertGuildSettings(interaction.guildId, {
      ticket_support_category:     existing.supportCategoryId     || null,
      ticket_appeal_category:      existing.appealCategoryId      || null,
      ticket_partnership_category: existing.partnershipCategoryId || null,
      staff_role_id:               existing.staffRoleId           || null,
      ticket_log_channel:          existing.logChannelId          || null,
      ticket_ui_config: JSON.stringify({
        panelMode: existing.panelMode,
        panelOptions: existing.panelOptions,
        panelEmbed: existing.panelEmbed,
        openedEmbed: existing.openedEmbed,
        closedEmbed: existing.closedEmbed,
      }),
    });

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
    try {
      await publishTicketPanel(target);
      return interaction.reply({ content: "Ticket panel published.", ephemeral: true });
    } catch (error) {
      return interaction.reply({ content: `Could not publish the panel: ${error.message}`, ephemeral: true });
    }
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
      if (!canManageTicket(interaction.member, interaction.guildId, ticket)) {
        return interaction.reply({ content: "❌ You cannot close this ticket.", ephemeral: true });
      }
    }
    if (ticket && !ticket.open) {
      return interaction.reply({ content: "This ticket is already closed. Use `/delete` to remove it.", ephemeral: true });
    }

    await interaction.reply({ embeds: [closeEmbed(interaction.user, ticket, ticketConfig.get(interaction.guildId))] });
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
    const selectedOption = findTicketOption(config, type);
    if (!selectedOption) {
      return { error: `That ticket type is not available. Choose one of the configured panel options.` };
    }
    const ticketType = selectedOption.label;

    // Check if user already has an open ticket of this type
    const existing = [...tickets.values()].find(t => t.userId === userId && t.guildId === guild.id && t.open && t.type === ticketType);
    if (existing) {
      return { error: `You already have an open **${ticketType}** ticket!` };
    }

    const categoryId = selectedOption.categoryId;

    // Block creation if category isn't set
    if (!categoryId) {
      return { error: `The category for **${ticketType}** tickets has not been set up yet.` };
    }

    // Explicitly fetch category to ensure it exists and we can see it
    const category = await guild.channels.fetch(categoryId).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return { error: `The category ID provided for **${ticketType}** is invalid. Update the ticket settings in the dashboard.` };
    }

    const slug = ticketType.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 25) || "ticket";
    // Create the ticket channel strictly inside the parent category
    const channel = await guild.channels.create({
      name: `${slug}-${user.username.slice(0, 15).toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
      type: ChannelType.GuildText,
      parent: category.id, 
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
        ...(config.staffRoleId ? [{ id: config.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
      ],
      topic: `${ticketType} Ticket | User: ${user.tag}`,
    });

    // Save to memory + DB
    const ticketData = {
      id: `${guild.id}:${channel.id}`,
      channelId: channel.id, guildId: guild.id,
      userId, type: ticketType, reason, open: true,
      openedAt: Date.now(), members: [],
    };
    tickets.set(`${guild.id}:${channel.id}`, ticketData);
    await upsertTicket(ticketData);

    const variables = {
      user: `<@${userId}>`,
      "user.name": user.username,
      "user.tag": user.tag || user.username,
      server: guild.name,
      type: ticketType,
      reason,
      channel: `<#${channel.id}>`,
      staff: config.staffRoleId ? `<@&${config.staffRoleId}>` : "staff",
    };
    const settings = getTicketDashboardConfig(guild.id);
    const embed = buildSupportEmbed(settings.openedEmbed, variables, {
      title: `✦ ${ticketType} Ticket`,
      description: `${DIVIDER}\nHello {user}!\nReason: **{reason}**\n\nStaff will assist you shortly.\n${DIVIDER}`,
      color: "#E84057",
      footer: FOOTER_MAIN.text,
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_ticket").setLabel("Close").setStyle(ButtonStyle.Danger).setEmoji("🔒")
    );

    const ping = config.staffRoleId ? `<@&${config.staffRoleId}> <@${userId}>` : `<@${userId}>`;
    await channel.send({
      content: ping,
      embeds: [embed],
      components: [row],
      allowedMentions: {
        roles: config.staffRoleId ? [config.staffRoleId] : [],
        users: [userId],
      },
    });

    if (config.logChannelId) {
      const logChannel = await guild.channels.fetch(config.logChannelId).catch(() => null);
      if (logChannel?.isTextBased?.()) {
        const logEmbed = buildSupportEmbed(settings.openedEmbed, { ...variables, reason: "" }, {
          title: "Ticket opened",
          description: "{user} opened a {type} ticket in {channel}.",
          color: "#E84057",
          footer: FOOTER_MAIN.text,
        });
        await logChannel.send({ embeds: [logEmbed], allowedMentions: { parse: [] } }).catch(() => {});
      }
    }

    return { channel };
  } catch (err) {
    console.error("Ticket Creation Error:", err);
    return { error: "Failed to create the ticket channel. Please check my permissions." };
  } finally {
    // Hold the lock for 10 seconds to ensure the process is fully finished
    setTimeout(() => creationLock.delete(lockKey), 10000);
  }
}

async function ticketTranscript(channel) {
  const messages = [];
  let before;
  for (let page = 0; page < 5; page += 1) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
    if (!batch?.size) break;
    messages.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = messages.map((message) => {
    const time = new Date(message.createdTimestamp).toISOString();
    const content = message.content || message.embeds?.map((embed) => embed.description).filter(Boolean).join(" ") || "";
    const files = [...(message.attachments?.values?.() || [])]
      .map((file) => `[Attachment: ${file.name || "file"}] ${file.url}`)
      .join(" ");
    return `[${time}] ${message.author?.tag || "Unknown"} (${message.author?.id || "?"}): ${[content, files].filter(Boolean).join(" ")}`;
  });
  return lines.join("\n").slice(0, 2_000_000) || "No messages were recorded.";
}

export async function closeTicket(channel, ticket, ticketId, user, guild) {
  try {
    const data = tickets.get(ticketId) || ticket;
    if (!data.open) return;
    data.open = false;
    data.closedAt = Date.now();
    tickets.set(ticketId, data);
    await closeTicketDb(ticketId);
    const config = ticketConfig.get(guild.id) || {};
    await channel.permissionOverwrites.edit(data.userId, { SendMessages: false }).catch(() => {});
    if (config.staffRoleId) {
      await channel.permissionOverwrites.edit(config.staffRoleId, { SendMessages: false }).catch(() => {});
    }
    const settings = getTicketDashboardConfig(guild.id);
    const variables = {
      user: `<@${data.userId}>`,
      "user.name": "",
      "user.tag": "",
      server: guild.name,
      type: data.type,
      reason: "",
      channel: `<#${channel.id}>`,
      staff: user.tag || user.username,
      closer: user.tag || user.username,
    };
    if (config.logChannelId) {
      const logChannel = await guild.channels.fetch(config.logChannelId).catch(() => null);
      if (logChannel?.isTextBased?.()) {
        const transcript = await ticketTranscript(channel);
        const embed = buildSupportEmbed(settings.closedEmbed, variables, {
          title: "Ticket closed",
          description: "{user}'s {type} ticket was closed by {closer}. The transcript is attached.",
          color: "#E84057",
          footer: FOOTER_MAIN.text,
        });
        const file = new AttachmentBuilder(Buffer.from(transcript, "utf8"), {
          name: `ticket-${data.userId}-${Date.now()}.txt`,
        });
        const transcriptMessage = await logChannel.send({ embeds: [embed], files: [file], allowedMentions: { parse: [] } });
        data.transcriptChannelId = logChannel.id;
        data.transcriptMessageId = transcriptMessage.id;
        await setTicketTranscript(ticketId, logChannel.id, transcriptMessage.id);
      }
    }
  } catch (error) {
    console.error("Ticket close failed:", error);
  }
}

export function closeEmbed(user, ticket = {}, config = {}) {
  const settings = {
    title: "Ticket closed",
    description: "This ticket is now closed. The channel and transcript are retained; use `/delete` when you are ready to remove it.",
    color: "#E84057",
    footer: FOOTER_MAIN.text,
    ...(config.closedEmbed || {}),
  };
  return buildSupportEmbed(settings, {
    user: ticket.userId ? `<@${ticket.userId}>` : "",
    type: ticket.type || "ticket",
    closer: user.tag || user.username,
    channel: ticket.channelId ? `<#${ticket.channelId}>` : "",
  });
}