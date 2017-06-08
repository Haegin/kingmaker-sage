# RPG Talk Discord Bot

This is the code for the RPG Talk Discord bot.


## Requirements

* Docker
* Node
* Yarn


## Configuration

1. Create a Discord app at https://discordapp.com/developers/applications/me
2. Add a bot to it
3. `cp .env.sample .env`
4. Edit the first two parameters in `.env` to match the Client ID and Bot Token from the Discord
   developer console


## First Time Setup

1. Run `yarn` to install necessary dependencies
2. Add the bot to the guild you are using for testing (you need to be an admin on the guild):
  a. Run `yarn oauth` to get the authorization URL for your bot
  b. Open the URL in your browser
  c. Select the guild (server) you wish to add the bot to


## Running it

1. Run `docker-compose up -d` to start Mongo
2. Run `yarn start` to start the bot
