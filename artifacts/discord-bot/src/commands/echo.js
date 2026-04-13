import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';

/**
 * Standard Echo Command
 * Sends a message through the bot anonymously to a specific or current channel.
 */
export const data = new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Sends a message through the bot anonymously')
    .addStringOption(option => 
        option.setName('message')
            .setDescription('The text to send')
            .setRequired(true))
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The channel to send the message to (defaults to current)')
            .addChannelTypes(ChannelType.GuildText));

export async function execute(interaction) {
    const message = interaction.options.getString('message');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

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