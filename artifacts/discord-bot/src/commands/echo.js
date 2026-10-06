import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { sendLog } from "../utils/logger.js";

/**
 * Standard Echo Command
 * Sends a message through the bot anonymously to a specific or current channel.
 */
export const data = new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Sends a message through the bot anonymously')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option => 
        option.setName('message')
            .setDescription('The text to send')
            .setRequired(true))
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The channel to send the message to (defaults to current)')
            .addChannelTypes(ChannelType.GuildText));

export async function execute(interaction) {
    if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
            content: '❌ This command requires the Manage Server permission.',
            ephemeral: true
        });
    }
    const message = interaction.options.getString('message');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    if (!targetChannel || targetChannel.guildId !== interaction.guildId) {
        return interaction.reply({
            content: '❌ Choose a text channel in this server.',
            ephemeral: true
        });
    }

    try {
        // Check if the bot has permission to send messages in the target channel
        if (!targetChannel.permissionsFor(interaction.client.user).has(PermissionFlagsBits.SendMessages)) {
            return await interaction.reply({
                content: `❌ I don't have permission to send messages in ${targetChannel}.`,
                ephemeral: true
            });
        }

        // 1. Send the message to the target channel directly
        await targetChannel.send(message);

        // Audit metadata only; never copy the echoed message into logs.
        await sendLog(interaction.guild, 'echo', {
            title: 'Anonymous echo sent',
            description: 'An administrator sent a message through Nilou. Message text is not recorded.',
            fields: [
                { name: 'Used by', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true },
                { name: 'Destination', value: `<#${targetChannel.id}> (\`${targetChannel.id}\`)`, inline: true },
            ],
        });

        // 2. Confirm privately to the user
        await interaction.reply({ 
            content: `✅ Message sent anonymously to ${targetChannel}!`, 
            ephemeral: true 
        });
    } catch (error) {
        console.error('Error in echo command:', error);
        await interaction.reply({ 
            content: '❌ Failed to send the message. Check my permissions!', 
            ephemeral: true 
        });
    }
}