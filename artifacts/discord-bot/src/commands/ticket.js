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

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Ticket system")
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
      .setDescription("Configure ticket system (admin only)")
      .addStringOption((o) =>
        o.setName("support_category").setDescription("Category ID for Support tickets").setRequired(false)
      )
      .addStringOption((o) =>
        o.setName("appeal_category").setDescription("Category ID for Appeal tickets").setRequired(false)
      )
      .addStringOption((o) =>
        o.setName("partnership_category").setDescription("Category ID for Partnership tickets").setRequired(false)
      )
      .addStringOption((o) =>
        o.setName("staff_role").setDescription("Staff Role ID — given view access to all tickets").setRequired(false)
      )
      .addStringOption((o) =>
        o.setName("log_channel").setDescription("Channel ID to log ticket openings/closings").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("open")
      .setDescription("Open a ticket via slash command")
      .addStringOption((o) =>
        o
          .setName("type")
          .setDescription("Ticket type")
          .setRequired(false)
          .addChoices(
            { name: "Support", value: "Support" },
            { name: "Appeal", value: "Appeal" },
            { name: "Partnership", value: "Partnership" }
          )
      )
      .addStringOption((o) =>
        o.setName("reason").setDescription("Briefly describe your issue").setRequired(false)
      )
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

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "setup") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const supportCat     = interaction.options.getString("support_category");
    const appealCat      = interaction.options.getString("appeal_category");
    const partnershipCat = interaction.options.getString("partnership_category");
    const staffRole      = interaction.options.getString("staff_role");
    const logChannel     = interaction.options.getString("log_channel");

    const existing = ticketConfig.get(interaction.guildId) || {};
    const updated  = {
      ...existing,
      ...(supportCat     && { supportCategoryId:     supportCat     }),
      ...(appealCat      && { appealCategoryId:      appealCat      }),
      ...(partnershipCat && { partnershipCategoryId: partnershipCat }),
      ...(staffRole      && { staffRoleId:           staffRole      }),
      ...(logChannel     && { logChannelId:          logChannel     }),
    };
    ticketConfig.set(interaction.guildId, updated);

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Ticket System Configured")
      .setDescription(
        `${DIVIDER}\n` +
        `🌸 Ticket config updated!\n\n` +
        `Support Category: ${updated.supportCategoryId     ? `\`${updated.supportCategoryId}\``     : "Not set"}\n` +
        `Appeal Category: ${updated.appealCategoryId      ? `\`${updated.appealCategoryId}\``      : "Not set"}\n` +
        `Partnership Category: ${updated.partnershipCategoryId ? `\`${updated.partnershipCategoryId}\`` : "Not set"}\n` +
        `Staff Role: ${updated.staffRoleId   ? `<@&${updated.staffRoleId}>`   : "Not set"}\n` +
        `Log Channel: ${updated.logChannelId ? `<#${updated.logChannelId}>`   : "Not set"}\n` +
        `${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (sub === "panel") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const target = interaction.options.getChannel("channel");

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Support Tickets")
      .setDescription(
        `${DIVIDER}\n` +
        `🌸 Need help? Open a ticket by clicking one of the buttons below.\n\n` +
        `🎫 **Support** — General help and questions\n` +
        `⚖️ **Appeal** — Ban or punishment appeals\n` +
        `🤝 **Partnership** — Partnership inquiries\n\n` +
        `A staff member will assist you shortly!\n` +
        `${DIVIDER}`
      )
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("btn_support")
        .setLabel("Support")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎫"),
      new ButtonBuilder()
        .setCustomId("btn_appeal")
        .setLabel("Appeal")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⚖️"),
      new ButtonBuilder()
        .setCustomId("btn_partnership")
        .setLabel("Partnership")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🤝")
    );

    await target.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `🌸 Ticket panel sent to ${target}!`, ephemeral: true });
    return;
  }

  if (sub === "open") {
    const type   = interaction.options.getString("type") || "Support";
    const reason = interaction.options.getString("reason") || "No reason provided";
    await openTicket({ guild: interaction.guild, user: interaction.user, type, reason });
    await interaction.reply({ content: `🌸 Your **${type}** ticket has been opened!`, ephemeral: true });
    return;
  }

  if (sub === "close") {
    const ticketId = `${interaction.guildId}:${interaction.channelId}`;
    const ticket   = tickets.get(ticketId);
    if (!ticket || !ticket.open) {
      return interaction.reply({ content: "❌ This is not an open ticket channel.", ephemeral: true });
    }
    if (ticket.userId !== interaction.user.id && !isAdmin(interaction.member)) {
      return interaction.reply({ content: "❌ Only the ticket owner or an admin can close this.", ephemeral: true });
    }
    await closeTicket(interaction.channel, ticket, ticketId, interaction.user, interaction.guild);
    await interaction.reply({
      embeds: [closeEmbed(interaction.user)],
    });
    return;
  }

  if (sub === "add") {
    const ticketId = `${interaction.guildId}:${interaction.channelId}`;
    const ticket   = tickets.get(ticketId);
    if (!ticket?.open) return interaction.reply({ content: "❌ Not an open ticket channel.", ephemeral: true });
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const user = interaction.options.getUser("user");
    await interaction.channel.permissionOverwrites.create(user.id, {
      ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
    });
    if (!ticket.members.includes(user.id)) ticket.members.push(user.id);
    tickets.set(ticketId, ticket);
    await interaction.reply({ content: `🌸 ${user} has been added to this ticket!` });
    return;
  }

  if (sub === "remove") {
    const ticketId = `${interaction.guildId}:${interaction.channelId}`;
    const ticket   = tickets.get(ticketId);
    if (!ticket?.open) return interaction.reply({ content: "❌ Not an open ticket channel.", ephemeral: true });
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);
    const user = interaction.options.getUser("user");
    if (user.id === ticket.userId) return interaction.reply({ content: "❌ Cannot remove the ticket owner.", ephemeral: true });
    await interaction.channel.permissionOverwrites.delete(user.id);
    ticket.members = ticket.members.filter((id) => id !== user.id);
    tickets.set(ticketId, ticket);
    await interaction.reply({ content: `🌸 ${user} has been removed.` });
    return;
  }
}

export function closeEmbed(user) {
  return new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ Ticket Closed")
    .setDescription(`${DIVIDER}\n🌸 Closed by ${user}.\nThis channel will be deleted in 5 seconds.\n${DIVIDER}`)
    .setFooter(FOOTER_MAIN)
    .setTimestamp();
}

export async function closeTicket(channel, ticket, ticketId, user, guild) {
  ticket.open = false;
  tickets.set(ticketId, ticket);

  const config = ticketConfig.get(guild.id);
  if (config?.logChannelId) {
    const logCh = guild.channels.cache.get(config.logChannelId);
    if (logCh) {
      logCh.send({
        embeds: [
          new EmbedBuilder()
            .setColor(NILOU_RED)
            .setTitle("✦ Ticket Closed")
            .setDescription(`Closed by: ${user.tag}\nTicket: <#${channel.id}>`)
            .setFooter(FOOTER_MAIN)
            .setTimestamp(),
        ],
      }).catch(() => {});
    }
  }

  setTimeout(() => {
    channel.delete().catch(() => {});
    tickets.delete(ticketId);
  }, 5000);
}

export async function openTicket({ guild, user, type, reason = "No reason provided" }) {
  const config = ticketConfig.get(guild.id) || {};

  const guildTickets = [...tickets.values()].filter(
    (t) => t.guildId === guild.id && t.userId === user.id && t.open
  );
  if (guildTickets.length >= 3) return { error: "You already have 3 open tickets. Please close one first!" };

  const categoryId = {
    Support:     config.supportCategoryId,
    Appeal:      config.appealCategoryId,
    Partnership: config.partnershipCategoryId,
  }[type] || null;

  const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)}`;

  const permissionOverwrites = [
    { id: guild.id,          deny:  [PermissionFlagsBits.ViewChannel] },
    {
      id: user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
    {
      id: guild.client.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
    },
  ];

  if (config.staffRoleId) {
    permissionOverwrites.push({
      id: config.staffRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  let channel;
  try {
    channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites,
      topic: `${type} ticket by ${user.tag} — ${reason}`,
    });
  } catch (err) {
    return { error: `Could not create ticket channel: ${err.message}` };
  }

  const ticketId = `${guild.id}:${channel.id}`;
  tickets.set(ticketId, {
    id: ticketId,
    channelId: channel.id,
    guildId: guild.id,
    userId: user.id,
    type,
    reason,
    open: true,
    openedAt: Date.now(),
    members: [user.id],
  });

  const ICONS = { Support: "🎫", Appeal: "⚖️", Partnership: "🤝" };

  const openEmbed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle(`✦ ${ICONS[type] || "🎫"} ${type} Ticket`)
    .setDescription(
      `${DIVIDER}\n` +
      `🌸 Hello ${user}! Your ticket is open.\n\n` +
      `Type: **${type}**\nReason: ${reason}\n\n` +
      `A staff member will be with you shortly!\n` +
      `${DIVIDER}`
    )
    .setFooter(FOOTER_MAIN)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒")
  );

  const ping = config.staffRoleId
    ? `${user} | <@&${config.staffRoleId}>`
    : `${user}`;

  await channel.send({ content: ping, embeds: [openEmbed], components: [row] });

  if (config.logChannelId) {
    const logCh = guild.channels.cache.get(config.logChannelId);
    if (logCh) {
      logCh.send({
        embeds: [
          new EmbedBuilder()
            .setColor(NILOU_RED)
            .setTitle("✦ Ticket Opened")
            .setDescription(
              `User: ${user.tag}\nType: ${type}\nChannel: ${channel}\nReason: ${reason}`
            )
            .setFooter(FOOTER_MAIN)
            .setTimestamp(),
        ],
      }).catch(() => {});
    }
  }

  return { channel };
}
