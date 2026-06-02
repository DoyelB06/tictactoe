const path = require('path');
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const cors = require('cors');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Gdb_2023',
  database: process.env.DB_NAME || 'tictactoe_db',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0
});

// WebSocket connections storage
const clients = new Map();
const matchmakingQueue = [];
const activeSessions = new Map();

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// User Registration
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user exists
    const [existing] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, coins) VALUES (?, ?, ?, 1000)',
      [username, email, hashedPassword]
    );

    res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = ?', [user.user_id]);

    const token = jwt.sign({ userId: user.user_id, username: user.username }, JWT_SECRET);
    
    res.json({ 
      token, 
      user: { 
        userId: user.user_id, 
        username: user.username, 
        coins: user.coins,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws
      } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get User Profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT user_id, username, email, coins, wins, losses, draws FROM users WHERE user_id = ?', [req.user.userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get Leaderboard
app.get('/api/leaderboard', authenticateToken, async (req, res) => {
  try {
    const [leaderboard] = await pool.query(
      'SELECT username, wins, losses, draws, (wins * 3 + draws) as score FROM users ORDER BY score DESC LIMIT 10'
    );
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get Achievements
app.get('/api/achievements', authenticateToken, async (req, res) => {
  try {
    const [achievements] = await pool.query(
      `SELECT a.*, ua.unlocked_at 
       FROM achievements a 
       LEFT JOIN user_achievements ua ON a.achievement_id = ua.achievement_id AND ua.user_id = ?
       ORDER BY a.achievement_id`,
      [req.user.userId]
    );
    res.json(achievements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Get Store Items
app.get('/api/store', authenticateToken, async (req, res) => {
  try {
    const [items] = await pool.query('SELECT * FROM store_items WHERE available = 1');
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch store items' });
  }
});

// Purchase Store Item
app.post('/api/store/purchase', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { itemId } = req.body;
    
    // Get item details
    const [items] = await connection.query('SELECT * FROM store_items WHERE item_id = ?', [itemId]);
    if (items.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const item = items[0];
    
    // Check user coins
    const [users] = await connection.query('SELECT coins FROM users WHERE user_id = ?', [req.user.userId]);
    if (users[0].coins < item.price) {
      await connection.rollback();
      return res.status(400).json({ error: 'Insufficient coins' });
    }
    
    // Deduct coins
    await connection.query('UPDATE users SET coins = coins - ? WHERE user_id = ?', [item.price, req.user.userId]);
    
    // Add purchase record
    await connection.query('INSERT INTO user_purchases (user_id, item_id) VALUES (?, ?)', [req.user.userId, itemId]);
    
    await connection.commit();
    res.json({ message: 'Purchase successful', newBalance: users[0].coins - item.price });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Purchase failed' });
  } finally {
    connection.release();
  }
});

// WebSocket handling
wss.on('connection', (ws) => {
  let userId = null;
  
  ws.on('message', async (message) => {
    const data = JSON.parse(message);
    
    switch (data.type) {
      case 'authenticate':
        try {
          const decoded = jwt.verify(data.token, JWT_SECRET);
          // Normalize server-side userId to string for consistent object keys
          userId = String(decoded.userId);
          clients.set(userId, ws);
          // Send numeric userId back to client for client-side comparisons
          ws.send(JSON.stringify({ type: 'authenticated', userId: Number(userId) }));
        } catch (error) {
          ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
        }
        break;
        
      case 'findMatch':
        if (userId) {
          matchmakingQueue.push({ userId, ws });
          
          if (matchmakingQueue.length >= 2) {
            const player1 = matchmakingQueue.shift();
            const player2 = matchmakingQueue.shift();
            
            const sessionId = `session_${Date.now()}`;
            const gameState = {
              board: Array(9).fill(null),
              // store currentPlayer as a string (object keys are strings)
              currentPlayer: String(player1.userId),
              players: {
                [String(player1.userId)]: 'X',
                [String(player2.userId)]: 'O'
              },
              status: 'active'
            };
            
            activeSessions.set(sessionId, gameState);
            
            // Insert game session
            await pool.query(
              'INSERT INTO game_sessions (session_id, player1_id, player2_id, status) VALUES (?, ?, ?, ?)',
              [sessionId, Number(player1.userId), Number(player2.userId), 'active']
            );
            
            player1.ws.send(JSON.stringify({ 
              type: 'matchFound', 
              sessionId, 
              symbol: 'X',
              opponentId: Number(player2.userId),
              currentTurn: true
            }));
            
            player2.ws.send(JSON.stringify({ 
              type: 'matchFound', 
              sessionId, 
              symbol: 'O',
              opponentId: Number(player1.userId),
              currentTurn: false
            }));
          } else {
            ws.send(JSON.stringify({ type: 'searching' }));
          }
        }
        break;
        
      case 'makeMove':
        if (userId && data.sessionId) {
          const session = activeSessions.get(data.sessionId);
          // userId is stored as string on the server; ensure comparison uses the same type
          if (session && session.currentPlayer === userId && session.board[data.position] === null) {
            session.board[data.position] = session.players[userId];
            
            const winner = checkWinner(session.board);
            
            if (winner) {
              session.status = 'completed';
              const winnerId = Object.keys(session.players).find(id => session.players[id] === winner);
              const loserId = Object.keys(session.players).find(id => id !== winnerId);
              
              // Update database (pass numeric IDs)
              await updateGameResult(data.sessionId, Number(winnerId), Number(loserId), 'win');
              
              broadcastToSession(data.sessionId, {
                type: 'gameOver',
                board: session.board,
                winner: winner,
                winnerId: parseInt(winnerId)
              });
            } else if (session.board.every(cell => cell !== null)) {
              session.status = 'completed';
              const [p1, p2] = Object.keys(session.players);
              await updateGameResult(data.sessionId, Number(p1), Number(p2), 'draw');
              
              broadcastToSession(data.sessionId, {
                type: 'gameOver',
                board: session.board,
                winner: null
              });
            } else {
              // Switch to the other player's id (string)
              session.currentPlayer = Object.keys(session.players).find(id => id !== userId);
              
              broadcastToSession(data.sessionId, {
                type: 'moveMade',
                board: session.board,
                // send numeric id for client convenience
                currentPlayer: Number(session.currentPlayer)
              });
            }
          }
        }
        break;
        
      case 'sendMessage':
        if (userId && data.sessionId) {
          await pool.query(
            'INSERT INTO chat_messages (session_id, user_id, message) VALUES (?, ?, ?)',
            [data.sessionId, userId, data.message]
          );
          
          broadcastToSession(data.sessionId, {
            type: 'chatMessage',
            userId,
            message: data.message,
            timestamp: new Date()
          });
        }
        break;
    }
  });
  
  ws.on('close', () => {
    if (userId) {
      clients.delete(userId);
      const index = matchmakingQueue.findIndex(p => p.userId === userId);
      if (index !== -1) matchmakingQueue.splice(index, 1);
    }
  });
});

function broadcastToSession(sessionId, message) {
  const session = activeSessions.get(sessionId);
  if (session) {
    Object.keys(session.players).forEach(playerId => {
      // clients map stores keys as strings
      const client = clients.get(playerId);
      if (client && client.readyState === WebSocket.OPEN) {
        const out = Object.assign({}, message);
        // normalize some common id fields to numbers for client convenience
        if (out.currentPlayer !== undefined) out.currentPlayer = Number(out.currentPlayer);
        if (out.winnerId !== undefined) out.winnerId = Number(out.winnerId);
        if (out.userId !== undefined) out.userId = Number(out.userId);
        if (out.opponentId !== undefined) out.opponentId = Number(out.opponentId);
        client.send(JSON.stringify(out));
      }
    });
  }
}

function checkWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  
  for (let line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

async function updateGameResult(sessionId, winnerId, loserId, result) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    if (result === 'win') {
      await connection.query('UPDATE users SET wins = wins + 1, coins = coins + 50 WHERE user_id = ?', [winnerId]);
      await connection.query('UPDATE users SET losses = losses + 1 WHERE user_id = ?', [loserId]);
      await connection.query('UPDATE game_sessions SET winner_id = ?, status = ? WHERE session_id = ?', [winnerId, 'completed', sessionId]);
    } else {
      await connection.query('UPDATE users SET draws = draws + 1, coins = coins + 10 WHERE user_id IN (?, ?)', [winnerId, loserId]);
      await connection.query('UPDATE game_sessions SET status = ? WHERE session_id = ?', ['draw', sessionId]);
    }
    
    await connection.commit();
    
    // Check achievements
    await checkAchievements(winnerId);
    if (result === 'win') await checkAchievements(loserId);
  } catch (error) {
    await connection.rollback();
    console.error(error);
  } finally {
    connection.release();
  }
}

async function checkAchievements(userId) {
  const [user] = await pool.query('SELECT wins FROM users WHERE user_id = ?', [userId]);
  const wins = user[0].wins;
  
  const achievements = [
    { id: 1, threshold: 1 },
    { id: 2, threshold: 10 },
    { id: 3, threshold: 50 }
  ];
  
  for (let ach of achievements) {
    if (wins >= ach.threshold) {
      await pool.query(
        'INSERT IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
        [userId, ach.id]
      );
    }
  }
}

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});