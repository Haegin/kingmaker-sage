/// <reference path="./commando.d.ts"/>

require('dotenv').config()

import { Message } from 'discord.js'
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

        return message.reply(`invited @${targetMember.displayName} to #${role.name}`) as any;
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