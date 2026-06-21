'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface HexCoord {
  q: number;
  r: number;
  resourceType: string;
  numberToken: number | null;
  nodes: number[];
}

interface Port {
  tradeType: string;
  connectedNodes: number[];
}

interface Player {
  id: string;
  name: string;
  color: string;
  inventory: string[];
  devCards: string[];
  tradeRates: { [resource: string]: number };
}

interface GameState {
  board: {
    hexes: HexCoord[];
    ports: Port[];
    robberLocation: { q: number; r: number };
    nodesLookup: Record<number, { x: number; y: number }>;
    edges: { id: number; nodes: number[] }[];
    nodeAdjacency: Record<number, number[]>;
  };
  players: Player[];
  longestRoadOwner?: string;
  longestRoadLength?: number;
  largestArmyOwner?: string;
  largestArmySize?: number;
  buildings: Record<string, { owner: string; type: string }>;
  roads: Record<string, string>;
}

export default function HostPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<'LOBBY' | 'PLAYING'>('LOBBY');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lastRoll, setLastRoll] = useState<{roll1: number, roll2: number, rollSum: number} | null>(null);
  const [activePortIndex, setActivePortIndex] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState<{winnerName: string, score: number} | null>(null);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001");
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('create_room');
    });

    newSocket.on('room_created', ({ roomCode }) => {
      setRoomCode(roomCode);
    });

    newSocket.on('player_joined', ({ players }) => {
      setPlayers(players);
    });

    newSocket.on('game_started', (state: GameState) => {
      setGameState(state);
      setStatus('PLAYING');
    });

    newSocket.on('dice_rolled', ({ roll1, roll2, rollSum, gameState }) => {
      setGameState(gameState);
      setLastRoll({ roll1, roll2, rollSum });
      
      // Auto-clear the highlight after 6 seconds
      setTimeout(() => {
        setLastRoll(null);
      }, 6000);
    });

    newSocket.on('turn_ended', ({ gameState }) => {
      setGameState(gameState);
    });

    newSocket.on('port_used', ({ portIndex }) => {
      setActivePortIndex(portIndex);
      setTimeout(() => setActivePortIndex(null), 4000);
    });

    newSocket.on('game_over', (data) => setGameOver(data));

    newSocket.on('game_message', ({ message }) => {
      setToastMessage(message);
      setTimeout(() => setToastMessage(null), 5000);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleStartGame = () => {
    if (socket && roomCode) {
      socket.emit('start_game', { roomCode });
    }
  };

  const renderPorts = () => {
    if (!gameState || !gameState.board.ports || !gameState.board.nodesLookup) return null;
    
    return gameState.board.ports.map((port, i) => {
      const p1 = gameState.board.nodesLookup[port.connectedNodes[0]];
      const p2 = gameState.board.nodesLookup[port.connectedNodes[1]];
      
      if (!p1 || !p2) return null;
      
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      
      const dist = Math.sqrt(midX * midX + midY * midY);
      const normX = midX / dist;
      const normY = midY / dist;
      
      const EXTENSION = 22;
      const out1X = p1.x + normX * EXTENSION;
      const out1Y = p1.y + normY * EXTENSION;
      const out2X = p2.x + normX * EXTENSION;
      const out2Y = p2.y + normY * EXTENSION;
      
      const centerOutX = midX + normX * (EXTENSION + 6);
      const centerOutY = midY + normY * (EXTENSION + 6);
      
      // Determine short label
      const isGeneric = port.tradeType === '3:1';
      const label = isGeneric ? '3:1' : port.tradeType.replace('2:1 ', '');
      const bgColor = isGeneric ? '#f1f5f9' : '#fef3c7'; // White for generic, yellow for specialized
      
      const rectWidth = Math.max(36, label.length * 8 + 16);
      const rectHeight = 26;
      const rectX = centerOutX - rectWidth / 2;
      const rectY = centerOutY - rectHeight / 2;
      
      const isActive = i === activePortIndex;
      
      return (
        <g key={`port-${i}`} filter="url(#shadow)" className={isActive ? 'animate-pulse' : ''}>
          <polygon 
            points={`${p1.x},${p1.y} ${out1X},${out1Y} ${out2X},${out2Y} ${p2.x},${p2.y}`} 
            fill="url(#pat-Token)" 
            stroke="#451a03" 
            strokeWidth="3" 
          />
          {isActive && (
            <rect 
              x={rectX - 6} y={rectY - 6} width={rectWidth + 12} height={rectHeight + 12} rx="16" ry="16"
              fill="none" stroke="#22d3ee" strokeWidth="4" 
            />
          )}
          <rect 
            x={rectX} y={rectY} width={rectWidth} height={rectHeight} rx="13" ry="13"
            fill={bgColor} stroke="#78350f" strokeWidth="2" 
          />
          <text 
            x={centerOutX} y={centerOutY + 4} 
            textAnchor="middle" fontSize="12" fontWeight="900" fill="#451a03"
          >
            {label}
          </text>
        </g>
      );
    });
  };

  const renderHexGrid = () => {
    if (!gameState) return null;

    const R = 48; // Hex radius
    const SQRT3 = Math.sqrt(3);

    const getHexCenter = (q: number, r: number) => {
      const x = R * SQRT3 * (q + r / 2);
      const y = R * (3 / 2) * r;
      return { x, y };
    };

    const getPoints = () => {
      return [
        [0, -R],
        [(SQRT3 / 2) * R, -R / 2],
        [(SQRT3 / 2) * R, R / 2],
        [0, R],
        [-(SQRT3 / 2) * R, R / 2],
        [-(SQRT3 / 2) * R, -R / 2],
      ].map(p => p.join(',')).join(' ');
    };

    const resources = ['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore', 'Desert'];

    return (
      <svg viewBox="-260 -240 520 480" className="w-full h-full mx-auto filter drop-shadow-2xl">
        <defs>
          {resources.map((res) => (
            <pattern key={res} id={`pat-${res}`} patternUnits="userSpaceOnUse" width="120" height="120" x="-60" y="-60">
              <image href={`/textures/${res.toLowerCase()}.png`} width="120" height="120" preserveAspectRatio="xMidYMid slice" />
            </pattern>
          ))}
          <pattern id="pat-Token" patternUnits="userSpaceOnUse" width="36" height="36" x="-18" y="-18">
            <image href="/textures/wooden_token.png" width="36" height="36" preserveAspectRatio="xMidYMid slice" />
          </pattern>
          
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.6"/>
          </filter>
        </defs>

        <g>
          {/* Render Ports UNDER the hexes so they protrude perfectly */}
          {renderPorts()}

          {/* Layer 1: Hexes and Robber */}
          {gameState.board.hexes.map((hex, i) => {
            const { x, y } = getHexCenter(hex.q, hex.r);
            const isRobber = gameState.board.robberLocation.q === hex.q && gameState.board.robberLocation.r === hex.r;
            const isHighlighted = lastRoll && hex.numberToken === lastRoll.rollSum;

            return (
              <g key={`hex-${i}`} transform={`translate(${x}, ${y})`}>
                <polygon
                  points={getPoints()}
                  fill={`url(#pat-${hex.resourceType})`}
                  stroke={isHighlighted ? '#eab308' : '#1e293b'}
                  strokeWidth={isHighlighted ? '6' : '3'}
                  className={`transition-transform cursor-pointer shadow-2xl ${isHighlighted ? 'animate-pulse' : 'hover:scale-[1.02]'}`}
                />
                
                {/* Number Token */}
                {hex.numberToken && (
                  <g filter="url(#shadow)">
                    <circle cx="0" cy="0" r="18" fill="url(#pat-Token)" stroke="#5c4033" strokeWidth="2" />
                    <text
                      x="0"
                      y="1"
                      dominantBaseline="middle"
                      textAnchor="middle"
                      className={`text-[15px] font-black ${hex.numberToken === 6 || hex.numberToken === 8 ? 'fill-red-600 drop-shadow-md text-[17px]' : 'fill-slate-900 drop-shadow-sm'}`}
                      style={{ textShadow: '0px 1px 2px rgba(255,255,255,0.8)' }}
                    >
                      {hex.numberToken}
                    </text>
                  </g>
                )}

                {/* Hex ID Overlay */}
                <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fontSize="56" fontWeight="900" fill="white" opacity="0.3" style={{ pointerEvents: 'none' }}>
                  {i}
                </text>

                {/* Robber Pawn */}
                {isRobber && (
                  <g transform="translate(0, 5) scale(1.8)" filter="url(#shadow)" className="animate-pulse">
                    <path 
                      d="M-12,20 C-12,18 -8,18 -8,15 L-6,-2 C-12,-4 -12,-12 0,-15 C12,-12 12,-4 6,-2 L8,15 C8,18 12,18 12,20 Z" 
                      fill="#020617" 
                      stroke="#ef4444" 
                      strokeWidth="1.5"
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/* Layer 2: Edge ID Badges (Rendered before roads so roads paint over them) */}
          {gameState.board.edges && gameState.board.edges.map((edge) => {
            const p1 = gameState.board.nodesLookup[edge.nodes[0]];
            const p2 = gameState.board.nodesLookup[edge.nodes[1]];
            if (!p1 || !p2) return null;
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            return (
              <g key={`edge-badge-${edge.id}`}>
                <rect x={midX - 11} y={midY - 8} width="22" height="16" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" rx="4" ry="4" />
                <text x={midX} y={midY} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="900" fill="black">{edge.id}</text>
              </g>
            );
          })}

          {/* Layer 3: Completed Roads */}
          {Object.entries(gameState.roads || {}).map(([edgeIdStr, ownerId]) => {
            const edgeId = parseInt(edgeIdStr, 10);
            const edge = gameState.board.edges?.find(e => e.id === edgeId);
            if (!edge) return null;
            const p1 = gameState.board.nodesLookup[edge.nodes[0]];
            const p2 = gameState.board.nodesLookup[edge.nodes[1]];
            if (!p1 || !p2) return null;
            const owner = gameState.players?.find(p => p.id === ownerId);
            const playerColor = owner ? owner.color : '#fff';
            return (
              <line 
                key={`road-${edgeId}`} 
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} 
                stroke={playerColor} strokeWidth="10" strokeLinecap="round" 
              />
            );
          })}

          {/* Layer 4: Completed Buildings (Houses) */}
          {Object.entries(gameState.buildings || {}).map(([nodeIdStr, building]) => {
            const nodeId = parseInt(nodeIdStr, 10);
            const pos = gameState.board.nodesLookup[nodeId];
            if (!pos) return null;
            const owner = gameState.players?.find(p => p.id === building.owner);
            const color = owner ? owner.color : '#fff';
            return (
              <g key={`building-${nodeId}`} transform={`translate(${pos.x}, ${pos.y})`} filter="url(#shadow)">
                {building.type === 'settlement' && (
                  <rect x="-15" y="-15" width="30" height="30" fill={color} stroke="white" strokeWidth="3" rx="6" ry="6" />
                )}
                {building.type === 'city' && (
                  <g>
                    <path 
                      d="M-22,18 L-22,0 L-12,-15 L-2,0 L-2,8 L8,-5 L18,5 L18,18 Z" 
                      fill={color} stroke="white" strokeWidth="3" strokeLinejoin="round" 
                    />
                    <rect x="-16" y="2" width="6" height="6" fill="white" opacity="0.8" />
                    <rect x="6" y="8" width="6" height="6" fill="white" opacity="0.8" />
                  </g>
                )}
              </g>
            );
          })}

          {/* Layer 5: Node ID Badges (Always visible) */}
          {Object.entries(gameState.board.nodesLookup).map(([nodeId, pos]) => {
            return (
              <g key={`node-badge-${nodeId}`} transform={`translate(${pos.x}, ${pos.y})`}>
                <circle cx="0" cy="0" r="11" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="900" fill="white">{nodeId}</text>
              </g>
            );
          })}


        </g>
      </svg>
    );
  };

  if (status === 'PLAYING') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 landscape-optimizations relative overflow-hidden">
        {gameOver && (
          <div className="absolute inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-6 backdrop-blur-md">
            <div className="bg-gradient-to-b from-yellow-500 to-yellow-700 p-2 rounded-3xl shadow-[0_0_150px_rgba(234,179,8,0.6)] animate-bounce w-[800px]">
              <div className="bg-slate-900 rounded-3xl p-16 flex flex-col items-center border-2 border-yellow-500/50">
                <div className="text-8xl mb-8">🏆</div>
                <h2 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mb-6 uppercase tracking-[0.2em] text-center drop-shadow-2xl">Victory!</h2>
                <p className="text-white text-4xl text-center leading-relaxed">
                  <span className="font-bold text-yellow-400 text-6xl drop-shadow-lg">{gameOver.winnerName}</span><br/><br/>
                  has won the game with <span className="font-black text-emerald-400">{gameOver.score}</span> Victory Points!
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Ocean Background mapping */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/60 via-slate-950 to-slate-950 pointer-events-none" />

        <header className="absolute top-6 left-8 flex items-center space-x-4 z-10">
          <h1 className="text-4xl font-extrabold text-yellow-500 drop-shadow-xl tracking-tight">CATAN</h1>
          <div className="bg-slate-900/80 backdrop-blur-md px-5 py-2 rounded-xl border border-slate-700 shadow-2xl">
            <span className="text-slate-400 text-sm uppercase tracking-wider mr-3 font-semibold">Room Code:</span>
            <span className="text-white font-black tracking-[0.2em] text-xl">{roomCode}</span>
          </div>
        </header>

        <div className="absolute top-6 right-8 z-10 flex space-x-3">
          {gameState?.players ? gameState.players.map((p) => (
            <div key={p.id} className="backdrop-blur-sm px-6 py-3 rounded-xl text-white font-bold shadow-2xl border-2 flex items-center" style={{ backgroundColor: `${p.color}dd`, borderColor: p.color }}>
              <span>{p.name}</span>
              {gameState.longestRoadOwner === p.id && <span className="bg-yellow-500 text-yellow-950 text-[10px] px-2 py-0.5 rounded-full ml-2 shadow-sm font-black whitespace-nowrap tracking-wider">LONGEST ROAD</span>}
              {gameState.largestArmyOwner === p.id && <span className="bg-red-500 text-red-950 text-[10px] px-2 py-0.5 rounded-full ml-2 shadow-sm font-black whitespace-nowrap tracking-wider">LARGEST ARMY</span>}
            </div>
          )) : players.map((p) => (
            <div key={p.id} className="bg-indigo-600/90 backdrop-blur-sm px-6 py-3 rounded-xl text-white font-bold shadow-2xl border border-indigo-400">
              {p.name}
            </div>
          ))}
        </div>

        {/* Dice Overlay */}
        {lastRoll && (
          <div className="absolute top-24 right-8 z-20 flex flex-col items-center animate-bounce">
            <div className="bg-slate-900/90 backdrop-blur-md p-6 rounded-3xl border-4 border-yellow-500 shadow-2xl flex flex-col items-center">
              <h3 className="text-yellow-400 font-bold text-xl mb-4 tracking-widest uppercase">Roll</h3>
              <div className="flex space-x-4 mb-4">
                <div className="w-16 h-16 bg-white rounded-xl shadow-inner flex items-center justify-center border-b-4 border-slate-300">
                  <span className="text-4xl font-black text-slate-800">{lastRoll.roll1}</span>
                </div>
                <div className="w-16 h-16 bg-red-500 rounded-xl shadow-inner flex items-center justify-center border-b-4 border-red-700">
                  <span className="text-4xl font-black text-white">{lastRoll.roll2}</span>
                </div>
              </div>
              <div className="text-5xl font-black text-white drop-shadow-md">
                {lastRoll.rollSum}
              </div>
            </div>
          </div>
        )}

        <div className="w-full h-[90vh] flex items-center justify-center mt-6 z-0 relative">
          {renderHexGrid()}
        </div>

        {toastMessage && (
          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-slate-900/95 backdrop-blur-md px-10 py-5 rounded-full border-2 border-indigo-500 shadow-[0_0_40px_rgba(99,102,241,0.6)] animate-bounce">
              <span className="text-white font-bold text-2xl tracking-wide">{toastMessage}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-8 landscape-optimizations">
      <header className="text-center mb-12 mt-10">
        <h1 className="text-6xl font-extrabold tracking-tight text-yellow-400 mb-4 drop-shadow-lg">
          CATAN CLONE
        </h1>
        <p className="text-2xl text-slate-300">Join the game on your phone!</p>
      </header>

      <div className="bg-slate-800 rounded-3xl p-10 shadow-2xl border-4 border-slate-700 flex flex-col items-center max-w-2xl w-full">
        <h2 className="text-3xl font-bold mb-2 text-slate-400 uppercase tracking-widest">Room Code</h2>
        <div className="text-8xl font-black text-white tracking-[0.2em] mb-10 bg-slate-900 py-6 px-12 rounded-xl shadow-inner border border-slate-700">
          {roomCode || '...'}
        </div>

        <div className="w-full mb-8">
          <h3 className="text-2xl font-semibold mb-6 border-b border-slate-700 pb-2 text-slate-300">
            Players Joined ({players.length})
          </h3>
          {players.length === 0 ? (
            <div className="text-center py-8 text-slate-500 italic">
              Waiting for players to join...
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-4 w-full">
              {players.map((player) => (
                <li 
                  key={player.id} 
                  className="bg-indigo-600 text-white text-xl font-bold py-4 px-6 rounded-xl shadow-md transform transition-all hover:scale-105 flex items-center justify-center"
                >
                  {player.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {players.length > 0 && (
          <button
            onClick={handleStartGame}
            className="bg-green-500 hover:bg-green-400 text-green-950 font-black text-2xl py-4 px-12 rounded-2xl shadow-xl transform transition hover:-translate-y-1 active:translate-y-0 uppercase tracking-wider"
          >
            Start Game
          </button>
        )}
      </div>
    </div>
  );
}
