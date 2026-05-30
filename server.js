require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
app.use(cors());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ]
});

client.login(process.env.TOKEN);

client.once('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
});

// Get server stats
app.get('/stats', async (req, res) => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const members = await guild.members.fetch();
  const online = members.filter(m => m.presence?.status === 'online').size;
  const bans = await guild.bans.fetch();

  res.json({
    totalMembers: guild.memberCount,
    onlineMembers: online,
    totalBans: bans.size,
    serverName: guild.name,
  });
});

// Get member list
app.get('/members', async (req, res) => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const members = await guild.members.fetch();

  const list = members.map(m => ({
    username: m.user.tag,
    role: m.roles.highest.name,
    status: m.presence?.status || 'offline',
  }));

  res.json(list.slice(0, 20)); // Return first 20
});

app.listen(3000, () => console.log('🚀 Server running on http://localhost:3000'));