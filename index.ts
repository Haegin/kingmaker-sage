/// <reference path="./commando.d.ts"/>

require('dotenv').config()

import { Message, TextChannel } from 'discord.js'
import { CommandoClient, Command, CommandMessage } from 'discord.js-commando'
import * as Dice from './dice'

let bot = new CommandoClient({
    owner: process.env.OWNER,
    commandPrefix: '/'
});

bot.login(process.env.TOKEN);

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
        let role = message.guild.roles.find('name', arg);

        await message.member.addRole(role);

        let channel = message.guild.channels
            .find(channel => channel.name == arg && channel.type == 'text') as TextChannel;

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

        let targetMember = message.guild.members
            .find(member => member.id == id);

        let role = message.guild.roles
            .find(role => role.name == channelName);

        let channel = message.guild.channels
            .find(channel => channel.name == channelName && channel.type == 'text') as TextChannel;

        await targetMember.addRole(role.id);

        return channel.send(`*@${targetMember.displayName} has joined*`) as any;
    } catch (error) {
        console.log(error);

        return message.reply(`failed command`) as any;
    }
}

bot.registry.registerCommand(inviteCommand);

let rollCommand = new Command(bot, {
    name: 'roll',
    group: 'play',
    memberName: 'roll',
    description: 'Rolls all the dice!'
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
            response = '@' + message.member.nickname + ' rolled **' + starWars.description + '**';

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
    console.log(`Logged in as ${bot.user.username}!`);
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