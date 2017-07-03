require('dotenv').config()

import { Permissions } from 'discord.js'

const authURL = "https://discordapp.com/api/oauth2/authorize"

let botPermissions = new Permissions(Permissions.FLAGS.ADMINISTRATOR)
let joinURL = `${authURL}?client_id=${process.env.OWNER}&scope=bot&permissions=${botPermissions.bitfield}`
console.log(`\nOpen ${joinURL} in your browser to add the bot to a channel you're an admin of.\n`)
