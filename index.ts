/// <reference path="./commando.d.ts"/>

require('dotenv').config()

import { Message, TextChannel, Guild, GuildMember, Role } from 'discord.js'
import { CommandoClient, Command, CommandMessage } from 'discord.js-commando'
import * as _ from 'lodash'
import * as Dice from './dice'
import { connect, GroupDatabase, AliasDatabase } from './db'
import { blacklisted, allChannels, detectGuild, mapToRoles } from './utils'
import { DiceCommands } from './diceCommands'
import { KingmakerData } from './kingmakerData'
import { formatBuilding } from './kingmakerUtils'

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
  .registerGroup('kingmaker', 'Kingmaker Specific Commands')
  .registerDefaults();

const diceCommands = new DiceCommands(bot)
diceCommands.setup()

const kingmakerData = new KingmakerData()

let buildingsCommand = new Command(bot, {
  name: 'buildings',
  group: 'kingmaker',
  memberName: 'buildings',
  description: 'Find buildings'
});
buildingsCommand.run = async (message: CommandMessage, args: string): Promise<any> => {
  kingmakerData.findBuildings(args)
    .then(buildings => buildings.map(building => building.name))
    .then(found => message.channel.send(`Found ${found.length} buildings: ${found.join(', ')}`))
    .catch(console.log);
}
bot.registry.registerCommand(buildingsCommand)

let buildingInfoCommand = new Command(bot, {
  name: 'info',
  group: 'kingmaker',
  memberName: 'info',
  description: 'Get info about a building'
});
buildingInfoCommand.run = async (message: CommandMessage, args: string): Promise<any> => {
  kingmakerData.buildingInfo(args)
    .then(building => {
      if (building) {
        message.channel.send(formatBuilding(building));
      } else {
        message.channel.send(`Sorry, I couldn't find a building called "${args}".`);
      }
    }).catch(console.log)
}
bot.registry.registerCommand(buildingInfoCommand)

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
