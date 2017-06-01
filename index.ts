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

let inviteCommand = new Command(bot, {
    name: 'invite',
    group: 'channels',
    memberName: 'invite',
    description: 'Invites another user to a channel.'
});

inviteCommand.run = async (message: CommandMessage, args): Promise<any> => {
    return message.reply('Custom command ran') as any;
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