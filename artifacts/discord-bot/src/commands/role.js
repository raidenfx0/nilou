import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { NILOU_RED, FOOTER_MAIN } from '../theme.js';
import { guildStore } from '../db/store.js';

export const data = new SlashCommandBuilder()
    .setName('role')
    .setDescription('Advanced role management')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
        sub.setName('info')
            .setDescription('Get information about a specific role')
            .addRoleOption(opt => opt.setName('role').setDescription('The role to get info on').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('create')
            .setDescription('Create a new role')
            .addStringOption(opt => opt.setName('name').setDescription('Name of the role').setRequired(true))
            .addStringOption(opt => opt.setName('color').setDescription('Hex color code (e.g. #ff0000)'))
            .addBooleanOption(opt => opt.setName('mentionable').setDescription('Should the role be mentionable?'))
            .addBooleanOption(opt => opt.setName('hoist').setDescription('Should the role be displayed separately?'))
    )
    .addSubcommand(sub =>
        sub.setName('add')
            .setDescription('Add a role to a member')
            .addUserOption(opt => opt.setName('user').setDescription('The member').setRequired(true))
            .addRoleOption(opt => opt.setName('role').setDescription('The role to add').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('temp')
            .setDescription('Give a member a temporary role')
            .addUserOption(opt => opt.setName('user').setDescription('The member').setRequired(true))
            .addRoleOption(opt => opt.setName('role').setDescription('The role to add').setRequired(true))
            .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 1h, 30m, 1d)').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('all')
            .setDescription('Give a role to every member in the server')
            .addRoleOption(opt => opt.setName('role').setDescription('The role to give to everyone').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('in')
            .setDescription('Give a new role to everyone who already has a specific role')
            .addRoleOption(opt => opt.setName('filter_role').setDescription('Members who HAVE this role...').setRequired(true))
            .addRoleOption(opt => opt.setName('new_role').setDescription('...will be GIVEN this role').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('human')
            .setDescription('Set the auto-role for new humans')
            .addRoleOption(opt => opt.setName('role').setDescription('The role to give humans on join').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('bots')
            .setDescription('Set the auto-role for new bots')
            .addRoleOption(opt => opt.setName('role').setDescription('The role to give bots on join').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('diagnose')
            .setDescription('Check permissions and details of a role')
            .addRoleOption(opt => opt.setName('role').setDescription('The role to diagnose').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('color')
            .setDescription('Change the color of a role')
            .addRoleOption(opt => opt.setName('role').setDescription('The role to change color').setRequired(true))
            .addStringOption(opt => opt.setName('hex').setDescription('The HEX color code').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('cancel')
            .setDescription('Cancel the current role operation')
    );

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const { guild } = interaction;

    if (subcommand === 'human') {
        const role = interaction.options.getRole('role');
        guildStore.set(guild.id, 'humanRole', role.id);
        return interaction.reply({ content: `✅ Auto-role for **humans** set to ${role}.` });
    }

    if (subcommand === 'bots') {
        const role = interaction.options.getRole('role');
        guildStore.set(guild.id, 'botRole', role.id);
        return interaction.reply({ content: `✅ Auto-role for **bots** set to ${role}.` });
    }

    if (subcommand === 'create') {
        const name = interaction.options.getString('name');
        const color = interaction.options.getString('color') || '#000000';
        const mentionable = interaction.options.getBoolean('mentionable') || false;
        const hoist = interaction.options.getBoolean('hoist') || false;

        try {
            const newRole = await guild.roles.create({
                name, color, mentionable, hoist,
                reason: `Created by ${interaction.user.tag}`
            });
            return interaction.reply({ content: `✅ Successfully created role ${newRole}!` });
        } catch (err) {
            return interaction.reply({ content: `❌ Failed to create role: ${err.message}`, ephemeral: true });
        }
    }

    if (subcommand === 'add') {
        const targetMember = interaction.options.getMember('user');
        const role = interaction.options.getRole('role');
        if (!role.editable) return interaction.reply({ content: "❌ I cannot manage this role.", ephemeral: true });
        await targetMember.roles.add(role);
        return interaction.reply({ content: `✅ Added ${role.name} to ${targetMember.user.tag}.` });
    }

    if (subcommand === 'temp') {
        const targetMember = interaction.options.getMember('user');
        const role = interaction.options.getRole('role');
        const durationStr = interaction.options.getString('duration');

        const ms = (s) => {
            const n = parseInt(s);
            if (s.endsWith('m')) return n * 60000;
            if (s.endsWith('h')) return n * 3600000;
            if (s.endsWith('d')) return n * 86400000;
            return n * 1000;
        };

        const durationMs = ms(durationStr);
        if (!role.editable) return interaction.reply({ content: "❌ I cannot manage this role.", ephemeral: true });

        await targetMember.roles.add(role);
        interaction.reply({ content: `⏳ Given ${role} to ${targetMember} for ${durationStr}.` });

        setTimeout(async () => {
            await targetMember.roles.remove(role).catch(() => {});
        }, durationMs);
    }

    if (subcommand === 'all') {
        const role = interaction.options.getRole('role');
        if (!role.editable) return interaction.reply({ content: "❌ This role is higher than my position.", ephemeral: true });

        await interaction.reply({ content: `🔄 Starting mass role assignment for ${role.name}...` });
        const members = await guild.members.fetch();
        let count = 0;

        for (const [id, member] of members) {
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role).catch(() => {});
                count++;
            }
        }
        return interaction.editReply({ content: `✅ Finished! Added ${role.name} to ${count} members.` });
    }

    if (subcommand === 'in') {
        const filterRole = interaction.options.getRole('filter_role');
        const newRole = interaction.options.getRole('new_role');

        if (!newRole.editable) return interaction.reply({ content: `❌ I cannot assign ${newRole.name} because it is higher than me.`, ephemeral: true });

        await interaction.reply({ content: `🔄 Adding ${newRole.name} to all members who have ${filterRole.name}...` });

        const members = await guild.members.fetch();
        const targets = members.filter(m => m.roles.cache.has(filterRole.id) && !m.roles.cache.has(newRole.id));

        let count = 0;
        for (const [id, member] of targets) {
            await member.roles.add(newRole).catch(() => {});
            count++;
        }

        return interaction.editReply({ content: `✅ Operation complete. Added ${newRole.name} to ${count} members who had ${filterRole.name}.` });
    }

    if (subcommand === 'diagnose') {
        const role = interaction.options.getRole('role');
        const perms = role.permissions.toArray().map(p => `\`${p}\``).join(', ') || 'No special permissions';
        const embed = new EmbedBuilder()
            .setColor(role.color)
            .setTitle(`🔍 Diagnostic: ${role.name}`)
            .addFields(
                { name: 'Color', value: `${role.hexColor}`, inline: true },
                { name: 'Mentionable', value: `${role.mentionable}`, inline: true },
                { name: 'Position', value: `${role.position}`, inline: true },
                { name: 'Key Permissions', value: perms.length > 1024 ? perms.substring(0, 1021) + '...' : perms }
            )
            .setFooter(FOOTER_MAIN);
        return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'info') {
        const role = interaction.options.getRole('role');
        const embed = new EmbedBuilder()
            .setColor(role.color || NILOU_RED)
            .setTitle(`✦ Role Info: ${role.name}`)
            .addFields(
                { name: 'ID', value: `\`${role.id}\``, inline: true },
                { name: 'Members', value: `${role.members.size}`, inline: true },
                { name: 'Hex', value: `\`${role.hexColor}\``, inline: true }
            )
            .setFooter(FOOTER_MAIN);
        return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'color') {
        const role = interaction.options.getRole('role');
        const hex = interaction.options.getString('hex');
        if (!role.editable) return interaction.reply({ content: "❌ I can't edit that role.", ephemeral: true });

        try {
            await role.setColor(hex);
            return interaction.reply({ content: `✅ Set ${role.name} color to \`${hex}\`.` });
        } catch (err) {
            return interaction.reply({ content: `❌ Invalid HEX code or permission error.`, ephemeral: true });
        }
    }

    if (subcommand === 'cancel') {
        return interaction.reply({ content: "✨ Role operation cancelled.", ephemeral: true });
    }
}