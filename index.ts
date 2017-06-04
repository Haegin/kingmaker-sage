/// <reference path="./commando.d.ts"/>

require('dotenv').config()

import { Message, TextChannel, Guild, GuildMember, Role } from 'discord.js'
import { CommandoClient, Command, CommandMessage } from 'discord.js-commando'
import * as _ from 'lodash'
import * as Dice from './dice'
import { connect, GroupDatabase, AliasDatabase } from './db'

let bot = new CommandoClient({
    owner: process.env.OWNER,
    commandPrefix: '/'
});

(async () => {
    await connect();
    bot.login(process.env.TOKEN);
})();

let blacklisted = (process.env.BLACKLIST || '')
    .split(',')
    .map(channel => channel.trim())
    .map(channel => channel.toLowerCase())
    .filter(channel => channel.length > 0);

bot.registry
    .registerGroup('play', 'Play Commands')
    .registerGroup('channels', 'Channel Commands')
    .registerDefaults();

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

let mapToRoles = (channelNames: string[], guild: Guild): Role[] => {
    return channelNames
        .map(name => guild.roles.find('name', name))
        .filter(role => role)
        .filter(role => !_.includes(blacklisted, role.name.toLowerCase()));
}

let mapToChannels = (channelNames: string[], guild: Guild): TextChannel[] => {
    return channelNames
        .map(name => guild.channels.find('name', name))
        .filter(channel => channel)
        .filter(channel => !_.includes(blacklisted, channel.name.toLowerCase())) as TextChannel[];
}

let parseChannelString = (channelNames: string, guild: Guild): string[] => {
    return channelNames.split(' ')
        .map(name => name.trim())
        .filter(name => name.length > 0)
        .map(name => cleanupChannelName(name, guild))
}

let join = async (channelNames: string[], member: GuildMember, guild: Guild) => {
    let roles = mapToRoles(channelNames, guild)
        .filter(role => !member.roles.exists("name", role.name));

    await member.addRoles(roles);

    for (let i = 0; i < roles.length; i++) {
        let channel = guild.channels.find(channel =>
            channel.name == roles[i].name &&
            channel.type == 'text') as TextChannel;

        if (channel) {
            channel.send(`*@${member.displayName} has joined*`).catch(error => console.log(error));
        }
    }
}

let resolveNames = async (channelNames: string[], guild: Guild): Promise<string[]> => {
    for (let i = 0; i < channelNames.length; i++) {
        let aliases = await AliasDatabase.find({ alias: channelNames[i] })
        if (aliases.length > 0) {
            channelNames[i] = aliases[0].real
        }
    }

    let mappedNames = []
    for (let i = 0; i < channelNames.length; i++) {
        if (channelNames[i] == "all") {
            mappedNames = mappedNames.concat(allChannels(guild));
        } else {
            let groupsChannels = await GroupDatabase.find({ name: channelNames[i] })
            if (groupsChannels.length > 0) {
                mappedNames = mappedNames.concat(groupsChannels[0].channels);
            } else {
                mappedNames.push(channelNames[i]);
            }
        }
    }

    return _.uniq(mappedNames);
}

let parseAndJoin = async (channelNamesString: string, member: GuildMember, guild: Guild) => {
    let channelNames = parseChannelString(channelNamesString, guild);

    await join(await resolveNames(channelNames, guild), member, guild);
}

let allChannels = (guild: Guild): string[] => {
    let channels = guild.channels
        .filter(channel => channel.type == 'text')
        .filter(channel => !_.includes(blacklisted, channel.name.toLowerCase()))
        .map(channel => channel.name);

    return guild.roles
        .filter(role => !_.includes(blacklisted, role.name.toLowerCase()))
        .map(role => role.name)
        .filter(role => _.includes(channels, role))
        .sort();
}

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

joinCommand.run = async (message: CommandMessage, channelName: string): Promise<any> => {
    try {
        let guild = detectGuild(message);
        let member = guild.members.find("id", message.author.id)
        await parseAndJoin(channelName, member, guild);

        message.delete().catch(() => { });
        if (message.channel.type == "dm") {
            return message.reply(`added you to #${channelName}`)
        } else {
            return undefined;
        }
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

leaveCommand.run = async (message: CommandMessage, args: string): Promise<any> => {
    try {
        let guild = detectGuild(message)
        let channels: TextChannel[] = [];
        let roles: Role[] = [];

        if (!args || args.length == 0) {
            args = (message.channel as TextChannel).name
        }

        let resolvedNames = (await resolveNames(parseChannelString(args, guild), guild))
            .filter(name => !_.includes(blacklisted, name.toLowerCase()))

        channels = mapToChannels(resolvedNames, guild)
            .filter(channel => message.member.roles.exists("name", channel.name))

        roles = mapToRoles(resolvedNames, guild)
            .filter(role => message.member.roles.exists("name", role.name))

        await message.member.removeRoles(roles);

        let member = guild.members.find("id", message.author.id);
        channels.forEach(channel =>
            channel.send(`*@${member.displayName} has left*`).catch(err => console.log(err)))

        message.delete().catch(err => console.log(err));

        return undefined;
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

inviteCommand.run = async (message: CommandMessage, argsString: string): Promise<any> => {
    try {
        let args = argsString.split(" ").map(part => part.trim()).filter(part => part.length > 0);
        let id = args[0].replace(/\D/g, '');
        let channelNames = args.slice(1);

        let guild = detectGuild(message);

        if (!channelNames || channelNames.length == 0) {
            channelNames.push((message.channel as TextChannel).name)
        }

        let invitedMember = guild.members
            .find(member => member.id == id);

        await parseAndJoin(channelNames.join(' '), invitedMember, guild);

        message.delete().catch(() => { });

        return undefined;
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
        let name = args.trim().toLowerCase();
        let guild = detectGuild(message);

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
        message.delete().catch(() => { });

        let response = "**Available Channels:**\n";

        let allRolls = allChannels(detectGuild(message));
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

        return message.reply('Sent you a DM with channel list.')
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
    bot.user.setPresence({
        status: "online",
        game: { name: "/help and /channels" }
    })
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