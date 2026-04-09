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

const DEFAULT_TYPES = ["Support", "Report", "Appeal", "Other"];

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Ticket system management")
  .addSubcommand((sub) =>
    sub
      .setName("open")
      .setDescription("Open a new ticket")
      .addStringOption((o) =>
        o
          .setName("type")
          .setDescription("Ticket category")
          .setRequired(false)
          .addChoices(
            { name: "Support", value: "Support" },
            { name: "Report", value: "Report" },
            { name: "Appeal", value: "Appeal" },
            { name: "Other", value: "Other" }
          )
      )
      .addStringOption((o) =>
        o.setName("reason").setDescription("Briefly describe your issue").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("close").setDescription("Close this ticket channel")
  )
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a user to this ticket")
      .addUserOption((o) =>
        o.setName("user").setDescription("User to add").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a user from this ticket")
      .addUserOption((o) =>
        o.setName("user").setDescription("User to remove").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("setup")
      .setDescription("Configure ticket category channel (admin only)")
      .addChannelOption((o) =>
        o
          .setName("category")
          .setDescription("Category channel to create tickets in")
          .setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName("log_channel")
          .setDescription("Channel ID to log ticket openings/closings")
          .setRequired(false)
      )
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "setup") {
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const category = interaction.options.getChannel("category");
    const logId    = interaction.options.getString("log_channel") || null;

    if (category.type !== ChannelType.GuildCategory) {
      await interaction.reply({ content: "❌ Please select a Category channel.", ephemeral: true });
      return;
    }

    ticketConfig.set(interaction.guildId, { categoryId: category.id, logChannelId: logId });

    const embed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Ticket System Configured")
      .setDescription(`${DIVIDER}\n🌸 Tickets will be created under: ${category.name}\n${logId ? `Log channel: <#${logId}>` : "No log channel set."}\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (sub === "open") {
    const type   = interaction.options.getString("type") || "Support";
    const reason = interaction.options.getString("reason") || "No reason provided";
    const config = ticketConfig.get(interaction.guildId);

    const guildTickets = [...tickets.values()].filter(
      (t) => t.guildId === interaction.guildId && t.userId === interaction.user.id && t.open
    );
    if (guildTickets.length >= 3) {
      await interaction.reply({
        content: "🌸 You already have 3 open tickets. Please close one first!",
        ephemeral: true,
      });
      return;
    }

    const ticketNumber = (tickets.size + 1).toString().padStart(4, "0");
    const channelName  = `ticket-${ticketNumber}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);

    let parentId = config?.categoryId || null;

    const permissionOverwrites = [
      {
        id: interaction.guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: interaction.client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
      },
    ];

    let channel;
    try {
      channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: parentId,
        permissionOverwrites,
        topic: `${type} ticket by ${interaction.user.tag} — ${reason}`,
      });
    } catch (err) {
      await interaction.reply({ content: `❌ Could not create ticket channel: ${err.message}`, ephemeral: true });
      return;
    }

    const ticketId = `${interaction.guildId}:${channel.id}`;
    tickets.set(ticketId, {
      id: ticketId,
      channelId: channel.id,
      guildId: interaction.guildId,
      userId: interaction.user.id,
      type,
      reason,
      open: true,
      openedAt: Date.now(),
      members: [interaction.user.id],
    });

    const openEmbed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle(`✦ ${type} Ticket — #${ticketNumber}`)
      .setDescription(`${DIVIDER}\n🌸 Hello ${interaction.user}! Your ticket is open.\n\nType: ${type}\nReason: ${reason}\n\nAn admin will be with you shortly. Please be patient!\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_close:${ticketId}`)
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔒")
    );

    await channel.send({ embeds: [openEmbed], components: [row] });

    if (config?.logChannelId) {
      const logCh = interaction.guild.channels.cache.get(config.logChannelId);
      if (logCh) {
        const logEmbed = new EmbedBuilder()
          .setColor(NILOU_RED)
          .setTitle("✦ Ticket Opened")
          .setDescription(`User: ${interaction.user.tag}\nType: ${type}\nChannel: ${channel}\nReason: ${reason}`)
          .setFooter(FOOTER_MAIN)
          .setTimestamp();
        logCh.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }

    await interaction.reply({
      content: `🌸 Your ticket has been opened in ${channel}!`,
      ephemeral: true,
    });
    return;
  }

  if (sub === "close") {
    const ticketId = `${interaction.guildId}:${interaction.channelId}`;
    const ticket   = tickets.get(ticketId);

    if (!ticket || !ticket.open) {
      await interaction.reply({ content: "❌ This is not an open ticket channel.", ephemeral: true });
      return;
    }

    if (ticket.userId !== interaction.user.id && !isAdmin(interaction.member)) {
      await interaction.reply({ content: "❌ Only the ticket owner or an admin can close this ticket.", ephemeral: true });
      return;
    }

    ticket.open = false;
    tickets.set(ticketId, ticket);

    const closeEmbed = new EmbedBuilder()
      .setColor(NILOU_RED)
      .setTitle("✦ Ticket Closed")
      .setDescription(`${DIVIDER}\n🌸 This ticket has been closed by ${interaction.user}.\nThe channel will be deleted in 5 seconds.\n${DIVIDER}`)
      .setFooter(FOOTER_MAIN)
      .setTimestamp();

    await interaction.reply({ embeds: [closeEmbed] });

    const config = ticketConfig.get(interaction.guildId);
    if (config?.logChannelId) {
      const logCh = interaction.guild.channels.cache.get(config.logChannelId);
      if (logCh) {
        const logEmbed = new EmbedBuilder()
          .setColor(NILOU_RED)
          .setTitle("✦ Ticket Closed")
          .setDescription(`Closed by: ${interaction.user.tag}\nTicket: <#${interaction.channelId}>`)
          .setFooter(FOOTER_MAIN)
          .setTimestamp();
        logCh.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
      tickets.delete(ticketId);
    }, 5000);
    return;
  }

  if (sub === "add") {
    const ticketId = `${interaction.guildId}:${interaction.channelId}`;
    const ticket   = tickets.get(ticketId);
    if (!ticket || !ticket.open) {
      await interaction.reply({ content: "❌ This is not an open ticket channel.", ephemeral: true });
      return;
    }
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const user = interaction.options.getUser("user");
    try {
      await interaction.channel.permissionOverwrites.create(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      if (!ticket.members.includes(user.id)) ticket.members.push(user.id);
      tickets.set(ticketId, ticket);
      await interaction.reply({ content: `🌸 ${user} has been added to this ticket!`, ephemeral: false });
    } catch (err) {
      await interaction.reply({ content: `❌ Failed: ${err.message}`, ephemeral: true });
    }
    return;
  }

  if (sub === "remove") {
    const ticketId = `${interaction.guildId}:${interaction.channelId}`;
    const ticket   = tickets.get(ticketId);
    if (!ticket || !ticket.open) {
      await interaction.reply({ content: "❌ This is not an open ticket channel.", ephemeral: true });
      return;
    }
    if (!isAdmin(interaction.member)) return denyAdmin(interaction);

    const user = interaction.options.getUser("user");
    if (user.id === ticket.userId) {
      await interaction.reply({ content: "❌ Cannot remove the ticket owner.", ephemeral: true });
      return;
    }
    try {
      await interaction.channel.permissionOverwrites.delete(user.id);
      ticket.members = ticket.members.filter((id) => id !== user.id);
      tickets.set(ticketId, ticket);
      await interaction.reply({ content: `🌸 ${user} has been removed from this ticket.`, ephemeral: false });
    } catch (err) {
      await interaction.reply({ content: `❌ Failed: ${err.message}`, ephemeral: true });
    }
    return;
  }
}
