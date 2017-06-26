/// <reference path="./commando.d.ts"/>

require('dotenv').config()

import { Message, TextChannel, Guild, GuildMember, Role } from 'discord.js'
import { CommandoClient, Command, CommandMessage } from 'discord.js-commando'
import * as _ from 'lodash'
import * as Dice from './dice'
import { connect, GroupDatabase, AliasDatabase } from './db'
import { blacklisted, allChannels, detectGuild, mapToRoles } from './utils'
import { ChannelManager } from './channel_manager'

let bot = new CommandoClient({
    owner: process.env.OWNER,
    commandPrefix: '/',
    unknownCommandResponse: false
});

(async () => {
    await connect();
    bot.login(process.env.TOKEN);
})();

bot.registry
    .registerGroup('play', 'Play Commands')
    .registerGroup('channels', 'Channel Commands')
    .registerDefaults();

const channelManager = new ChannelManager(bot)

let joinCommand = new Command(bot, {
    name: 'join',
    group: 'channels',
    memberName: 'join',
    description: 'Join a channel.',
    aliases: ['j']
});

joinCommand.run = channelManager.createJoinCommand();

bot.registry.registerCommand(joinCommand);

let leaveCommand = new Command(bot, {
    name: 'leave',
    group: 'channels',
    memberName: 'leave',
    description: 'Leave a channel.',
    aliases: ['part']
});

leaveCommand.run = channelManager.createLeaveCommand();

bot.registry.registerCommand(leaveCommand);

let inviteCommand = new Command(bot, {
    name: 'invite',
    group: 'channels',
    memberName: 'invite',
    description: 'Invites another user to a channel.'
});

inviteCommand.run = channelManager.createInviteCommand();

bot.registry.registerCommand(inviteCommand);

let createCommand = new Command(bot, {
    name: 'create',
    group: 'channels',
    memberName: 'create',
    description: 'Creates a new channel.'
});

createCommand.run = async (message: CommandMessage, args: string): Promise<any> => {
    try {
        let name = args.trim().toLowerCase();
        let guild = detectGuild(bot, message);

        if (!/^[a-z0-9_]+$/.test(name)) {
            throw Error('Bad new channel name: ' + name);
        }

        if (await guild.roles.find("name", name)) {
            throw Error('Channel already exists: ' + name);
        }

        let role = await guild.createRole({ name });
        let channel = await guild.createChannel(name, "text", [{
            id: (await guild.roles.find("name", "@everyone")).id,
            type: "role",
            deny: 3072
        }, {
            id: role.id,
            type: "role",
            allow: 3072
        }]);

        let guildMember = guild.members.find("id", message.author.id)
        await guildMember.addRole(role);

        return message.reply(`#${args} has been created`) as any;
    } catch (error) {
        console.log(error);

        return message.member.send(`Command failed: ${message.cleanContent}`) as any;
    }
}

let topicCommand = new Command(bot, {
    name: 'topic',
    group: 'channels',
    memberName: 'topic',
    description: 'Set channel topic.'
});

topicCommand.run = async (message: CommandMessage, args: string): Promise<any> => {
    try {
        detectGuild(bot, message).channels.find('id', message.channel.id).setTopic(args);
        message.delete().catch(err => console.log(err))

        return message.reply(`set new channel topic`) as any;
    } catch (error) {
        console.log(error);

        return message.member.send(`Command failed: ${message.cleanContent}`) as any;
    }
}

bot.registry.registerCommand(topicCommand);

createCommand.hasPermission = (message: CommandMessage): boolean => {
    let guildMember = detectGuild(bot, message).members.find("id", message.author.id)
    return guildMember.roles.filter(role => role.name.toLocaleLowerCase() == process.env.MOD_ROLE.toLowerCase()).size > 0
}

bot.registry.registerCommand(createCommand);

let channelsCommand = new Command(bot, {
    name: 'channels',
    group: 'channels',
    memberName: 'channels',
    description: 'List all channels.',
    aliases: ['channel']
});

channelsCommand.run = async (message: CommandMessage, args: string): Promise<any> => {
    try {
        let response = "**Available Channels:**\n";

        let allRolls = allChannels(detectGuild(bot, message));
        let halfIndex = Math.ceil(allRolls.length / 2);
        let firstColumn = allRolls.slice(0, halfIndex);
        let secondColumn = allRolls.slice(halfIndex);

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

        message.author.sendMessage(response).catch(err => console.log(err))

        message.delete().catch(() => { });

        return undefined;
    } catch (error) {
        console.log(error);

        return message.member.send(`Command failed: ${message.cleanContent}`) as any;
    }
}

bot.registry.registerCommand(channelsCommand);

let roll = (args: string, member: GuildMember): { message: string, fields: { title: string, value: string }[] } => {
    var dice = new Dice(args);
    dice.execute();
    var result = dice.result();
    var rolls = dice.rolls.map((die) => die.result);

    let fields: { title: string, value: string }[] = []
    let message = '';

    if (dice.onlyStarWars()) {
        var starWars = dice.starWarsResult();
        message = '@' + member.displayName + ' rolled **' + starWars.description + '**';

        // If the comment exists, add it to the end of the response
        if (dice.comment.length > 0) {
            message = message.concat(' for ' + dice.comment.trim());
        }

        fields.push({
            title: 'Rolls',
            value: starWars.faces
        });
    } else if (dice.onlyGm()) {
        var gm = dice.gmResult();
        message = '@' + member.displayName + ' rolled **' + gm.description + '**';

        // If the comment exists, add it to the end of the response
        if (dice.comment.length > 0) {
            message = message.concat(' for ' + dice.comment.trim());
        }
    } else {
        message = '@' + member.displayName + ' rolled **' + result + '**';

        // If the comment exists, add it to the end of the response
        if (dice.comment.length > 0) {
            message = message.concat(' for ' + dice.comment.trim());
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

    return { message, fields }
}

let rollCommand = new Command(bot, {
    name: 'roll',
    group: 'play',
    memberName: 'roll',
    description: 'Rolls all the dice!'
});

rollCommand.run = async (message: CommandMessage, args: string): Promise<any> => {
    try {
        let member = detectGuild(bot, message).members.find("id", message.author.id)
        let result = roll(args, member);

        let response = result.message + '\n\n' + result.fields
            .map(field => '**' + field.title + '**\n' + field.value)
            .join('\n\n')

        return message.channel.send(response.trim());
    } catch (error) {
        console.log(error);

        return message.member.send(`Command failed: ${message.cleanContent}`) as any;
    }
}

bot.registry.registerCommand(rollCommand);

let rCommand = new Command(bot, {
    name: 'r',
    group: 'play',
    memberName: 'r',
    description: 'Rolls all the dice compactly!',
});

rCommand.run = async (message: CommandMessage, args: string): Promise<any> => {
    try {
        let member = detectGuild(bot, message).members.find("id", message.author.id)
        let result = roll(args, member);

        let response = result.message + ', ' + result.fields
            .map(field => '**' + field.title + '** ' + field.value)
            .join(', ')

        return message.channel.send(response.trim());
    } catch (error) {
        console.log(error);

        return message.member.send(`Command failed: ${message.cleanContent}`) as any;
    }
}

bot.registry.registerCommand(rCommand);

let rollQuietCommand = new Command(bot, {
    name: 'rollquiet',
    group: 'play',
    memberName: 'rollquiet',
    description: 'Rolls all the dice quietly!',
    aliases: ['rq']
});

rollQuietCommand.run = async (message: CommandMessage, args: string): Promise<any> => {
    message.delete().catch(err => console.log(err))

    try {
        let member = detectGuild(bot, message).members.find("id", message.author.id)
        let result = roll(args, member);

        let response = result.message.replace(/\*/g, '') + ', ' + result.fields
            .map(field => field.title + ': ' + field.value)
            .join(', ')

        return member.send(response.trim());
    } catch (error) {
        console.log(error);

        return message.member.send(`Command failed: ${message.cleanContent}`) as any;
    }
}

bot.registry.registerCommand(rollQuietCommand);

bot.on('ready', () => {
    console.log('Running');
    bot.guilds.forEach(guild => guild.member(bot.user).setNickname('Robot').catch(() => { }));
    bot.user.setPresence({
        status: "online",
        game: { name: "/help and /channels" }
    })
});

bot.on('guildMemberAdd', async (member) => {
    let defaultRoleNames = (process.env.DEFAULT || '')
        .split(',')
        .filter(name => name)
        .map(name => name.trim())
        .filter(name => name.length > 0)

    try {
        let defaultRoles = defaultRoleNames
            .map(name => member.guild.roles.find('name', name))
            .filter(role => role)

        member.addRoles(defaultRoles).catch(err => console.log(err));
    } catch (error) { }

    try {
        member.sendMessage(`Thanks for joining **${member.guild.name}**.\n\n` +
            `There are many more channels beyond the ${defaultRoleNames.length + 1} default ones. ` +
            `There are **${allChannels(member.guild).length}** in total!\n\n` +
            `Discover them all by entering the **/channels** command here.`)
            .catch(err => console.log(err))
    } catch (error) { }

    try {
        let introductionsChannel = member.guild.channels.find(channel => channel.name == 'introductions' && channel.type == 'text') as TextChannel;
        await introductionsChannel.send(`*@${member.displayName} has joined*`) as any;
    } catch (error) { }
});
