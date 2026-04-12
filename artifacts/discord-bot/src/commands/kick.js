import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { NILOU_RED, FOOTER_MAIN } from '../theme.js';

export const data = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt => 
        opt.setName('user')
            .setDescription('The user to kick')
            .setRequired(true))
    .addStringOption(opt => 
        opt.setName('reason')
            .setDescription('type the reason for the kick you want to issue'))
    .addAttachmentOption(opt => 
        opt.setName('proof')
            .setDescription('A screenshot or image that is considered proof'))
    .addBooleanOption(opt => 
        opt.setName('dm')
            .setDescription('dm the user before kicking'));

export async function execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const proof = interaction.options.getAttachment('proof');
    const shouldDm = interaction.options.getBoolean('dm');

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    // Safety checks: Ensure the member is in the server and the bot has hierarchy
    if (!member) {
        return interaction.reply({ 
            content: "❌ That user isn't in the server, so I can't kick them!", 
            ephemeral: true 
        });
    }

    if (!member.kickable) {
        return interaction.reply({ 
            content: "❌ I cannot kick this user. They might have a higher role than me or be the server owner.", 
            ephemeral: true 
        });
    }

    // Attempt to DM the user before the kick happens
    if (shouldDm) {
        try {
            await user.send({
                content: `🌸 You have been kicked from **${interaction.guild.name}**\n**Reason:** ${reason}`
            }).catch(() => {
                console.log(`Log: Could not DM ${user.tag} (DMs likely closed).`);
            });
        } catch (err) {
            // Silently fail if DMs are off
        }
    }

    try {
        // Execute the kick with a modlog reason
        await member.kick(`${interaction.user.tag}: ${reason}`);

        // Build the success embed
        const embed = new EmbedBuilder()
            .setColor(NILOU_RED)
            .setTitle('✦ Member Kicked')
            .setDescription(`**Target:** ${user.tag} (\`${user.id}\`)\n**Moderator:** ${interaction.user}\n**Reason:** ${reason}`)
            .setFooter(FOOTER_MAIN)
            .setTimestamp();

        // Attach proof if provided
        if (proof) {
            embed.setImage(proof.url);
        }

        await interaction.reply({ embeds: [embed] });

    } catch (error) {
        console.error(`Kick Error: ${error}`);
        await interaction.reply({ 
            content: `❌ Failed to kick member: ${error.message}`, 
            ephemeral: true 
        });
    }
}