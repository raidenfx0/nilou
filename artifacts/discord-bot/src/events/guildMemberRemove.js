import { Events } from 'discord.js';

export const name = Events.GuildMemberRemove;
export const once = false;

export async function execute(member) {
    const { guild, user } = member;

    // This is useful for logging when someone leaves
    console.log(`✨ ${user.tag} has left ${guild.name}.`);

    // You can add logic here later for "Goodbye" messages 
    // or clearing user data if needed.
}