/// <reference path="./commando.d.ts"/>

require('dotenv').config()

import { Message, TextChannel, Guild } from 'discord.js'
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

let detectGuild = (message: CommandMessage): Guild => {
    if (message.guild) {
        return message.guild;
    } else {
        return bot.guilds.first();
    }
}

let cleanupChannelName = (channelName: string, guild: Guild): string => {
    if (channelName.includes('<#')) {
        channelName = channelName.substr(2)
        channelName = channelName.substr(0, channelName.length - 1)
        return guild.channels.find('id', channelName).name;
    } else if (channelName.startsWith('#')) {
        return channelName.substr(1);
    } else {
        return channelName;
    }
}

joinCommand.run = async (message: CommandMessage, channelName: string): Promise<any> => {
    try {
        channelName = cleanupChannelName(channelName, detectGuild(message));

        let role = detectGuild(message).roles.find('name', channelName);
        if (_.includes(blacklistedChannels, role.name.toLowerCase())) {
            throw Error('Blacklisted channel: ' + role.name);
        }

        let guildMember = detectGuild(message).members.find("id", message.author.id)
        await guildMember.addRole(role);

        let channel = detectGuild(message).channels
            .find(channel => channel.name == channelName && channel.type == 'text') as TextChannel;

        message.delete().catch(() => { });
        if (message.channel.type == "dm") {
            message.reply(`added you to #${channelName}`)
        }

        return channel.send(`*@${guildMember.displayName} has joined*`) as any;
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
        let channel = detectGuild(message).channels
            .find(channel => channel.id == message.channel.id);

        let role = detectGuild(message).roles
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
        } else {
            channelName = cleanupChannelName(channelName, detectGuild(message));
        }

        let targetMember = detectGuild(message).members
            .find(member => member.id == id);

        let role = detectGuild(message).roles
            .find(role => role.name == channelName);

        if (_.includes(blacklistedChannels, role.name.toLowerCase())) {
            throw Error('Blacklisted channel: ' + role.name);
        }

        let channel = detectGuild(message).channels
            .find(channel => channel.name == channelName && channel.type == 'text') as TextChannel;

        await targetMember.addRole(role.id);

        message.delete().catch(() => { });

        if (message.channel.type == "dm") {
            message.reply(`added @${targetMember.displayName} to #${channelName}`)
        }

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

        let role = await detectGuild(message).createRole({ name });
        let channel = await detectGuild(message).createChannel(name, "text", [{
            id: (await detectGuild(message).roles.find("name", "@everyone")).id,
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
    let guildMember = detectGuild(message).members.find("id", message.author.id)
    return guildMember.roles.filter(role => role.name.toLocaleLowerCase() == process.env.MOD_ROLE.toLowerCase()).size > 0
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
        let channels = detectGuild(message).channels
            .filter(channel => channel.type == 'text')
            .filter(channel => !_.includes(blacklistedChannels, channel.name.toLowerCase()))
            .map(channel => channel.name);

        let roles = detectGuild(message).roles
            .filter(role => !_.includes(blacklistedChannels, role.name.toLowerCase()))
            .map(role => role.name)
            .filter(role => _.includes(channels, role))
            .sort();

        message.delete().catch(() => { });

        let response = "**Available Channels:**\n";

        let halfIndex = Math.ceil(roles.length / 2);
        let firstColumn = roles.slice(0, halfIndex);
        let secondColumn = roles.slice(halfIndex);

        let firstColumnWidth = 0;
        firstColumn.forEach(role => {
            if (role.length > firstColumnWidth) {
                firstColumnWidth = role.length;
            }
        })
        firstColumnWidth += 3;

        response += '```\n';
        _.range(firstColumn.length).forEach(i => {
            response += firstColumn[i];
            response += _.range(firstColumnWidth - firstColumn[i].length).map(i => ' ').join('');
            response += secondColumn[i] ? secondColumn[i] : ''
            response += '\n'
        })
        response += '```\n';

        response += 'Type "/join *channel_name*" to join a channel.'

        return message.author.sendMessage(response) as any;
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

        let guildMember = detectGuild(message).members.find("id", message.author.id)

        if (dice.onlyStarWars()) {
            var starWars = dice.starWarsResult();
            response = '@' + guildMember.displayName + ' rolled **' + starWars.description + '**';

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
            response = '@' + guildMember.displayName + ' rolled **' + gm.description + '**';

            // If the comment exists, add it to the end of the response
            if (dice.comment.length > 0) {
                response = response.concat(' for ' + dice.comment.trim());
            }
        } else {
            response = '@' + guildMember.displayName + ' rolled **' + result + '**';

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