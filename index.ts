/// <reference path="./commando.d.ts"/>

require('dotenv').config()

import { Message } from 'discord.js'
import { CommandoClient, Command, CommandMessage } from 'discord.js-commando'

let bot = new CommandoClient({
    owner: process.env.OWNER,
    commandPrefix: '/'
});

bot.login(process.env.TOKEN);

bot.registry
    .registerGroup('channels', 'Channel Commands')
    .registerDefaults();

let joinCommand = new Command(bot, {
    name: 'join',
    group: 'channels',
    memberName: 'join',
    description: 'Join a channel'
});

joinCommand.run = async (message: CommandMessage, arg: string): Promise<any> => {
    try {
        let role = bot.guilds
            .find(guild => guild.id == message.member.guild.id).roles
            .find(role => role.name == arg.trim());

        await message.member.addRole(role.id);

        return message.reply(`joined you to #${role.name}`) as any;
    } catch (error) {
        console.log(error);

        return message.reply(`failed command`) as any;
    }
}

bot.registry.registerCommand(joinCommand);

let leaveCommand = new Command(bot, {
    name: 'leave',
    group: 'channels',
    memberName: 'leave',
    description: 'Leave a channel'
});

leaveCommand.run = async (message: CommandMessage, arg: string): Promise<any> => {
    try {
        let channel = bot.guilds
            .find(guild => guild.id == message.member.guild.id).channels
            .find(channel => channel.id == message.channel.id);

        let role = bot.guilds
            .find(guild => guild.id == message.member.guild.id).roles
            .find(role => role.name == channel.name);

        await message.member.removeRole(role.id);

        return message.reply(`has left`) as any;
    } catch (error) {
        console.log(error);

        return message.reply(`failed command`) as any;
    }
}

bot.registry.registerCommand(leaveCommand);

let inviteCommand = new Command(bot, {
    name: 'invite',
    group: 'channels',
    memberName: 'invite',
    description: 'Invites another user to a channel.'
});

inviteCommand.run = async (message: CommandMessage, args: string): Promise<any> => {
    try {
        let [id, channel] = args.split(" ").map(part => part.trim()).filter(part => part.length > 0)
        id = id.replace(/\D/g, '');

        let targetMember = bot.guilds
            .find(guild => guild.id == message.member.guild.id).members
            .find(member => member.id == id);

        let role = bot.guilds
            .find(guild => guild.id == message.member.guild.id).roles
            .find(role => role.name == channel);

        await targetMember.addRole(role.id);

        return message.reply(`Invited @${targetMember.displayName} to #${role.name}`) as any;
    } catch (error) {
        console.log(error);

        return message.reply(`failed command`) as any;
    }
}

bot.registry.registerCommand(inviteCommand);

bot.on('message', msg => {
    if (msg.content === 'ping') {
        msg.reply('Pong!');
    }
});

bot.on('ready', () => {
    console.log(`Logged in as ${bot.user.username}!`);
});