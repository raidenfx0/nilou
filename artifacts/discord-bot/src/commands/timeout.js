import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { NILOU_RED, FOOTER_MAIN } from '../theme.js';

// Helper function to parse duration strings (e.g., "1h 30m", "5s")
function parseDuration(str) {
    const regex = /(\d+)\s*([smhd])/g;
    let totalMs = 0;
    let match;
    while ((match = regex.exec(str)) !== null) {
        const value = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
            case 's': totalMs += value * 1000; break;
            case 'm': totalMs += value * 60000; break;
            case 'h': totalMs += value * 3600000; break;
            case 'd': totalMs += value * 86400000; break;
        }
    }
    return totalMs;
}

export const data = new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Manage member timeouts')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    // Subcommand: /timeout add
    .addSubcommand(sub =>
        sub.setName('add')
            .setDescription('Time a member out from your server')
            .addUserOption(opt => opt.setName('user').setDescription('The user to timeout').setRequired(true))
            .addStringOption(opt => opt.setName('duration').setDescription('type the duration in 5s 1h 30m format').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('type the reason for the timeout you want to issue'))
            .addAttachmentOption(opt => opt.setName('proof').setDescription('A screenshot or image that is considered proof'))
            .addBooleanOption(opt => opt.setName('dm').setDescription('dm the user upon timing them out'))
    )
    // Subcommand: /timeout remove
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Remove the timeout of a member')
            .addUserOption(opt => opt.setName('user').setDescription('The user to remove timeout from').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('type the reason behind the timeout removal'))
            .addAttachmentOption(opt => opt.setName('proof').setDescription('A screenshot or image that is considered proof'))
            .addBooleanOption(opt => opt.setName('dm').setDescription('dm the user when removing the timeout'))
    );

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const proof = interaction.options.getAttachment('proof');
    const shouldDm = interaction.options.getBoolean('dm');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
        return interaction.reply({ content: "❌ That user isn't in the server.", ephemeral: true });
    }

    if (!member.manageable) {
        return interaction.reply({ content: "❌ I cannot moderate this user. They might have a higher role than me.", ephemeral: true });
    }

    if (subcommand === 'add') {
        const durationStr = interaction.options.getString('duration');
        const durationMs = parseDuration(durationStr);

        if (durationMs <= 0 || durationMs > 2419200000) { // Max 28 days
            return interaction.reply({ content: "❌ Invalid duration. Use formats like `1h`, `30m`, or `1d`. Max is 28 days.", ephemeral: true });
        }

        try {
            if (shouldDm) {
                await user.send(`🌸 You have been timed out in **${interaction.guild.name}**\n**Duration:** ${durationStr}\n**Reason:** ${reason}`).catch(() => {});
            }

            await member.timeout(durationMs, `${interaction.user.tag}: ${reason}`);

            const embed = new EmbedBuilder()
                .setColor(NILOU_RED)
                .setTitle('✦ Member Timed Out')
                .setDescription(`**Target:** ${user.tag} (\`${user.id}\`)\n**Moderator:** ${interaction.user}\n**Duration:** ${durationStr}\n**Reason:** ${reason}`)
                .setFooter(FOOTER_MAIN)
                .setTimestamp();

            if (proof) embed.setImage(proof.url);
            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            await interaction.reply({ content: `❌ Failed to timeout: ${err.message}`, ephemeral: true });
        }
    } 

    else if (subcommand === 'remove') {
        if (!member.communicationDisabledUntilTimestamp) {
            return interaction.reply({ content: "❌ This user is not currently timed out.", ephemeral: true });
        }

        try {
            if (shouldDm) {
                await user.send(`🌸 Your timeout has been removed in **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
            }

            await member.timeout(null, `${interaction.user.tag}: ${reason}`);

            const embed = new EmbedBuilder()
                .setColor(NILOU_RED)
                .setTitle('✦ Timeout Removed')
                .setDescription(`**Target:** ${user.tag} (\`${user.id}\`)\n**Moderator:** ${interaction.user}\n**Reason:** ${reason}`)
                .setFooter(FOOTER_MAIN)
                .setTimestamp();

            if (proof) embed.setImage(proof.url);
            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            await interaction.reply({ content: `❌ Failed to remove timeout: ${err.message}`, ephemeral: true });
        }
    }
}