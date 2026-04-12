import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { NILOU_RED, FOOTER_MAIN } from '../theme.js';

export const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Manage server bans')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    // Subcommand: /ban add
    .addSubcommand(sub =>
        sub.setName('add')
            .setDescription('Ban a member from your server')
            .addUserOption(opt => opt.setName('user').setDescription('The user to ban').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('type the reason for the ban you want to issue'))
            .addStringOption(opt => opt.setName('duration').setDescription('type the duration in 5s 1h 30m format'))
            .addAttachmentOption(opt => opt.setName('proof').setDescription('A screenshot or image that is considered proof'))
            .addBooleanOption(opt => opt.setName('hack').setDescription('Explicitly ban the user IF they are NOT in your server.'))
            .addBooleanOption(opt => opt.setName('soft').setDescription('Ban and then instantly unban, this deletes the previous mes...'))
            .addIntegerOption(opt => opt.setName('purge_days').setDescription('Messages sent in the last specified days that will be purged when banning.').setMinValue(0).setMaxValue(7))
            .addBooleanOption(opt => opt.setName('dm').setDescription('dm the user before banning'))
    )
    // Subcommand: /ban remove
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Unban a user from your server')
            .addStringOption(opt => opt.setName('user').setDescription('The ID of the user to unban').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('type the reason for the unban you want to issue'))
            .addAttachmentOption(opt => opt.setName('proof').setDescription('A screenshot or image that is considered proof'))
    );

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const duration = interaction.options.getString('duration');
        const proof = interaction.options.getAttachment('proof');
        const isHackBan = interaction.options.getBoolean('hack');
        const isSoftBan = interaction.options.getBoolean('soft');
        const purgeDays = interaction.options.getInteger('purge_days') || 0;
        const shouldDm = interaction.options.getBoolean('dm');

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (member && !member.bannable) {
            return interaction.reply({ content: "❌ I cannot ban this user. They might have a higher role than me.", ephemeral: true });
        }

        if (!member && !isHackBan) {
            return interaction.reply({ content: "❌ That user isn't in the server. Use the `hack` option to ban them anyway.", ephemeral: true });
        }

        if (shouldDm) {
            try {
                await user.send(`🌸 You have been banned from **${interaction.guild.name}**\n**Reason:** ${reason}${duration ? `\n**Duration:** ${duration}` : ''}`).catch(() => {});
            } catch (err) {}
        }

        try {
            await interaction.guild.members.ban(user.id, {
                deleteMessageSeconds: purgeDays * 86400,
                reason: `${interaction.user.tag}: ${reason}`
            });

            if (isSoftBan) {
                await interaction.guild.members.unban(user.id, 'Soft ban cleanup');
            }

            const embed = new EmbedBuilder()
                .setColor(NILOU_RED)
                .setTitle(isSoftBan ? '✦ Soft Ban Issued' : '✦ User Banned')
                .setDescription(`**Target:** ${user.tag} (${user.id})\n**Moderator:** ${interaction.user}\n**Reason:** ${reason}`)
                .addFields(
                    { name: 'Duration', value: duration || 'Permanent', inline: true },
                    { name: 'Purged', value: `${purgeDays} days`, inline: true }
                )
                .setFooter(FOOTER_MAIN)
                .setTimestamp();

            if (proof) embed.setImage(proof.url);
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            await interaction.reply({ content: `❌ Failed to ban: ${error.message}`, ephemeral: true });
        }
    } 

    else if (subcommand === 'remove') {
        const userId = interaction.options.getString('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const proof = interaction.options.getAttachment('proof');

        try {
            const banEntry = await interaction.guild.bans.fetch(userId).catch(() => null);
            if (!banEntry) {
                return interaction.reply({ content: "❌ That user doesn't seem to be banned here.", ephemeral: true });
            }

            await interaction.guild.members.unban(userId, `${interaction.user.tag}: ${reason}`);

            // Try to DM the user about the unban
            const user = banEntry.user;
            try {
                await user.send(`🌸 Good news! You have been unbanned from **${interaction.guild.name}**.\n**Reason for Unban:** ${reason}`).catch(() => {});
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setColor(NILOU_RED)
                .setTitle('✦ User Unbanned')
                .setDescription(`**Target:** ${user.tag} (${user.id})\n**Moderator:** ${interaction.user}\n**Reason:** ${reason}`)
                .setFooter(FOOTER_MAIN)
                .setTimestamp();

            if (proof) embed.setImage(proof.url);

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            await interaction.reply({ content: `❌ Failed to unban: ${error.message}`, ephemeral: true });
        }
    }
}