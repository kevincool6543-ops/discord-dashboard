require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const axios = require('axios');
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// ================
// PERMISSIONS DB
// ================
// Add your Discord user ID here as the default admin
const users = {
  '1468753725865594957': 'admin'
};

function getRole(userId) {
  return users[userId] || 'viewer';
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    const role = getRole(req.session.user.id);
    if (!roles.includes(role)) return res.status(403).json({ error: 'No permission' });
    next();
  };
}

// ================
// DISCORD BOT
// ================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
  ]
});

client.login(process.env.TOKEN);
client.once('ready', () => console.log(`✅ Bot logged in as ${client.user.tag}`));

// ================
// AUTH ROUTES
// ================
app.get('/auth/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds'
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
    });

    req.session.user = userRes.data;
    res.redirect(process.env.FRONTEND_URL);
  } catch (err) {
    console.error(err);
    res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
  }
});

app.get('/auth/me', (req, res) => {
  if (!req.session.user) return res.json({ loggedIn: false });
  const role = getRole(req.session.user.id);
  res.json({ loggedIn: true, user: req.session.user, role });
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ================
// STATS & MEMBERS
// ================
app.get('/stats', requireRole('admin', 'moderator', 'viewer'), async (req, res) => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const members = await guild.members.fetch();
  const online = members.filter(m => m.presence?.status === 'online').size;
  const bans = await guild.bans.fetch();
  res.json({ totalMembers: guild.memberCount, onlineMembers: online, totalBans: bans.size, serverName: guild.name });
});

app.get('/members', requireRole('admin', 'moderator', 'viewer'), async (req, res) => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const members = await guild.members.fetch();
  const list = members.map(m => ({
    id: m.user.id,
    username: m.user.tag,
    role: m.roles.highest.name,
    status: m.presence?.status || 'offline',
  }));
  res.json(list.slice(0, 20));
});

// ================
// MOD ACTIONS
// ================
app.post('/mod/mute', requireRole('admin', 'moderator'), async (req, res) => {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(req.body.userId);
    await member.timeout(60 * 60 * 1000, req.body.reason || 'Muted via dashboard');
    res.json({ success: true, message: `${member.user.tag} muted for 1 hour` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/mod/kick', requireRole('admin', 'moderator'), async (req, res) => {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(req.body.userId);
    await member.kick(req.body.reason || 'Kicked via dashboard');
    res.json({ success: true, message: `${member.user.tag} kicked` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/mod/ban', requireRole('admin'), async (req, res) => {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.members.ban(req.body.userId, { reason: req.body.reason || 'Banned via dashboard' });
    res.json({ success: true, message: `User banned` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================
// ADMIN: MANAGE USERS
// ================
app.get('/admin/users', requireRole('admin'), (req, res) => {
  res.json(users);
});

app.post('/admin/users', requireRole('admin'), (req, res) => {
  const { userId, role } = req.body;
  if (!['admin', 'moderator', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  users[userId] = role;
  res.json({ success: true, message: `User ${userId} set to ${role}` });
});

app.delete('/admin/users/:userId', requireRole('admin'), (req, res) => {
  delete users[req.params.userId];
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));