const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Use the ws package installed in backend
const WebSocket = require(path.join(__dirname, 'node_modules', 'ws'));

function readTokenFile(relPath) {
  const full = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(full)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(full, 'utf8'));
    return j.token || null;
  } catch (e) {
    return null;
  }
}

const tokenA = readTokenFile('login_resp.json') || readTokenFile('login_ui_resp.json');
const tokenB = readTokenFile('login_ui_resp.json') || readTokenFile('login_resp.json');

if (!tokenA || !tokenB) {
  console.error('Could not find both token files (login_resp.json, login_ui_resp.json) in project root.');
  process.exit(1);
}

const WS_URL = 'ws://localhost:5000';

function createClient(name, token) {
  const ws = new WebSocket(WS_URL);
  const client = { name, ws, token, sessionId: null, symbol: null, opponentId: null, board: Array(9).fill(null) };

  ws.on('open', () => {
    console.log(`${name}: connected`);
    ws.send(JSON.stringify({ type: 'authenticate', token }));
  });

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      console.log(`${name} <-`, data);
      handleMessage(client, data);
    } catch (e) {
      console.error(`${name}: invalid message`, msg.toString());
    }
  });

  ws.on('close', () => console.log(`${name}: closed`));
  ws.on('error', (err) => console.error(`${name}: error`, err));

  return client;
}

function handleMessage(client, data) {
  const ws = client.ws;
  switch (data.type) {
    case 'authenticated':
      // After auth, ask to find a match
      setTimeout(() => {
        console.log(`${client.name}: sending findMatch`);
        ws.send(JSON.stringify({ type: 'findMatch' }));
      }, 200);
      break;
    case 'searching':
      break;
    case 'matchFound':
      client.sessionId = data.sessionId;
      client.symbol = data.symbol;
      client.opponentId = data.opponentId;
      client.currentTurn = data.currentTurn;
      client.board = Array(9).fill(null);
      console.log(`${client.name}: matchFound symbol=${client.symbol} currentTurn=${client.currentTurn}`);
      if (client.currentTurn) playNextMove(client);
      break;
    case 'moveMade':
      client.board = data.board;
      client.currentTurn = (data.currentPlayer === client.opponentId) ? true : (data.currentPlayer !== client.opponentId && data.currentPlayer !== null ? false : client.currentTurn);
      // If it's now our turn (server tells currentPlayer), calculate
      if (data.currentPlayer && data.currentPlayer === getClientId(client)) {
        client.currentTurn = true;
      } else if (data.currentPlayer) {
        client.currentTurn = false;
      }
      // Small delay before playing
      setTimeout(() => { if (client.currentTurn) playNextMove(client); }, 300);
      break;
    case 'gameOver':
      client.board = data.board;
      console.log(`${client.name}: gameOver`, data);
      // Allow a moment then query DB
      setTimeout(() => queryDbForUsers(), 500);
      break;
    default:
      break;
  }
}

function playNextMove(client) {
  if (!client.sessionId) return;
  // choose first empty index
  const idx = client.board.findIndex(c => c === null);
  if (idx === -1) return;
  console.log(`${client.name}: making move at ${idx}`);
  client.ws.send(JSON.stringify({ type: 'makeMove', sessionId: client.sessionId, position: idx }));
  // optimistically mark
  client.board[idx] = client.symbol;
  client.currentTurn = false;
}

function getClientId(client) {
  // extract userId from token (JWT) without verification: base64 decode payload
  try {
    const parts = client.token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return payload.userId || payload.user_id || null;
  } catch (e) { return null; }
}

function queryDbForUsers() {
  // read both user ids from tokens
  const idA = getClientId({ token: tokenA });
  const idB = getClientId({ token: tokenB });
  if (!idA || !idB) {
    console.error('Could not parse user ids from tokens');
    process.exit(1);
  }
  const cmd = `"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe" -u root -pGdb_2023 -e "SELECT user_id,username,wins,losses,draws,coins FROM tictactoe_db.users WHERE user_id IN (${idA},${idB});"`;
  console.log('Querying DB:', cmd);
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error('mysql exec error', err, stderr);
      process.exit(0);
    }
    console.log('DB result:\n' + stdout);
    process.exit(0);
  });
}

// Create two clients
const client1 = createClient('PlayerA', tokenA);
const client2 = createClient('PlayerB', tokenB);

// Export nothing; script runs and exits after gameOver and DB query
