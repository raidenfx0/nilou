import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { modmailConfigs, modmailTickets, ticketConfig, tickets } from "../data/store.js";
import { deleteModmailTicketDb, deleteTicketDb } from "../db/index.js";
import { isAdmin } from "../utils/adminCheck.js";

export const data = new SlashCommandBuilder()
  .setName("delete")
  .setDescription("Permanently delete this closed ticket and its saved transcript");

function mayDelete(member, config) {
  if (!member) return false;
  if (isAdmin(member)
    || member.permissions?.has(PermissionFlagsBits.Administrator)
    || member.permissions?.has(PermissionFlagsBits.ManageGuild)
    || member.permissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  return Boolean(config?.staffRoleId && member.roles?.cache?.has(config.staffRoleId));
}

async function removeTranscript(client, record) {
  if (!record?.transcriptChannelId || !record?.transcriptMessageId) return;
  const channel = await client.channels.fetch(record.transcriptChannelId).catch(() => null);
  if (!channel?.isTextBased?.()) {
    throw new Error("The saved transcript channel could not be accessed.");
  }
  let message;
  try {
    message = await channel.messages.fetch(record.transcriptMessageId);
  } catch (error) {
    if (error.code === 10008) return;
    throw error;
  }
  if (message) await message.delete();
}

export async function execute(interaction) {
  if (!interaction.guild) {
    return interaction.reply({ content: "Use `/delete` in the closed ticket channel.", ephemeral: true });
  }

  const ticketId = `${interaction.guildId}:${interaction.channelId}`;
  const ticket = tickets.get(ticketId);
  const modmailTicket = modmailTickets.get(interaction.channelId);
  const record = ticket || modmailTicket;
  if (!record) {
    return interaction.reply({ content: "This channel is not a saved ticket.", ephemeral: true });
  }
  if (record.open) {
    return interaction.reply({ content: "Close the ticket first. `/delete` only removes closed tickets.", ephemeral: true });
  }

  const config = ticket
    ? ticketConfig.get(interaction.guildId)
    : modmailConfigs.get(modmailTicket.guildId);
  if (!mayDelete(interaction.member, config)) {
    return interaction.reply({ content: "You need Manage Server, Manage Channels, or the configured staff role to delete tickets.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    if (!interaction.channel?.deletable) {
      throw new Error("Nilou needs permission to delete this channel.");
    }
    await removeTranscript(interaction.client, record);
    await interaction.channel.delete(`Closed ticket deleted by ${interaction.user.tag || interaction.user.id}`);
    if (ticket) {
      await deleteTicketDb(ticket.id);
      tickets.delete(ticket.id);
    } else {
      await deleteModmailTicketDb(modmailTicket.channelId);
      modmailTickets.delete(modmailTicket.channelId);
    }
    await interaction.editReply({ content: "Closed ticket and saved transcript deleted." });
  } catch (error) {
    console.error("Ticket deletion failed:", error);
    await interaction.editReply({ content: "I couldn't completely delete this ticket. Check my channel and database permissions." });
  }
}
