async function loadStats() {
  const res = await fetch('https://discord-dashboard-production-92c4.up.railway.app/stats');
  const data = await res.json();

  document.querySelector('.cards').innerHTML = `
    <div class="card">👥 <strong>${data.totalMembers}</strong><span>Members</span></div>
    <div class="card">🟢 <strong>${data.onlineMembers}</strong><span>Online</span></div>
    <div class="card">🚫 <strong>${data.totalBans}</strong><span>Total Bans</span></div>
    <div class="card">🏠 <strong>${data.serverName}</strong><span>Server</span></div>
  `;
}

async function loadMembers() {
  const res = await fetch('https://discord-dashboard-production-92c4.up.railway.app/members');
  const members = await res.json();

  const rows = members.map(m => `
    <tr>
      <td>${m.username}</td>
      <td>${m.role}</td>
      <td class="${m.status === 'online' ? 'online' : 'offline'}">${m.status}</td>
    </tr>
  `).join('');

  document.querySelector('tbody').innerHTML = rows;
}

function sendCommand(command) {
  const output = document.getElementById('bot-output');
  output.textContent = `✅ Command "${command}" sent to bot!`;
  setTimeout(() => output.textContent = '', 3000);
}

loadStats();
loadMembers();