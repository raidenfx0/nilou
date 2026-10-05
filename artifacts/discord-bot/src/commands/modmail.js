import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { NILOU_RED, NILOU_RED_DARK, FOOTER_MAIN } from "../theme.js";
import { isAdmin, denyAdmin } from "../utils/adminCheck.js";
import { modmailConfigs, modmailTickets } from "../data/store.js";
import {
  closeModmailTicket as closeModmailTicketDb,
  createModmailTicket,
  getAllModmailConfigs,
  updateModmailTicketCategory,
  upsertModmailConfig,
} from "../db/index.js";

const MAX_OPEN_TICKETS_PER_USER = 1;
const MAX_TRANSCRIPT_MESSAGES = 500;
const CATEGORIES = [
  { key: "support", label: "General Support", description: "Questions and general assistance", emoji: "💬" },
  { key: "report", label: "Report / Ban Appeal", description: "Reports, rule concerns, or appeals", emoji: "🛡️" },
  { key: "feedback", label: "Feedback & Suggestions", description: "Ideas and server feedback", emoji: "💡" },
  { key: "bug", label: "Bug Report", description: "Technical issues and bug reports", emoji: "🐛" },
];
const pendingRequests = new Map();

export const data = new SlashCommandBuilder()
  .setName("modmail")
  .setDescription("Set up and manage private ModMail conversations")
  .addSubcommand((sub) =>
    sub.setName("setup").setDescription("Configure the ModMail category, staff role, and log channel")
      .addChannelOption((option) => option.setName("category")
        .setDescription("Category where private ModMail channels will be created")
        .addChannelTypes(ChannelType.GuildCategory).setRequired(true))
      .addChannelOption((option) => option.setName("log_channel")
        .setDescription("Channel for ticket and message logs")
        .addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addRoleOption((option) => option.setName("staff_role")
        .setDescription("Role that can view and answer ModMail tickets").setRequired(true)))
  .addSubcommand((sub) => sub.setName("settings").setDescription("View the saved ModMail configuration"))
  .addSubcommand((sub) => sub.setName("disable").setDescription("Disable ModMail for this server"))
  .addSubcommand((sub) => sub.setName("reply").setDescription("Reply to the user in this ModMail ticket")
    .addStringOption((option) => option.setName("message").setDescription("Message to send to the user").setRequired(true)))
  .addSubcommand((sub) => sub.setName("anonreply").setDescription("Reply without showing your staff identity")
    .addStringOption((option) => option.setName("message").setDescription("Message to send anonymously").setRequired(true)))
  .addSubcommand((sub) => sub.setName("close").setDescription("Close this ModMail ticket")
    .addStringOption((option) => option.setName("reason").setDescription("Optional closure reason").setRequired(false)));

function configEmbed(guild, config) {
  return new EmbedBuilder()
    .setColor(config?.enabled ? NILOU_RED : NILOU_RED_DARK)
    .setTitle("✦ ModMail Configuration")
    .setDescription(config?.enabled
      ? "ModMail is ready. Members can DM Nilou to contact your staff team."
      : "ModMail is not configured or is currently disabled.")
    .addFields(
      { name: "Status", value: config?.enabled ? "Enabled" : "Disabled", inline: true },
      { name: "Ticket category", value: config?.categoryId ? `<#${config.categoryId}>` : "Not set", inline: true },
      { name: "Staff role", value: config?.staffRoleId ? `<@&${config.staffRoleId}>` : "Not set", inline: true },
      { name: "Log channel", value: config?.logChannelId ? `<#${config.logChannelId}>` : "Not set", inline: true },
    )
    .setFooter({ text: `${guild.name} • ModMail`, iconURL: guild.iconURL() || undefined })
    .setTimestamp();
}

function categorySelect(guildId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`modmail:category:${guildId}`)
      .setPlaceholder("Choose what you need help with")
      .addOptions(CATEGORIES.map((category) => ({
        label: category.label,
        value: category.key,
        description: category.description,
        emoji: category.emoji,
      }))),
  );
}

function serverSelect(guilds) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("modmail:server")
      .setPlaceholder("Select a server")
      .addOptions(guilds.slice(0, 25).map((guild) => ({
        label: guild.name.slice(0, 100),
        value: guild.id,
        description: `Open a private support conversation`,
      }))),
  );
}

function closeRow(channelId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`modmail:close:${channelId}`)
      .setLabel("Close ModMail")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
  );
}

function safeChannelName(username, userId) {
  const slug = String(username || "user")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55) || "user";
  return `modmail-${slug}-${String(userId).slice(-4)}`;
}

function messageText(message) {
  const content = String(message.content || "").trim();
  const attachmentLines = [...(message.attachments?.values?.() || [])]
    .map((file) => `[Attachment: ${file.name || "file"}] ${file.url}`)
    .slice(0, 10);
  return [content, ...attachmentLines].filter(Boolean).join("\n").slice(0, 4000) || "(No text content)";
}

function embedMessage(title, text, color, author = null) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(text.slice(0, 4000))
    .setTimestamp();
  if (author) embed.setAuthor(author);
  return embed;
}

async function logModmail(client, ticket, title, description, color = NILOU_RED) {
  const config = modmailConfigs.get(ticket.guildId);
  if (!config?.logChannelId) return;
  const channel = await client.channels.fetch(config.logChannelId).catch(() => null);
  if (!channel?.isTextBased?.()) return;
  const embed = embedMessage(title, description, color)
    .addFields(
      { name: "User", value: `<@${ticket.userId}> (\`${ticket.userId}\`)`, inline: true },
      { name: "Ticket", value: `<#${ticket.channelId}>`, inline: true },
      { name: "Category", value: ticket.categoryName, inline: true },
    )
    .setFooter({ text: "Nilou ModMail • Conversation log" });
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
}

async function accessibleModmailGuilds(client, userId) {
  const configured = [...modmailConfigs.values()]
    .filter((config) => config.enabled)
    .slice(0, 100);
  const memberResults = await Promise.all(configured.map(async (config) => {
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return null;
    const member = await guild.members.fetch(userId).catch(() => null);
    return member ? guild : null;
  }));
  return memberResults.filter(Boolean);
}

async function sendServerPicker(message, guilds) {
  const clipped = guilds.length > 25;
  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ Contact Server Support")
    .setDescription(
      "Choose the server you need help with. Your message will only be visible to that server’s staff.\n\n" +
      (clipped ? "Showing the first 25 available servers. " : "") +
      "After selecting a server, choose a topic.",
    )
    .setFooter(FOOTER_MAIN);
  await message.channel.send({ embeds: [embed], components: [serverSelect(guilds)] });
}

async function startFromDm(message, client) {
  const guilds = await accessibleModmailGuilds(client, message.author.id);
  if (!guilds.length) {
    await message.channel.send("ModMail is not currently set up in a server you belong to. Please contact a server moderator another way.");
    return;
  }

  const request = {
    content: messageText(message),
    createdAt: message.createdTimestamp || Date.now(),
  };
  const pending = pendingRequests.get(message.author.id) || [];
  pending.push(request);
  pendingRequests.set(message.author.id, pending.slice(-10));
  await sendServerPicker(message, guilds);
}

async function createConversation(client, guild, member, category, initialMessages = []) {
  const config = modmailConfigs.get(guild.id);
  if (!config?.enabled) throw new Error("ModMail is disabled in that server.");

  const active = [...modmailTickets.values()].find((ticket) =>
    ticket.open && ticket.guildId === guild.id && ticket.userId === member.id);
  if (active) {
    const existingChannel = await guild.channels.fetch(active.channelId).catch(() => null);
    if (existingChannel) return { existing: true, channel: existingChannel, ticket: active };
    active.open = false;
    await closeModmailTicketDb(active.channelId).catch(() => {});
  }

  const categoryChannel = await guild.channels.fetch(config.categoryId).catch(() => null);
  if (!categoryChannel || categoryChannel.type !== ChannelType.GuildCategory) {
    throw new Error("The configured ticket category is missing. Ask a server admin to run `/modmail setup` again.");
  }

  const channel = await guild.channels.create({
    name: safeChannelName(member.user.username, member.id),
    type: ChannelType.GuildText,
    parent: categoryChannel.id,
    topic: `ModMail | User ID: ${member.id} | Category: ${category.label}`,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: config.staffRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ],
  });

  const ticket = {
    channelId: channel.id,
    guildId: guild.id,
    userId: member.id,
    username: member.user.tag || member.user.username,
    categoryKey: category.key,
    categoryName: category.label,
    openedAt: Date.now(),
    open: true,
  };
  try {
    await createModmailTicket(ticket);
  } catch (error) {
    await channel.delete("Could not save ModMail conversation").catch(() => {});
    throw error;
  }
  modmailTickets.set(channel.id, ticket);

  const intro = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ New ModMail Conversation")
    .setDescription("A member has opened a private support conversation. Reply in this channel or use `/modmail reply`.")
    .addFields(
      { name: "Member", value: `<@${member.id}> (\`${member.id}\`)`, inline: true },
      { name: "Category", value: category.label, inline: true },
      { name: "Opened", value: `<t:${Math.floor(ticket.openedAt / 1000)}:F>`, inline: true },
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .setFooter(FOOTER_MAIN);
  await channel.send({
    content: `<@&${config.staffRoleId}>`,
    embeds: [intro],
    components: [closeRow(channel.id)],
    allowedMentions: { roles: [config.staffRoleId] },
  });
  await logModmail(client, ticket, "ModMail opened", "A new private support conversation was created.");

  for (const initial of initialMessages) {
    await channel.send({
      embeds: [embedMessage("Message received", initial.content, 0x2ecc71, {
        name: ticket.username,
        iconURL: member.user.displayAvatarURL({ size: 64 }),
      })],
      allowedMentions: { parse: [] },
    });
    await logModmail(client, ticket, "Message received", initial.content, 0x2ecc71);
  }
  return { channel, ticket, existing: false };
}

async function relayStaffReply(client, ticket, content, staffUser, anonymous = false, recordInTicket = false) {
  const user = await client.users.fetch(ticket.userId).catch(() => null);
  if (!user) throw new Error("The user could not be found.");
  const embed = embedMessage(
    anonymous ? "Message from server staff" : `Message from ${staffUser.username}`,
    content,
    0x5865f2,
    anonymous ? { name: "Server Support Team" } : {
      name: staffUser.tag || staffUser.username,
      iconURL: staffUser.displayAvatarURL({ size: 64 }),
    },
  );
  await user.send({ embeds: [embed], allowedMentions: { parse: [] } });
  if (recordInTicket) {
    const ticketChannel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (ticketChannel?.isTextBased?.()) {
      await ticketChannel.send({
        embeds: [embedMessage(
          anonymous ? "Anonymous staff reply sent" : `Reply sent by ${staffUser.username}`,
          content,
          0x5865f2,
        )],
        allowedMentions: { parse: [] },
      }).catch(() => {});
    }
  }
  await logModmail(client, ticket, anonymous ? "Anonymous reply sent" : "Staff reply sent", content, 0x5865f2);
}

async function makeTranscript(channel) {
  const messages = [];
  let before;
  for (let page = 0; page < Math.ceil(MAX_TRANSCRIPT_MESSAGES / 100); page += 1) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
    if (!batch?.size) break;
    messages.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100 || messages.length >= MAX_TRANSCRIPT_MESSAGES) break;
  }
  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = messages.map((message) => {
    const timestamp = new Date(message.createdTimestamp).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
    const content = message.content || message.embeds?.map((embed) => embed.description).filter(Boolean).join(" ") || "";
    const files = [...(message.attachments?.values?.() || [])].map((file) => `[Attachment: ${file.name || "file"}] ${file.url}`).join(" ");
    return `[${timestamp}] ${message.author?.tag || "Unknown"} (${message.author?.id || "?"}): ${[content, files].filter(Boolean).join(" ")}`;
  });
  return lines.join("\n").slice(0, 2_000_000) || "No messages were recorded.";
}

export async function closeConversation(client, channel, closedBy, reason = "No reason provided") {
  const ticket = modmailTickets.get(channel.id);
  if (!ticket?.open) throw new Error("This ModMail conversation is already closed.");

  const transcript = await makeTranscript(channel);
  await closeModmailTicketDb(ticket.channelId);
  ticket.open = false;
  await logModmail(client, ticket, "ModMail closed", `**Closed by:** ${closedBy.tag || closedBy.username}\n**Reason:** ${reason}`, NILOU_RED_DARK);

  const config = modmailConfigs.get(ticket.guildId);
  const logChannel = config?.logChannelId
    ? await client.channels.fetch(config.logChannelId).catch(() => null)
    : null;
  if (logChannel?.isTextBased?.()) {
    const closeEmbed = new EmbedBuilder()
      .setColor(NILOU_RED_DARK)
      .setTitle("✦ ModMail Transcript")
      .setDescription(`Conversation with <@${ticket.userId}> has been closed.`)
      .addFields(
        { name: "Member", value: `${ticket.username} (\`${ticket.userId}\`)`, inline: true },
        { name: "Closed by", value: closedBy.tag || closedBy.username, inline: true },
        { name: "Category", value: ticket.categoryName, inline: true },
        { name: "Reason", value: String(reason).slice(0, 1024), inline: false },
      )
      .setFooter(FOOTER_MAIN)
      .setTimestamp();
    const file = new AttachmentBuilder(Buffer.from(transcript, "utf8"), {
      name: `modmail-${ticket.userId}-${Date.now()}.txt`,
    });
    await logChannel.send({ embeds: [closeEmbed], files: [file], allowedMentions: { parse: [] } }).catch(() => {});
  }

  const user = await client.users.fetch(ticket.userId).catch(() => null);
  await user?.send({
    embeds: [new EmbedBuilder()
      .setColor(NILOU_RED_DARK)
      .setTitle("✦ Support conversation closed")
      .setDescription(`Your ModMail conversation in **${channel.guild.name}** has been closed.\n\n**Reason:** ${String(reason).slice(0, 900)}`)
      .setFooter(FOOTER_MAIN)
      .setTimestamp()],
  }).catch(() => {});

  setTimeout(() => channel.delete("ModMail conversation closed").catch(() => {}), 5000);
  return ticket;
}

function canManageConversation(member, config) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)
      || member.permissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  return Boolean(config?.staffRoleId && member.roles?.cache?.has(config.staffRoleId));
}

async function handleSlashReply(interaction, ticket, anonymous) {
  const config = modmailConfigs.get(ticket.guildId);
  if (!canManageConversation(interaction.member, config)) {
    return interaction.reply({ content: "Only the configured ModMail staff can reply here.", ephemeral: true });
  }
  const content = interaction.options.getString("message");
  await interaction.deferReply({ ephemeral: true });
  try {
    await relayStaffReply(interaction.client, ticket, content, interaction.user, anonymous, true);
    await interaction.editReply({ content: anonymous ? "Anonymous reply delivered." : "Reply delivered to the user." });
  } catch {
    await interaction.editReply({ content: "I could not deliver the reply. The user may have DMs disabled." });
  }
}

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  if (!interaction.guild) {
    return interaction.reply({ content: "Use `/modmail` setup commands inside a server.", ephemeral: true });
  }

  if (subcommand === "setup") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const category = interaction.options.getChannel("category");
    const logChannel = interaction.options.getChannel("log_channel");
    const staffRole = interaction.options.getRole("staff_role");
    const config = {
      guildId: interaction.guildId,
      categoryId: category.id,
      logChannelId: logChannel.id,
      staffRoleId: staffRole.id,
      enabled: true,
    };
    await upsertModmailConfig(config);
    modmailConfigs.set(interaction.guildId, config);
    return interaction.reply({
      embeds: [configEmbed(interaction.guild, config)],
      ephemeral: true,
    });
  }

  const config = modmailConfigs.get(interaction.guildId);
  if (subcommand === "settings") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    return interaction.reply({ embeds: [configEmbed(interaction.guild, config)], ephemeral: true });
  }
  if (subcommand === "disable") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    if (!config) {
      return interaction.reply({ content: "ModMail is not configured for this server.", ephemeral: true });
    }
    config.enabled = false;
    await upsertModmailConfig(config);
    modmailConfigs.set(interaction.guildId, config);
    return interaction.reply({ embeds: [configEmbed(interaction.guild, config)], ephemeral: true });
  }

  const ticket = modmailTickets.get(interaction.channelId);
  if (!ticket?.open) {
    return interaction.reply({ content: "This command must be used in an open ModMail ticket channel.", ephemeral: true });
  }
  if (subcommand === "reply" || subcommand === "anonreply") {
    return handleSlashReply(interaction, ticket, subcommand === "anonreply");
  }
  if (subcommand === "close") {
    const currentConfig = modmailConfigs.get(ticket.guildId);
    if (!canManageConversation(interaction.member, currentConfig)) {
      return interaction.reply({ content: "Only the configured ModMail staff can close this conversation.", ephemeral: true });
    }
    const reason = interaction.options.getString("reason") || "No reason provided";
    await interaction.deferReply({ ephemeral: true });
    try {
      await closeConversation(interaction.client, interaction.channel, interaction.user, reason);
      await interaction.editReply({ content: "Conversation closed. The transcript was sent to the log channel." });
    } catch (error) {
      await interaction.editReply({ content: error.message || "Could not close this conversation." });
    }
  }
}

export async function handleModmailSelect(interaction) {
  if (interaction.customId === "modmail:server") {
    const guildId = interaction.values[0];
    const guild = interaction.client.guilds.cache.get(guildId);
    const config = modmailConfigs.get(guildId);
    const member = guild ? await guild.members.fetch(interaction.user.id).catch(() => null) : null;
    if (!guild || !member || !config?.enabled) {
      return interaction.update({
        content: "That server is no longer available for ModMail. Send me another message to try again.",
        embeds: [],
        components: [],
      });
    }
    return interaction.update({
      content: `You selected **${guild.name}**. Choose the topic for your request:`,
      embeds: [],
      components: [categorySelect(guildId)],
    });
  }

  if (!interaction.customId.startsWith("modmail:category:")) return;
  const guildId = interaction.customId.slice("modmail:category:".length);
  const guild = interaction.client.guilds.cache.get(guildId);
  const config = modmailConfigs.get(guildId);
  const member = guild ? await guild.members.fetch(interaction.user.id).catch(() => null) : null;
  const category = CATEGORIES.find((item) => item.key === interaction.values[0]);
  if (!guild || !member || !config?.enabled || !category) {
    return interaction.update({
      content: "I could not complete that request. Send me another message to start again.",
      embeds: [],
      components: [],
    });
  }

  await interaction.deferUpdate();
  try {
    const pending = pendingRequests.get(interaction.user.id) || [];
    const result = await createConversation(interaction.client, guild, member, category, pending);
    pendingRequests.delete(interaction.user.id);
    await interaction.editReply({
      content: result.existing
        ? `You already have an open conversation in **${guild.name}**: ${result.channel}. Send your next message here and I’ll pass it along.`
        : `Your private conversation with **${guild.name}** is open. Reply here in this DM to continue.`,
      embeds: [],
      components: [],
    });
  } catch (error) {
    await interaction.editReply({
      content: `I couldn't open the conversation: ${error.message}`,
      embeds: [],
      components: [],
    });
  }
}

export async function handleModmailCloseButton(interaction) {
  const ticket = modmailTickets.get(interaction.channelId);
  const config = ticket ? modmailConfigs.get(ticket.guildId) : null;
  if (!ticket?.open || !canManageConversation(interaction.member, config)) {
    return interaction.reply({ content: "Only ModMail staff can close this conversation.", ephemeral: true });
  }
  await interaction.deferReply({ ephemeral: true });
  try {
    await closeConversation(interaction.client, interaction.channel, interaction.user);
    await interaction.editReply({ content: "Conversation closed. The transcript was sent to the log channel." });
  } catch (error) {
    await interaction.editReply({ content: error.message || "Could not close this conversation." });
  }
}

async function handleStaffMessage(message, ticket) {
  const config = modmailConfigs.get(ticket.guildId);
  if (!canManageConversation(message.member, config)) {
    await message.reply("Only the configured ModMail staff can reply here.").catch(() => {});
    return;
  }
  const content = String(message.content || "").trim();
  if (content.startsWith(".")) {
    const closeMatch = content.match(/^\.close(?:\s+([\s\S]+))?$/i);
    const replyMatch = content.match(/^\.r(?:eply)?(?:\s+([\s\S]+))?$/i);
    const anonMatch = content.match(/^\.ar(?:eply)?(?:\s+([\s\S]+))?$/i);
    const categoryMatch = content.match(/^\.category\s+([\w-]+)\s*$/i);
    if (closeMatch) {
      await message.channel.send("Closing this ModMail conversation and saving its transcript.");
      await closeConversation(message.client, message.channel, message.author, closeMatch[1] || "No reason provided").catch((error) => {
        message.channel.send(`Could not close the conversation: ${error.message}`).catch(() => {});
      });
    } else if (replyMatch || anonMatch) {
      const text = (replyMatch || anonMatch)[1];
      if (!text) return message.reply("Use `.reply <message>` or `.anonreply <message>`.").catch(() => {});
      await relayStaffReply(message.client, ticket, text, message.author, Boolean(anonMatch))
        .then(() => message.react("✅").catch(() => {}))
        .catch(() => message.reply("I couldn't DM the user. They may have DMs disabled.").catch(() => {}));
    } else if (categoryMatch) {
      const nextCategory = CATEGORIES.find((item) => item.key === categoryMatch[1].toLowerCase()
        || item.label.toLowerCase() === categoryMatch[1].toLowerCase());
      if (!nextCategory) {
        return message.reply(`Choose a category: ${CATEGORIES.map((item) => `\`${item.key}\``).join(", ")}.`).catch(() => {});
      }
      await updateModmailTicketCategory(ticket.channelId, nextCategory.key, nextCategory.label);
      ticket.categoryKey = nextCategory.key;
      ticket.categoryName = nextCategory.label;
      modmailTickets.set(ticket.channelId, ticket);
      await message.reply(`Category updated to **${ticket.categoryName}**.`).catch(() => {});
    } else {
      await message.reply("Supported commands: `.reply`, `.anonreply`, `.category`, `.close`.").catch(() => {});
    }
    return;
  }
  if (!content && !message.attachments.size) return;
  const text = messageText(message);
  await relayStaffReply(message.client, ticket, text, message.author)
    .catch(() => message.reply("I couldn't DM the user. They may have DMs disabled.").catch(() => {}));
}

export async function handleModmailMessage(message) {
  if (!message || message.author?.bot) return false;

  if (message.guild) {
    const ticket = modmailTickets.get(message.channelId);
    if (!ticket?.open) return false;
    await handleStaffMessage(message, ticket);
    return true;
  }

  if (message.channel?.type !== ChannelType.DM) return false;
  const active = [...modmailTickets.values()].find((ticket) =>
    ticket.open && ticket.userId === message.author.id);
  if (!active) {
    await startFromDm(message, message.client);
    return true;
  }

  const guild = message.client.guilds.cache.get(active.guildId);
  const config = modmailConfigs.get(active.guildId);
  const channel = guild ? await guild.channels.fetch(active.channelId).catch(() => null) : null;
  if (!channel) {
    active.open = false;
    await closeModmailTicketDb(active.channelId).catch(() => {});
    modmailTickets.delete(active.channelId);
    await message.channel.send("Your previous support conversation is no longer available. I’ll help you open a new one.");
    await startFromDm(message, message.client);
    return true;
  }

  const text = messageText(message);
  await channel.send({
    content: config?.staffRoleId ? `<@&${config.staffRoleId}>` : undefined,
    embeds: [embedMessage("Message received", text, 0x2ecc71, {
      name: active.username,
      iconURL: message.author.displayAvatarURL({ size: 64 }),
    })],
    allowedMentions: { roles: config?.staffRoleId ? [config.staffRoleId] : [] },
  });
  await logModmail(message.client, active, "Message received", text, 0x2ecc71);
  return true;
}
