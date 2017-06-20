import { CommandMessage, CommandoClient } from 'discord.js-commando'
import { TextChannel, Message, Guild, GuildMember, Role, User } from 'discord.js';
import * as _ from 'lodash'
import { mapToChannels, blacklisted, cleanupChannelName, allChannels, mapToRoles, detectGuild } from './utils'
import { GroupDatabase, AliasDatabase } from './db'

export class ChannelManager {
  private readonly joinMessageRegex: RegExp = /has joined/;
  private readonly usernameRegex: RegExp = /@[^ ,.*]+/g;

  constructor(readonly bot: CommandoClient) {
  }

  parseChannelString(channelNames: string, guild: Guild): string[] {
    return channelNames.split(' ')
      .map(name => name.trim())
      .filter(name => name.length > 0)
      .map(name => cleanupChannelName(name, guild));
  }

  async join(channelNames: string[], member: GuildMember, guild: Guild) {
    const roles = mapToRoles(channelNames, guild)
      .filter(role => !member.roles.exists("name", role.name));

    if (roles.length == 0) {
      throw Error('No valid channels to join');
    }

    await member.addRoles(roles);

    roles.forEach((role) => {
      const channel = guild.channels.find(
        channel => channel.name == role.name && channel.type == 'text'
      ) as TextChannel;

      if (channel) {
        this.postJoinMessage(this.bot, channel, member)
      }
    })
  }

  async resolveNames(channelNames: string[], guild: Guild): Promise<string[]> {
    for (let i = 0; i < channelNames.length; i++) {
      const aliases = await AliasDatabase.find({ alias: channelNames[i] })
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

  async parseAndJoin(channelNamesString: string, member: GuildMember, guild: Guild) {
    const channelNames = this.parseChannelString(channelNamesString, guild);

    await this.join(await this.resolveNames(channelNames, guild), member, guild);
  }

  async postJoinMessage(bot: CommandoClient, channel: TextChannel, member: GuildMember) {
    let lastMessage;

    try {
      lastMessage = await channel.fetchMessage(channel.lastMessageID)
    } catch (error) { }

    if (lastMessage && this.messageFromUser(bot.user, lastMessage) && this.isJoinedMessage(lastMessage)) {

      const users = this.parseJoinedUsers(lastMessage);
      let message;
      if (users.length > 1) {
        message = `*${users.shift()} has joined, along with ${users.join(", ")}, and @${member.displayName}*`;
      } else {
        message = `*${users.shift()} has joined, along with @${member.displayName}*`;
      }
      lastMessage.edit(message).catch(console.log);
    } else {
      channel.send(`*@${member.displayName} has joined*`).catch(console.log);
    }
  }

  isJoinedMessage(message: Message): boolean {
    return this.joinMessageRegex.test(message.content);
  }

  messageFromUser(user: User, message: Message): boolean {
    return message.author === user;
  }

  parseJoinedUsers(message: Message): string[] {
    return message.content.match(this.usernameRegex);
  }

  createJoinCommand() {
    return async (message: CommandMessage, channelName: string): Promise<any> => {
      message.delete().catch(() => { });

      try {
        const guild = detectGuild(this.bot, message);
        const member = guild.members.find("id", message.author.id)
        await this.parseAndJoin(channelName, member, guild);

        if (message.channel.type == "dm") {
          return message.reply(`added you to #${channelName}`)
        } else {
          return undefined;
        }
      } catch (error) {
        return message.member.send(`"${message.cleanContent}" failed: ${error}.`) as any;
      }
    }
  }

  createLeaveCommand() {
    return async (message: CommandMessage, args: string): Promise<any> => {
      message.delete().catch(console.log);

      try {
        const guild = detectGuild(this.bot, message)
        let channels: TextChannel[] = [];
        let roles: Role[] = [];

        if (!args || args.length == 0) {
          args = (message.channel as TextChannel).name
        }

        const resolvedNames = (await this.resolveNames(this.parseChannelString(args, guild), guild))
          .filter(name => !_.includes(blacklisted, name.toLowerCase()))

        const member = guild.members.find("id", message.author.id)

        channels = mapToChannels(resolvedNames, guild)
          .filter(channel => member.roles.exists("name", channel.name))

        roles = mapToRoles(resolvedNames, guild)
          .filter(role => member.roles.exists("name", role.name))

        await member.removeRoles(roles);

        console.log("Leaving successful")
        return undefined;
      } catch (error) {
        console.log(error);

        return message.member.send(`Leave command failed: ${message.cleanContent}`) as any;
      }
    }
  }

  createInviteCommand() {
    return async (message: CommandMessage, argsString: string): Promise<any> => {
      message.delete().catch(console.log);

      try {
        let args = argsString.split(" ").map(part => part.trim()).filter(part => part.length > 0);
        let id = args[0].replace(/\D/g, '');
        let channelNames = args.slice(1);

        let guild = detectGuild(this.bot, message);

        if (!channelNames || channelNames.length == 0) {
          channelNames.push((message.channel as TextChannel).name)
        }

        let invitedMember = guild.members
          .find(member => member.id == id);

        if (!invitedMember) {
          let plainName = args[0].replace('@', '');
          invitedMember = guild.members
            .find(member => member.displayName.toLowerCase() == plainName.toLowerCase());
        }

        await this.parseAndJoin(channelNames.join(' '), invitedMember, guild);

        return undefined;
      } catch (error) {
        console.log(error);

        return message.member.send(`Invite command failed: ${message.cleanContent}`) as any;
      }
    }
  }
}
