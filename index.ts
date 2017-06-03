/// <reference path="./commando.d.ts"/>

require('dotenv').config()

import { Message, TextChannel } from 'discord.js'
import { CommandoClient, Command, CommandMessage } from 'discord.js-commando'
import * as _ from 'lodash'
import * as Dice from './dice'

let bot = new CommandoClient({
    owner: process.env.OWNER,
    commandPrefix: '/'
});

bot.login(process.env.TOKEN);

let blacklistedChannels = (process.env.BLACKLIST || '')
    .split(',')
    .map(channel => channel.trim())
    .map(channel => channel.toLowerCase())
    .filter(channel => channel.length > 0);

bot.registry
    .registerGroup('play', 'Play Commands')
    .registerGroup('channels', 'Channel Commands')
    .registerDefaults();

let joinCommand = new Command(bot, {
    name: 'join',
    group: 'channels',
    memberName: 'join',
    description: 'Join a channel.'
});

joinCommand.run = async (message: CommandMessage, arg: string): Promise<any> => {
    try {
        if (arg.includes('<#')) {
            arg = arg.substr(2)
            arg = arg.substr(0, arg.length - 1)
            arg = message.guild.channels.find('id', arg).name;
        }

        let role = message.guild.roles.find('name', arg);
        if (_.includes(blacklistedChannels, role.name.toLowerCase())) {
            throw Error('Blacklisted channel: ' + role.name);
        }

        await message.member.addRole(role);

        let channel = message.guild.channels
            .find(channel => channel.name == arg && channel.type == 'text') as TextChannel;

        message.delete().catch(() => { });

        return channel.send(`*@${message.member.displayName} has joined*`) as any;
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
    description: 'Leave a channel.'
});

leaveCommand.run = async (message: CommandMessage, arg: string): Promise<any> => {
    try {
        let channel = message.guild.channels
            .find(channel => channel.id == message.channel.id);

        let role = message.guild.roles
            .find(role => role.name == channel.name);

        await message.member.removeRole(role.id);

        message.delete().catch(() => { });

        return message.channel.send(`*@${message.member.displayName} has left*`) as any;
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
        let [id, channelName] = args.split(" ").map(part => part.trim()).filter(part => part.length > 0)
        id = id.replace(/\D/g, '');

        if (!channelName || channelName.length == 0) {
            channelName = (message.channel as TextChannel).name
        } else if (channelName.includes('<#')) {
            channelName = channelName.substr(2)
            channelName = channelName.substr(0, channelName.length - 1)
            channelName = message.guild.channels.find('id', channelName).name;
        }

        let targetMember = message.guild.members
            .find(member => member.id == id);

        let role = message.guild.roles
            .find(role => role.name == channelName);

        if (_.includes(blacklistedChannels, role.name)) {
            throw Error('Blacklisted channel: ' + role.name);
        }

        let channel = message.guild.channels
            .find(channel => channel.name == channelName && channel.type == 'text') as TextChannel;

        await targetMember.addRole(role.id);

        message.delete().catch(() => { });

        return channel.send(`*@${targetMember.displayName} has joined*`) as any;
    } catch (error) {
        console.log(error);

        return message.reply(`failed command`) as any;
    }
}

bot.registry.registerCommand(inviteCommand);

let createCommand = new Command(bot, {
    name: 'create',
    group: 'channels',
    memberName: 'create',
    description: 'Creates a new channel.'
});

createCommand.run = async (message: CommandMessage, args: string): Promise<any> => {
    try {
        let name = args.trim();

        let role = await message.guild.createRole({ name });
        let channel = await message.guild.createChannel(name, "text", [{
            id: (await message.guild.roles.find("name", "@everyone")).id,
            type: "role",
            deny: 3072
        }, {
            id: role.id,
            type: "role",
            allow: 3072
        }]);

        message.member.addRole(role.id);

        return message.reply(`#${args} has been created`) as any;
    } catch (error) {
        console.log(error);

        return message.reply(`failed command`) as any;
    }
}

createCommand.hasPermission = (message: CommandMessage): boolean => {
    return message.member.roles.filter(role => role.name.toLocaleLowerCase() == "moderator").size > 0
}

bot.registry.registerCommand(createCommand);

let channelsCommand = new Command(bot, {
    name: 'channels',
    group: 'channels',
    memberName: 'channels',
    description: 'List all channels.'
});

channelsCommand.run = async (message: CommandMessage, args: string): Promise<any> => {
    try {
        let channels = message.guild.channels
            .filter(channel => channel.type == 'text')
            .filter(channel => !_.includes(blacklistedChannels, channel.name))
            .map(channel => channel.name);

        let roles = message.guild.roles
            .filter(role => !_.includes(blacklistedChannels, role.name))
            .map(role => role.name)
            .filter(role => _.includes(channels, role))
            .sort();

        message.delete().catch(() => { });

        let response = "**Available Channels:**\n";
        response += roles.join('\n');

        return message.member.sendMessage(response) as any;
    } catch (error) {
        console.log(error);

        return message.reply(`failed command`) as any;
    }
}

bot.registry.registerCommand(channelsCommand);

let rollCommand = new Command(bot, {
    name: 'roll',
    group: 'play',
    memberName: 'roll',
    description: 'Rolls all the dice!',
    aliases: ['r']
});

rollCommand.run = async (message: CommandMessage, args: string): Promise<any> => {
    try {
        var dice = new Dice(args);
        dice.execute();
        var result = dice.result();
        var rolls = dice.rolls.map((die) => die.result);

        let fields: { title: string, value: string }[] = []
        let response = '';

        if (dice.onlyStarWars()) {
            var starWars = dice.starWarsResult();
            response = '@' + message.member.displayName + ' rolled **' + starWars.description + '**';

            // If the comment exists, add it to the end of the response
            if (dice.comment.length > 0) {
                response = response.concat(' for ' + dice.comment.trim());
            }

            fields.push({
                title: 'Rolls',
                value: starWars.faces
            });
        } else if (dice.onlyGm()) {
            var gm = dice.gmResult();
            response = '@' + message.member.displayName + ' rolled **' + gm.description + '**';

            // If the comment exists, add it to the end of the response
            if (dice.comment.length > 0) {
                response = response.concat(' for ' + dice.comment.trim());
            }
        } else {
            response = '@' + message.member.displayName + ' rolled **' + result + '**';

            // If the comment exists, add it to the end of the response
            if (dice.comment.length > 0) {
                response = response.concat(' for ' + dice.comment.trim());
            }

            fields.push({
                title: 'Dice',
                value: dice.command
            });

            fields.push({
                title: 'Rolls',
                value: rolls.join(' ')
            });

            if (dice.kept.length > 0) {
                fields.push({
                    title: 'Kept: ' + dice.kept.length,
                    value: dice.kept.join(' ')
                });
            }
        }

        response += '\n\n'

        fields.forEach(field => {
            response += '**' + field.title + '**\n' + field.value + '\n\n'
        })

        response = response.trim();

        return message.channel.send(response);
    } catch (error) {
        console.log(error);

        return message.reply(`failed command`) as any;
    }
}

bot.registry.registerCommand(rollCommand);

bot.on('message', msg => {
    if (msg.content === 'ping') {
        msg.reply('Pong!');
    }
});

bot.on('ready', () => {
    console.log('Running');
    bot.guilds.forEach(guild => guild.member(bot.user).setNickname('Robot').catch(() => { }));
});

bot.on('guildMemberAdd', async (member) => {
    try {
        let generalChannel = member.guild.defaultChannel;
        await generalChannel.send(`*@${member.displayName} has joined*`) as any;
    } catch (error) {

    }

    try {
        let introductionsChannel = member.guild.channels.find(channel => channel.name == 'introductions' && channel.type == 'text') as TextChannel;
        await introductionsChannel.send(`*@${member.displayName} has joined*`) as any;
    } catch (error) {

    }
});