import { Command, CommandMessage, CommandoClient } from 'discord.js-commando'
import { TextChannel, Message, Guild, GuildMember, Role, User } from 'discord.js';
import * as _ from 'lodash'
import { mapToChannels, blacklisted, cleanupChannelName, allChannels, mapToRoles, detectGuild } from './utils'
import { GroupDatabase, AliasDatabase } from './db'
import * as Dice from './dice'

export class DiceCommands {

  constructor(readonly bot: CommandoClient) {
  }

  setup() {
    let rollCommand = new Command(this.bot, {
        name: 'roll',
        group: 'play',
        memberName: 'roll',
        description: 'Rolls all the dice!'
    });
    rollCommand.run = this.createRollCommand()
    this.bot.registry.registerCommand(rollCommand);

    let rCommand = new Command(this.bot, {
        name: 'r',
        group: 'play',
        memberName: 'r',
        description: 'Rolls all the dice compactly!',
    });
    rCommand.run = this.createCompactRollCommand();
    this.bot.registry.registerCommand(rCommand);

    let rollQuietCommand = new Command(this.bot, {
        name: 'rollquiet',
        group: 'play',
        memberName: 'rollquiet',
        description: 'Rolls all the dice quietly!',
        aliases: ['rq']
    });
    rollQuietCommand.run = this.createQuietRollCommand()
    this.bot.registry.registerCommand(rollQuietCommand);
  }

  createRollCommand() {
    return async (message: CommandMessage, args: string): Promise<any> => {
      try {
        let member = detectGuild(this.bot, message).members.find("id", message.author.id)
        let result = this.rollDice(args, member);

        let response = result.message + '\n\n' + result.fields
          .map(field => '**' + field.title + '**\n' + field.value)
          .join('\n\n')

        return message.channel.send(response.trim());
      } catch (error) {
        console.log(error);

        return message.member.send(`Command failed: ${message.cleanContent}`) as any;
      }
    }
  }

  createCompactRollCommand() {
    return async (message: CommandMessage, args: string): Promise<any> => {
      try {
        let member = detectGuild(this.bot, message).members.find("id", message.author.id)
        let result = this.rollDice(args, member);

        let response = result.message + ', ' + result.fields
          .map(field => '**' + field.title + '** ' + field.value)
          .join(', ')

        return message.channel.send(response.trim());
      } catch (error) {
        console.log(error);

        return message.member.send(`Command failed: ${message.cleanContent}`) as any;
      }
    }
  }

  createQuietRollCommand() {
    return async (message: CommandMessage, args: string): Promise<any> => {
      message.delete().catch(err => console.log(err))

      try {
        let member = detectGuild(this.bot, message).members.find("id", message.author.id)
        let result = this.rollDice(args, member);

        let response = result.message.replace(/\*/g, '') + ', ' + result.fields
          .map(field => field.title + ': ' + field.value)
          .join(', ')

        return member.send(response.trim());
      } catch (error) {
        console.log(error);

        return message.member.send(`Command failed: ${message.cleanContent}`) as any;
      }
    }
  }

  rollDice(args: string, member: GuildMember): { message: string, fields: { title: string, value: string }[] } {
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
}
