import { Message, TextChannel, GuildMember, User } from 'discord.js';
import { CommandoClient } from 'discord.js-commando';

const joinMessageRegex = /has joined/;
const usernameRegex = /@[^ ,.*]+/g;

export const postJoinMessage = async function (bot: CommandoClient, channel: TextChannel, member: GuildMember) {
  let lastMessage = await channel.fetchMessage(channel.lastMessageID);
  if (messageFromUser(bot.user, lastMessage) && isJoinedMessage(lastMessage)) {
    const users = parseJoinedUsers(lastMessage);
    let message;
    if (users.length > 1) {
      message = `*${users.shift()} has joined, along with ${users.join(", ")}, and @${member.displayName}*`;
    } else {
      message = `*${users.shift()} has joined, along with @${member.displayName}*`;
    }
    lastMessage.edit(message).catch(error => console.log(error));
  } else {
    channel.send(`*@${member.displayName} has joined*`).catch(error => console.log(error));
  }
}

const isJoinedMessage = function (message: Message): boolean {
  return joinMessageRegex.test(message.content);
}

const messageFromUser = function (user: User, message: Message): boolean {
  return message.author === user;
}

const parseJoinedUsers = function (message: Message): string[] {
  return message.content.match(usernameRegex);
}
