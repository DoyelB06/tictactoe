// Enhanced Funky, Attractive, Innovative UI version of your TicTacToeGame
// NOTE: This is a full rewritten frontend with animations, neon effects,
// gradients, glassmorphism, funky buttons, motion effects and modern UI.
// Replace your existing file with this one.

import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Award, ShoppingCart, MessageCircle, LogOut, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const API_URL = process.env.REACT_APP_API_URL || '/api';
const WS_URL =
  process.env.REACT_APP_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

export default function TicTacToeGame() {
  const [view, setView] = useState('login');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [ws, setWs] = useState(null);
  const [gameSession, setGameSession] = useState(null);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [mySymbol, setMySymbol] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [gameStatus, setGameStatus] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [storeItems, setStoreItems] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const wsRef = useRef(null);

  useEffect(() => {
    if (token) {
      connectWebSocket();
      if (view === 'leaderboard') fetchLeaderboard();
      if (view === 'achievements') fetchAchievements();
      if (view === 'store') fetchStore();
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [token, view]);

  const connectWebSocket = () => {
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'authenticate', token }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'authenticated':
          break;
        case 'searching':
          setGameStatus('Searching for opponent...');
          break;
        case 'matchFound':
          setGameSession(data.sessionId);
          setMySymbol(data.symbol);
          setCurrentTurn(data.currentTurn);
          setBoard(Array(9).fill(null));
          setLastMove(null);
          setChatMessages([]);
          setGameStatus(data.currentTurn ? 'Your turn!' : "Opponent's turn");
          setView('game');
          break;
        case 'moveMade':
          // Compute which cell changed to animate/highlight the last move
          setBoard((prev) => {
            const newBoard = data.board;
            let changedIdx = null;
            for (let i = 0; i < newBoard.length; i++) {
              if (prev[i] !== newBoard[i]) { changedIdx = i; break; }
            }
            setLastMove(changedIdx);
            return newBoard;
          });
          setCurrentTurn(data.currentPlayer === user.userId);
          setGameStatus(data.currentPlayer === user.userId ? 'Your turn!' : "Opponent's turn");
          break;
        case 'gameOver':
          setBoard(data.board);
          setLastMove(null);
          if (data.winner === null) {
            setGameStatus('Game Draw!');
          } else if (data.winnerId === user.userId) {
            setGameStatus('You Won! 🎉 (+50 coins)');
            setUser(prev => ({ ...prev, coins: prev.coins + 50 }));
          } else {
            setGameStatus('You Lost!');
          }
          setTimeout(() => {
            setView('menu');
            setGameSession(null);
          }, 3000);
          break;
        case 'chatMessage':
          setChatMessages(prev => [...prev, {
            userId: data.userId,
            message: data.message,
            timestamp: data.timestamp
          }]);
          break;
      }
    };

    wsRef.current = socket;
    setWs(socket);
  };

  const handleRegister = async () => {
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        alert('Registration successful!');
        setView('login');
      } else {
        alert(data.error);
      }
    } catch {}
  };

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username, password: formData.password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        setView('menu');
      } else alert(data.error);
    } catch {}
  };

  const findMatch = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'findMatch' }));
      setGameStatus('Searching for a match...');
    }
  };

  const makeMove = (position) => {
    if (currentTurn && board[position] === null && ws) {
      ws.send(JSON.stringify({ type: 'makeMove', sessionId: gameSession, position }));
    }
  };

  const sendMessage = () => {
    if (messageInput.trim() && ws && gameSession) {
      ws.send(JSON.stringify({ type: 'sendMessage', sessionId: gameSession, message: messageInput }));
      setMessageInput('');
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API_URL}/leaderboard`, { headers: { Authorization: `Bearer ${token}` } });
      setLeaderboard(await res.json());
    } catch {}
  };

  const fetchAchievements = async () => {
    try {
      const res = await fetch(`${API_URL}/achievements`, { headers: { Authorization: `Bearer ${token}` } });
      setAchievements(await res.json());
    } catch {}
  };

  const fetchStore = async () => {
    try {
      const res = await fetch(`${API_URL}/store`, { headers: { Authorization: `Bearer ${token}` } });
      setStoreItems(await res.json());
    } catch {}
  };

  const purchaseItem = async (itemId, price) => {
    if (user.coins < price) return alert('Not enough coins!');
    try {
      const res = await fetch(`${API_URL}/store/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(prev => ({ ...prev, coins: data.newBalance }));
        fetchStore();
      } else alert(data.error);
    } catch {}
  };

  const logout = () => {
    if (wsRef.current) wsRef.current.close();
    setToken(null);
    setUser(null);
    setView('login');
  };

  //--------------- FUNKY UI HELPERS -------------------//

  const funkyGradient = "bg-gradient-to-br from-[#ff00cc] to-[#333399]";
  const glass = "backdrop-blur-xl bg-white/20 border border-white/30";
  const neonButton = "transition-all duration-300 hover:scale-105 hover:shadow-[0_0_15px_#ff00ff]";


  //---------------- LOGIN + REGISTER -------------------//
  if (view === 'login' || view === 'register') {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)',
          backgroundSize: '400% 400%',
          animation: 'colorShift 15s ease infinite'
        }}
      >
        <style>{`
          @keyframes colorShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>

        {/* Large Tic-Tac-Toe Board Background */}
        <svg className="absolute inset-0 w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
          {/* Tic-Tac-Toe Grid */}
          <line x1="100" y1="0" x2="100" y2="300" stroke="#ff00ff" strokeWidth="12"/>
          <line x1="200" y1="0" x2="200" y2="300" stroke="#ff00ff" strokeWidth="12"/>
          <line x1="0" y1="100" x2="300" y2="100" stroke="#00ffff" strokeWidth="12"/>
          <line x1="0" y1="200" x2="300" y2="200" stroke="#00ffff" strokeWidth="12"/>
          
          {/* X and O symbols scattered */}
          <text x="40" y="80" fontSize="80" fill="#ff00ff" opacity="0.8" fontWeight="bold">X</text>
          <text x="140" y="80" fontSize="80" fill="#00ffff" opacity="0.8" fontWeight="bold">O</text>
          <text x="240" y="150" fontSize="80" fill="#ff00ff" opacity="0.8" fontWeight="bold">X</text>
          <text x="40" y="220" fontSize="80" fill="#00ffff" opacity="0.8" fontWeight="bold">O</text>
          <text x="160" y="270" fontSize="80" fill="#ff00ff" opacity="0.8" fontWeight="bold">X</text>
        </svg>

        {/* Gaming background pattern */}
        <div className="absolute inset-0 opacity-20">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="gamePattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                <circle cx="50" cy="50" r="5" fill="#ff00ff" opacity="0.5"/>
                <rect x="30" y="30" width="40" height="40" fill="none" stroke="#00ffff" opacity="0.3" strokeWidth="1"/>
                <line x1="0" y1="50" x2="100" y2="50" stroke="#ff00ff" opacity="0.2" strokeWidth="1"/>
                <line x1="50" y1="0" x2="50" y2="100" stroke="#00ffff" opacity="0.2" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gamePattern)"/>
          </svg>
        </div>

        {/* Animated gaming elements */}
        <div className="absolute top-10 left-10 text-8xl opacity-60 animate-pulse">🎮</div>
        <div className="absolute bottom-20 right-20 text-8xl opacity-60 animate-pulse" style={{animationDelay: '0.5s'}}>👾</div>
        <div className="absolute top-1/3 right-10 text-7xl opacity-50 animate-bounce">⚡</div>
        <div className="absolute bottom-10 left-20 text-7xl opacity-50 animate-bounce" style={{animationDelay: '0.3s'}}>🔥</div>

        {/* Neon glow effect */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(circle at 20% 50%, rgba(255, 0, 255, 0.1) 0%, transparent 50%)',
          pointerEvents: 'none'
        }}></div>
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(circle at 80% 80%, rgba(0, 255, 255, 0.1) 0%, transparent 50%)',
          pointerEvents: 'none'
        }}></div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`w-full max-w-md rounded-3xl p-8 shadow-2xl ${glass} relative z-10`}
        >
          <h1 className="text-4xl font-extrabold text-center text-white drop-shadow-lg mb-8">
            🎮 GAMEHIVE
          </h1>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              className="w-full p-3 rounded-xl bg-white/30 text-white placeholder-white/80"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
            {view === 'register' && (
              <input
                type="email"
                placeholder="Email"
                className="w-full p-3 rounded-xl bg-white/30 text-white placeholder-white/80"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            )}
            <input
              type="password"
              placeholder="Password"
              className="w-full p-3 rounded-xl bg-white/30 text-white placeholder-white/80"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <button
              onClick={view === 'login' ? handleLogin : handleRegister}
              className={`w-full py-3 rounded-xl bg-[#ff00ff] text-white font-bold ${neonButton}`}
            >
              {view === 'login' ? 'Login' : 'Register'}
            </button>
          </div>

          <button
            className="mt-4 w-full text-center text-white underline hover:text-pink-200"
            onClick={() => setView(view === 'login' ? 'register' : 'login')}
          >
            {view === 'login' ? 'Create an account' : 'Already have an account?'}
          </button>
        </motion.div>
      </div>
    );
  }

  //---------------- MENU -------------------//
  if (view === 'menu') {
    return (
      <div 
        className="min-h-screen p-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)',
          backgroundSize: '400% 400%',
          animation: 'colorShift 15s ease infinite'
        }}
      >
        <style>{`
          @keyframes colorShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>

        {/* Gamer illustration background */}
        <svg className="absolute bottom-0 right-0 w-96 h-96 opacity-30 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
          {/* Controller */}
          <ellipse cx="200" cy="200" rx="120" ry="100" fill="#ff00ff" opacity="0.3"/>
          
          {/* Head */}
          <circle cx="200" cy="80" r="35" fill="#fdbcb4"/>
          
          {/* Body */}
          <rect x="170" y="120" width="60" height="80" rx="10" fill="#ff6b9d"/>
          
          {/* Arms */}
          <rect x="80" y="140" width="90" height="25" rx="12" fill="#fdbcb4"/>
          <rect x="230" y="140" width="90" height="25" rx="12" fill="#fdbcb4"/>
          
          {/* Gaming controller in hands */}
          <rect x="50" y="150" width="100" height="50" rx="10" fill="#333" stroke="#00ffff" strokeWidth="2"/>
          <circle cx="70" cy="165" r="8" fill="#ff00ff"/>
          <circle cx="85" cy="165" r="8" fill="#00ffff"/>
          <circle cx="70" cy="180" r="8" fill="#ffff00"/>
          <circle cx="85" cy="180" r="8" fill="#ff00ff"/>
          
          <rect x="250" y="150" width="100" height="50" rx="10" fill="#333" stroke="#00ffff" strokeWidth="2"/>
          <circle cx="270" cy="165" r="8" fill="#ff00ff"/>
          <circle cx="285" cy="165" r="8" fill="#00ffff"/>
          <circle cx="270" cy="180" r="8" fill="#ffff00"/>
          <circle cx="285" cy="180" r="8" fill="#ff00ff"/>
          
          {/* Legs */}
          <rect x="160" y="210" width="30" height="80" rx="10" fill="#1a1a2e"/>
          <rect x="210" y="210" width="30" height="80" rx="10" fill="#1a1a2e"/>
          
          {/* Shoes */}
          <ellipse cx="175" cy="300" rx="20" ry="15" fill="#ff00ff"/>
          <ellipse cx="225" cy="300" rx="20" ry="15" fill="#00ffff"/>
          
          {/* Eyes */}
          <circle cx="190" cy="75" r="4" fill="#333"/>
          <circle cx="210" cy="75" r="4" fill="#333"/>
          
          {/* Smile */}
          <path d="M 190 85 Q 200 90 210 85" stroke="#333" strokeWidth="2" fill="none"/>
        </svg>

        {/* Top-left: Gaming Console/Controller */}
        <svg className="absolute top-10 left-10 w-32 h-32 opacity-25 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
          <rect x="30" y="60" width="140" height="100" rx="15" fill="#1a1a2e" stroke="#00ffff" strokeWidth="3"/>
          <circle cx="60" cy="100" r="12" fill="#ff00ff"/>
          <circle cx="80" cy="85" r="12" fill="#00ffff"/>
          <circle cx="80" cy="115" r="12" fill="#ffff00"/>
          <circle cx="100" cy="100" r="12" fill="#ff00ff"/>
          <rect x="130" y="85" width="25" height="15" rx="5" fill="#ff6b9d"/>
          <rect x="130" y="115" width="25" height="15" rx="5" fill="#ff6b9d"/>
        </svg>

        {/* Top-right: Trophy */}
        <svg className="absolute top-20 right-20 w-24 h-24 opacity-25 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          {/* Cup */}
          <ellipse cx="50" cy="35" rx="25" ry="20" fill="#ffaa00" stroke="#ff8800" strokeWidth="2"/>
          <path d="M 25 35 Q 20 50 25 60 L 75 60 Q 80 50 75 35" fill="#ffaa00" stroke="#ff8800" strokeWidth="2"/>
          {/* Handles */}
          <path d="M 75 40 Q 90 40 90 50 Q 90 60 75 60" fill="none" stroke="#ff8800" strokeWidth="2"/>
          {/* Base */}
          <rect x="35" y="60" width="30" height="8" fill="#ffaa00" stroke="#ff8800" strokeWidth="2"/>
          <rect x="30" y="68" width="40" height="5" fill="#ffaa00" stroke="#ff8800" strokeWidth="2"/>
          {/* Star */}
          <polygon points="50,25 55,35 65,35 57,42 60,52 50,46 40,52 43,42 35,35 45,35" fill="#ffff00"/>
        </svg>

        {/* Left side: Headset */}
        <svg className="absolute top-1/3 left-10 w-28 h-28 opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          {/* Headband */}
          <path d="M 20 50 Q 20 30 50 30 Q 80 30 80 50" fill="none" stroke="#ff00ff" strokeWidth="4"/>
          {/* Left ear cup */}
          <circle cx="25" cy="60" r="15" fill="#1a1a2e" stroke="#00ffff" strokeWidth="2"/>
          <circle cx="25" cy="60" r="10" fill="#333"/>
          {/* Right ear cup */}
          <circle cx="75" cy="60" r="15" fill="#1a1a2e" stroke="#00ffff" strokeWidth="2"/>
          <circle cx="75" cy="60" r="10" fill="#333"/>
          {/* Microphone */}
          <rect x="47" y="70" width="6" height="20" fill="#ff6b9d"/>
          <circle cx="50" cy="92" r="5" fill="#ff6b9d"/>
        </svg>

        {/* Bottom-left: Game Dice */}
        <svg className="absolute bottom-20 left-10 w-20 h-20 opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <rect x="20" y="20" width="60" height="60" fill="#ff00ff" stroke="#ffff00" strokeWidth="2"/>
          <circle cx="35" cy="35" r="5" fill="#ffff00"/>
          <circle cx="50" cy="50" r="5" fill="#ffff00"/>
          <circle cx="65" cy="65" r="5" fill="#ffff00"/>
          <circle cx="35" cy="65" r="5" fill="#ffff00"/>
          <circle cx="65" cy="35" r="5" fill="#ffff00"/>
        </svg>

        {/* Right side: Star Power-up */}
        <svg className="absolute top-1/2 right-10 w-24 h-24 opacity-25 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <polygon points="50,10 60,40 90,40 67,60 77,90 50,70 23,90 33,60 10,40 40,40" fill="#ffff00" stroke="#ff8800" strokeWidth="2"/>
          <circle cx="50" cy="50" r="30" fill="none" stroke="#ff00ff" strokeWidth="2" opacity="0.5"/>
          <circle cx="50" cy="50" r="25" fill="none" stroke="#00ffff" strokeWidth="1" opacity="0.5"/>
        </svg>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className={`max-w-4xl mx-auto rounded-3xl p-8 text-white shadow-2xl ${glass} relative z-10`}
        >
          {/* Header with user info */}
          <div className="flex justify-between items-center mb-8 pb-6 border-b border-white/20">
            <div>
              <h2 className="text-5xl font-extrabold drop-shadow-lg mb-2">👋 {user.username}</h2>
              <p className="text-xl text-pink-300 font-semibold">💰 Coins: {user.coins}</p>
              <p className="text-sm text-white/70 mt-2">Wins: {user.wins} | Losses: {user.losses} | Draws: {user.draws}</p>
            </div>
            <button
              onClick={logout}
              className={`bg-black px-6 py-3 rounded-xl font-bold text-lg ${neonButton} hover:bg-gray-900 border border-white/30`}
            >
              <LogOut size={24} className="inline mr-2" />
              Logout
            </button>
          </div>

          {/* Menu buttons grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.button
              whileHover={{ scale: 1.08, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={findMatch}
              className="p-6 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 text-white flex flex-col items-center gap-3 font-bold text-lg shadow-lg hover:shadow-green-500/50"
            >
              <Users size={50} />
              Find Match
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.08, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setView('leaderboard')}
              className="p-6 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-700 text-white flex flex-col items-center gap-3 font-bold text-lg shadow-lg hover:shadow-yellow-500/50"
            >
              <Trophy size={50} />
              Leaderboard
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.08, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setView('achievements')}
              className="p-6 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-700 text-white flex flex-col items-center gap-3 font-bold text-lg shadow-lg hover:shadow-purple-500/50"
            >
              <Award size={50} />
              Achievements
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.08, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setView('store')}
              className="p-6 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-700 text-white flex flex-col items-center gap-3 font-bold text-lg shadow-lg hover:shadow-blue-500/50"
            >
              <ShoppingCart size={50} />
              Store
            </motion.button>
          </div>

          {/* Stats section */}
          <div className="mt-8 pt-6 border-t border-white/20">
            <h3 className="text-2xl font-extrabold mb-4">📊 Your Stats</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-500/20 p-4 rounded-xl border border-green-500/50">
                <p className="text-green-300 font-bold text-lg">{user.wins}</p>
                <p className="text-white/70">Wins</p>
              </div>
              <div className="bg-red-500/20 p-4 rounded-xl border border-red-500/50">
                <p className="text-red-300 font-bold text-lg">{user.losses}</p>
                <p className="text-white/70">Losses</p>
              </div>
              <div className="bg-yellow-500/20 p-4 rounded-xl border border-yellow-500/50">
                <p className="text-yellow-300 font-bold text-lg">{user.draws}</p>
                <p className="text-white/70">Draws</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  //---------------- GAME -------------------//
  if (view === 'game') {
    return (
      <div 
        className="min-h-screen p-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)',
          backgroundSize: '400% 400%',
          animation: 'colorShift 15s ease infinite'
        }}
      >
        <style>{`
          @keyframes colorShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>

        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">

          {/* Game Board */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`md:col-span-2 p-6 rounded-3xl shadow-xl ${glass}`}
          >
            <div className="flex justify-between mb-4 text-white text-lg font-bold">
              <div>{user.username} ({mySymbol})</div>
              <div className="text-pink-300 drop-shadow-lg">{gameStatus}</div>
            </div>

            <div className="max-w-md mx-auto" style={{ display: 'grid', placeItems: 'center' }}>
              <div className="bg-black p-2 rounded-2xl">
                <div className="grid grid-cols-3 gap-2" style={{ placeItems: 'center' }}>
              {board.map((cell, i) => {
                const isLast = lastMove === i;
                const isEmpty = cell === null;
                let baseClasses = 'relative aspect-square rounded-md flex items-center justify-center transition-transform duration-200 transform ';
                baseClasses += isEmpty ? 'cursor-pointer hover:scale-105 hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)] bg-white/10' : 'cursor-default';
                baseClasses += ' ' + neonButton;
                if (cell === 'X') baseClasses += ' bg-indigo-700 text-white';
                else if (cell === 'O') baseClasses += ' bg-rose-600 text-white';
                if (isLast) baseClasses += ' ring-4 ring-yellow-400/60';

                return (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    key={i}
                    onClick={() => makeMove(i)}
                    className={baseClasses}
                    style={{ width: 110, height: 110 }}
                    aria-label={`cell-${i}`}
                  >
                    {cell ? (
                      <span
                        className={`text-6xl md:text-7xl font-extrabold ${cell === 'X' ? 'text-white' : 'text-white'}`}
                        style={{
                          textShadow: cell === 'X' ? '0 6px 20px rgba(99,102,241,0.35)' : '0 6px 20px rgba(236,72,153,0.35)'
                        }}
                      >
                        {cell}
                      </span>
                    ) : (
                      <div className="w-4/5 h-4/5 rounded-full border-2 border-dashed border-white/30" />
                    )}
                    {/* last-move badge removed as requested */}
                  </motion.button>
                );
              })}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Chat */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-3xl shadow-xl text-white ${glass}`}
          >
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <MessageCircle size={20} /> Chat
            </h3>
            <div className="h-80 overflow-y-auto mb-3 bg-white/10 p-3 rounded-xl">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`mb-2 ${msg.userId === user.userId ? 'text-right' : ''}`}
                >
                  <span
                    className={`inline-block px-3 py-1 rounded-xl ${
                      msg.userId === user.userId ? 'bg-pink-500 text-white' : 'bg-white/40'
                    }`}
                  >
                    {msg.message}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 p-2 rounded-xl bg-white/20 text-white"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
              />
              <button
                onClick={sendMessage}
                className={`px-4 py-2 rounded-xl bg-pink-500 ${neonButton}`}
              >
                Send
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }


  //---------------- LEADERBOARD -------------------//
  if (view === 'leaderboard') {
    return (
      <div className={`min-h-screen p-6 ${funkyGradient}`}>        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`max-w-2xl mx-auto p-6 rounded-3xl shadow-xl ${glass} text-white`}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-extrabold flex items-center gap-2 drop-shadow-lg">
              <Trophy /> Leaderboard
            </h2>
            <button
              onClick={() => setView('menu')}
              className={`bg-gray-700 px-4 py-2 rounded-xl ${neonButton}`}
            >Back</button>
          </div>

          <div className="space-y-3">
            {leaderboard.map((p, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-white/20 backdrop-blur shadow-md flex justify-between"
              >
                <span>#{i + 1} — {p.username}</span>
                <span className="font-bold">{p.score} pts</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }


  //---------------- ACHIEVEMENTS -------------------//
  if (view === 'achievements') {
    return (
      <div className={`min-h-screen p-6 ${funkyGradient}`}>        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`max-w-2xl mx-auto p-6 rounded-3xl shadow-xl ${glass} text-white`}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-extrabold flex items-center gap-2 drop-shadow-lg">
              <Award /> Achievements
            </h2>
            <button
              onClick={() => setView('menu')}
              className={`bg-gray-700 px-4 py-2 rounded-xl ${neonButton}`}
            >Back</button>
          </div>

          <div className="space-y-4">
            {achievements.map((ach) => (
              <div
                key={ach.achievement_id}
                className={`p-4 rounded-xl ${ach.unlocked_at ? 'bg-green-500/40' : 'bg-white/20'} backdrop-blur`}
              >
                <div className="font-bold text-xl">{ach.icon} {ach.name}</div>
                <p className="text-sm">{ach.description}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }


  //---------------- STORE -------------------//
  if (view === 'store') {
    return (
      <div className={`min-h-screen p-6 ${funkyGradient}`}>        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`max-w-4xl mx-auto p-6 rounded-3xl shadow-xl text-white ${glass}`}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-extrabold drop-shadow-lg flex items-center gap-2">
              <ShoppingCart /> Store
            </h2>
            <button
              onClick={() => setView('menu')}
              className={`bg-gray-700 px-4 py-2 rounded-xl ${neonButton}`}
            >Back</button>
          </div>

          <p className="mb-4">Coins: {user.coins} 💰</p>

          <div className="grid md:grid-cols-2 gap-4">
            {storeItems.map((item) => (
              <div
                key={item.item_id}
                className="p-4 rounded-xl bg-white/20 backdrop-blur shadow-md"
              >
                <h3 className="text-xl font-bold mb-1">{item.name}</h3>
                <p className="text-sm mb-3">{item.description}</p>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-pink-300 text-xl">{item.price} 💰</span>
                  <button
                    onClick={() => purchaseItem(item.item_id, item.price)}
                    className={`px-4 py-2 rounded-xl bg-pink-500 ${neonButton}`}
                  >Buy</button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}
