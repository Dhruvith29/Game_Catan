'use client';

import { useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Player {
  id: string;
  name: string;
  color: string;
  inventory: string[];
  devCards: string[];
  tradeRates: { [resource: string]: number };
}

interface GameState {
  players: Player[];
  activePlayerIndex: number;
  turnPhase: string;
  setupPhaseState: Record<string, { settlement: boolean; road: boolean }>;
  discardingPlayers: Record<string, number>;
  robberVictims: string[];
  hasPlayedDevCardThisTurn: boolean;
  roadBuildingRoadsPlaced: number;
  tradeRates: Record<string, number>;
}

export default function PlayPage() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [nodeIdInput, setNodeIdInput] = useState('');
  const [edgeIdInput, setEdgeIdInput] = useState('');
  const [cityNodeIdInput, setCityNodeIdInput] = useState('');
  const [robberHexInput, setRobberHexInput] = useState('');
  const [stealVictimId, setStealVictimId] = useState('');
  const [discardSelection, setDiscardSelection] = useState<Record<string, number>>({
    Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0
  });
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [showTradeMenu, setShowTradeMenu] = useState(false);
  const [tradeTab, setTradeTab] = useState<'player' | 'maritime'>('player');
  const [showMonopolyModal, setShowMonopolyModal] = useState(false);
  const [showYOPModal, setShowYOPModal] = useState(false);
  const [monoRes, setMonoRes] = useState('Wood');
  const [yopRes1, setYopRes1] = useState('Wood');
  const [yopRes2, setYopRes2] = useState('Brick');
  const [offerRes, setOfferRes] = useState('Wood');
  const [offerAmt, setOfferAmt] = useState(1);
  const [reqRes, setReqRes] = useState('Brick');
  const [reqAmt, setReqAmt] = useState(1);
  const [tradeTargetId, setTradeTargetId] = useState('');
  const [gameOver, setGameOver] = useState<{winnerName: string, score: number} | null>(null);
  const [incomingTrade, setIncomingTrade] = useState<{
    proposerId: string;
    proposerName: string;
    offerRes: string;
    offerAmt: number;
    reqRes: string;
    reqAmt: number;
  } | null>(null);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !roomCode.trim()) return;

    setError('');
    const newSocket = io(process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001");
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join_room', { name: name.trim(), roomCode: roomCode.trim() });
    });

    newSocket.on('join_success', () => {
      setJoined(true);
    });

    newSocket.on('error', (err) => {
      setError(err.message || 'Failed to join room');
      newSocket.disconnect();
    });

    newSocket.on('game_error', (err) => {
      setError(err.message || 'Action failed');
    });

    newSocket.on('trade_offer', (offer) => {
      setIncomingTrade(offer);
    });

    newSocket.on('game_message', (msg) => {
      // Temporarily use error block to show toast messages like "Trade Accepted!"
      setError(msg.message);
    });

    newSocket.on('game_started', (state) => setGameState(state));
    newSocket.on('game_over', (data) => setGameOver(data));
    newSocket.on('dice_rolled', ({ gameState }) => setGameState(gameState));
    newSocket.on('turn_ended', ({ gameState }) => setGameState(gameState));
  };

  const handleRollDice = () => {
    if (socket && roomCode) {
      socket.emit('roll_dice', { roomCode });
    }
  };

  const handleEndTurn = () => {
    if (socket && roomCode) {
      socket.emit('end_turn', { roomCode });
    }
  };

  const handleBuildSettlement = () => {
    if (socket && roomCode && nodeIdInput.trim() !== '') {
      socket.emit('build_settlement', { roomCode, nodeId: parseInt(nodeIdInput, 10) });
      setNodeIdInput('');
    }
  };

  const handleBuildRoad = () => {
    if (socket && roomCode && edgeIdInput.trim() !== '') {
      socket.emit('build_road', { roomCode, edgeId: parseInt(edgeIdInput, 10) });
      setEdgeIdInput('');
    }
  };

  const handleBuildCity = () => {
    if (socket && roomCode && cityNodeIdInput.trim() !== '') {
      socket.emit('build_city', { roomCode, nodeId: parseInt(cityNodeIdInput, 10) });
      setCityNodeIdInput('');
    }
  };

  const handleBuyDevCard = () => {
    if (socket && roomCode) {
      socket.emit('buy_dev_card', { roomCode });
    }
  };

  const handleMoveRobber = () => {
    if (socket && roomCode && robberHexInput.trim() !== '') {
      socket.emit('move_robber', { roomCode, hexId: parseInt(robberHexInput, 10) });
      setRobberHexInput('');
    }
  };

  const handleStealCard = () => {
    if (socket && roomCode && stealVictimId) {
      socket.emit('steal_card', { roomCode, victimId: stealVictimId });
      setStealVictimId('');
    }
  };

  const handlePlayDevCard = (type: string) => {
    if (type === 'Knight') {
      socket?.emit('play_dev_card', { roomCode, type: 'Knight' });
    } else if (type === 'Road Building') {
      socket?.emit('play_dev_card', { roomCode, type: 'Road Building' });
    } else if (type === 'Monopoly') {
      setShowMonopolyModal(true);
    } else if (type === 'Year of Plenty') {
      setShowYOPModal(true);
    }
  };

  const handleConfirmMonopoly = () => {
    socket?.emit('play_dev_card', { roomCode, type: 'Monopoly', resource1: monoRes });
    setShowMonopolyModal(false);
  };

  const handleConfirmYOP = () => {
    socket?.emit('play_dev_card', { roomCode, type: 'Year of Plenty', resource1: yopRes1, resource2: yopRes2 });
    setShowYOPModal(false);
  };

  const handleDiscardChange = (res: string, delta: number) => {
    setDiscardSelection(prev => {
      const current = prev[res] || 0;
      const next = current + delta;
      
      if (next < 0) return prev;
      
      const myData = socket && gameState?.players ? gameState.players.find(p => p.id === socket.id) : null;
      const invCount = myData?.inventory.filter(r => r === res).length || 0;
      if (next > invCount) return prev;
      
      return { ...prev, [res]: next };
    });
  };

  const handleSubmitDiscard = () => {
    if (socket && roomCode) {
      const resources: string[] = [];
      Object.entries(discardSelection).forEach(([res, count]) => {
        for (let i = 0; i < count; i++) resources.push(res);
      });
      socket.emit('submit_discard', { roomCode, discardedResources: resources });
      setDiscardSelection({ Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 });
    }
  };

  const handleProposeTrade = () => {
    if (socket && roomCode && tradeTargetId) {
      socket.emit('propose_trade', {
        roomCode,
        targetId: tradeTargetId,
        offerResource: offerRes,
        offerAmount: offerAmt,
        requestResource: reqRes,
        requestAmount: reqAmt
      });
      setShowTradeMenu(false);
      setError('Trade offer sent!');
    }
  };

  const handleMaritimeTrade = () => {
    if (socket && roomCode && gameState) {
      const myData = gameState.players.find(p => p.id === socket.id);
      if (myData) {
        const rate = (myData as any).tradeRates ? (myData as any).tradeRates[offerRes] || 4 : 4;
        const hasCount = myData.inventory.filter(r => r === offerRes).length;
        if (hasCount < rate) {
          setError(`You need ${rate} ${offerRes} to trade.`);
          return;
        }
        socket.emit('maritime_trade', {
          roomCode,
          giveResource: offerRes,
          getResource: reqRes
        });
        setShowTradeMenu(false);
      }
    }
  };

  const handleAcceptTrade = () => {
    if (socket && roomCode && incomingTrade) {
      socket.emit('accept_trade', {
        roomCode,
        proposerId: incomingTrade.proposerId,
        offerResource: incomingTrade.offerRes,
        offerAmount: incomingTrade.offerAmt,
        requestResource: incomingTrade.reqRes,
        requestAmount: incomingTrade.reqAmt
      });
      setIncomingTrade(null);
    }
  };

  const handleRejectTrade = () => {
    if (socket && roomCode && incomingTrade) {
      socket.emit('reject_trade', {
        roomCode,
        proposerId: incomingTrade.proposerId
      });
      setIncomingTrade(null);
    }
  };

  const handleUndo = () => {
    if (socket && roomCode) {
      socket.emit('undo_last_action', { roomCode });
    }
  };

  if (joined) {
    if (!gameState) {
      return (
        <div className="min-h-screen bg-indigo-900 text-white flex flex-col items-center justify-center p-6 portrait-optimizations">
          <div className="bg-indigo-800 p-8 rounded-3xl shadow-2xl border-2 border-indigo-600 text-center w-full max-w-sm">
            <h2 className="text-4xl font-bold mb-4 text-green-400">You're In!</h2>
            <p className="text-xl text-indigo-200 mb-8">Waiting for host to start...</p>
          </div>
        </div>
      );
    }

    const activePlayer = gameState.players ? gameState.players[gameState.activePlayerIndex] : null;
    
    const isActivePlayer = socket && activePlayer?.id === socket.id;
    const activePlayerName = activePlayer?.name || 'Unknown';
    const myData = socket && gameState.players ? gameState.players.find(p => p.id === socket.id) : null;

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-6 portrait-optimizations">
        <header className="w-full max-w-sm flex justify-between items-center mb-8 mt-4">
          <h1 className="text-3xl font-black text-yellow-500 tracking-tight">CATAN</h1>
          <div className="bg-slate-800 px-4 py-1 rounded-lg border border-slate-700">
            <span className="text-sm font-bold text-slate-300">Room: {roomCode}</span>
          </div>
        </header>

        <div className="w-full max-w-sm flex-1 flex flex-col items-center">
          {gameOver && (
            <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-6 backdrop-blur-sm">
              <div className="bg-gradient-to-b from-yellow-500 to-yellow-700 p-1 rounded-3xl shadow-[0_0_100px_rgba(234,179,8,0.5)] w-full max-w-sm animate-bounce">
                <div className="bg-slate-900 rounded-3xl p-8 flex flex-col items-center border border-yellow-500/50">
                  <div className="text-6xl mb-4">🏆</div>
                  <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mb-2 uppercase tracking-widest text-center">Victory!</h2>
                  <p className="text-white text-xl text-center mb-6">
                    <span className="font-bold text-yellow-400 text-3xl">{gameOver.winnerName}</span><br/>
                    has won the game with <span className="font-black text-emerald-400">{gameOver.score}</span> VP!
                  </p>
                </div>
              </div>
            </div>
          )}
          {incomingTrade && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
              <div className="bg-slate-800 rounded-3xl p-6 border-2 border-indigo-500 shadow-2xl w-full max-w-sm">
                <h2 className="text-2xl font-bold text-yellow-400 mb-4 text-center uppercase tracking-widest">Trade Offer</h2>
                <p className="text-slate-300 text-center mb-6">
                  <strong className="text-indigo-400">{incomingTrade.proposerName}</strong> wants to give you <br/>
                  <strong className="text-green-400 text-2xl">{incomingTrade.offerAmt} {incomingTrade.offerRes}</strong><br/>
                  for your <br/>
                  <strong className="text-red-400 text-2xl">{incomingTrade.reqAmt} {incomingTrade.reqRes}</strong>.
                </p>
                <div className="flex space-x-4">
                  <button onClick={handleRejectTrade} className="w-1/2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl shadow-lg transition">REJECT</button>
                  <button onClick={handleAcceptTrade} className="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg transition">ACCEPT</button>
                </div>
              </div>
            </div>
          )}

          {showMonopolyModal && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
              <div className="bg-slate-800 rounded-3xl p-6 border-2 border-indigo-500 shadow-2xl w-full max-w-sm">
                <h2 className="text-2xl font-bold text-yellow-400 mb-4 text-center uppercase tracking-widest">Monopoly</h2>
                <p className="text-slate-300 text-center mb-6">Choose 1 resource to steal from everyone.</p>
                <select value={monoRes} onChange={e => setMonoRes(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white mb-6">
                  {['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="flex space-x-4">
                  <button onClick={() => setShowMonopolyModal(false)} className="w-1/2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl shadow-lg transition">CANCEL</button>
                  <button onClick={handleConfirmMonopoly} className="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg transition">STEAL</button>
                </div>
              </div>
            </div>
          )}

          {showYOPModal && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
              <div className="bg-slate-800 rounded-3xl p-6 border-2 border-green-500 shadow-2xl w-full max-w-sm">
                <h2 className="text-2xl font-bold text-green-400 mb-4 text-center uppercase tracking-widest">Year of Plenty</h2>
                <p className="text-slate-300 text-center mb-6">Choose 2 free resources from the bank.</p>
                <select value={yopRes1} onChange={e => setYopRes1(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white mb-3">
                  {['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={yopRes2} onChange={e => setYopRes2(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white mb-6">
                  {['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="flex space-x-4">
                  <button onClick={() => setShowYOPModal(false)} className="w-1/2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl shadow-lg transition">CANCEL</button>
                  <button onClick={handleConfirmYOP} className="w-1/2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg transition">CLAIM</button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="w-full bg-red-900/90 border-2 border-red-500 text-red-100 font-bold p-4 rounded-2xl mb-6 shadow-xl flex justify-between items-center animate-pulse">
              <span>{error}</span>
              <button onClick={() => setError('')} className="bg-red-950 px-3 py-1 rounded-lg text-red-300 hover:text-white">OK</button>
            </div>
          )}

          {/* Turn Status Area */}
          <div className="bg-slate-900 w-full p-6 rounded-3xl border border-slate-700 shadow-xl mb-8 flex flex-col items-center">
            {gameState.turnPhase === 'DISCARD' ? (() => {
              const requiredAmount = gameState.discardingPlayers[socket?.id || ''];
              if (requiredAmount === undefined) {
                return (
                  <div className="w-full bg-slate-800 rounded-3xl p-6 border border-slate-700 shadow-2xl text-center animate-pulse">
                    <p className="text-xl font-bold text-slate-300">Waiting for other players to discard...</p>
                  </div>
                );
              }
              
              const selectedCount = Object.values(discardSelection).reduce((a, b) => a + b, 0);
              const isReady = selectedCount === requiredAmount;

              return (
                <div className="w-full bg-red-900/40 rounded-3xl p-6 border-2 border-red-500 shadow-2xl">
                  <h3 className="text-xl font-bold text-red-400 mb-2 uppercase tracking-widest text-center">Discard Cards</h3>
                  <p className="text-slate-300 text-center mb-6">You must discard <span className="font-bold text-white text-xl">{requiredAmount}</span> cards. Selected: <span className={isReady ? "text-green-400 font-bold" : "text-yellow-400 font-bold"}>{selectedCount}</span></p>
                  
                  <div className="grid grid-cols-1 gap-3 mb-6">
                    {['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'].map(res => {
                      const have = myData?.inventory.filter(r => r === res).length || 0;
                      if (have === 0) return null;
                      const selected = discardSelection[res] || 0;
                      
                      return (
                        <div key={res} className="bg-slate-900 rounded-xl p-3 flex justify-between items-center border border-slate-700">
                          <span className="font-semibold text-slate-200">{res} (Have: {have})</span>
                          <div className="flex items-center space-x-3">
                            <button onClick={() => handleDiscardChange(res, -1)} className="w-8 h-8 bg-slate-700 rounded-full text-white font-bold hover:bg-slate-600">-</button>
                            <span className="w-6 text-center font-bold text-white">{selected}</span>
                            <button onClick={() => handleDiscardChange(res, 1)} className="w-8 h-8 bg-slate-700 rounded-full text-white font-bold hover:bg-slate-600">+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <button 
                    onClick={handleSubmitDiscard} 
                    disabled={!isReady}
                    className={`w-full font-black text-lg py-3 rounded-xl shadow-md transition ${isReady ? 'bg-red-600 hover:bg-red-500 text-white transform hover:-translate-y-1' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                  >
                    SUBMIT DISCARD
                  </button>
                </div>
              );
            })() : isActivePlayer ? (
              <>
                <h2 className="text-2xl font-bold text-white mb-2">It's your turn!</h2>
                {gameState.turnPhase === 'MOVE_ROBBER' ? (
                  <div className="w-full mt-4 bg-slate-800 rounded-3xl p-6 border-2 border-indigo-500 shadow-2xl">
                    <h3 className="text-xl font-bold text-indigo-400 mb-2 uppercase tracking-widest text-center">Move the Robber</h3>
                    <p className="text-slate-300 text-center mb-6 text-sm">Check the TV board for Hex IDs.</p>
                    <input 
                      type="number" min="0" max="18" value={robberHexInput} onChange={(e) => setRobberHexInput(e.target.value)} placeholder="Hex ID (0-18)"
                      className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-4 text-white text-center text-xl font-black mb-4 focus:outline-none focus:border-indigo-500"
                    />
                    <button onClick={handleMoveRobber} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg py-3 rounded-xl shadow-md transition transform hover:-translate-y-1">
                      CONFIRM MOVE
                    </button>
                  </div>
                ) : gameState.turnPhase === 'STEAL_CARD' ? (
                  <div className="w-full mt-4 bg-slate-800 rounded-3xl p-6 border-2 border-purple-500 shadow-2xl">
                    <h3 className="text-xl font-bold text-purple-400 mb-6 uppercase tracking-widest text-center border-b border-slate-700 pb-3">Steal a Card</h3>
                    <select value={stealVictimId} onChange={e => setStealVictimId(e.target.value)} className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-4 text-white text-xl font-black mb-4 focus:outline-none focus:border-purple-500">
                      <option value="">-- Select Victim --</option>
                      {gameState.robberVictims.map(vid => {
                        const vPlayer = gameState.players.find(p => p.id === vid);
                        return vPlayer ? <option key={vid} value={vid}>{vPlayer.name} ({vPlayer.inventory.length} cards)</option> : null;
                      })}
                    </select>
                    <button onClick={handleStealCard} disabled={!stealVictimId} className={`w-full font-black text-lg py-3 rounded-xl shadow-md transition ${stealVictimId ? 'bg-purple-600 hover:bg-purple-500 text-white transform hover:-translate-y-1' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                      STEAL
                    </button>
                  </div>
                ) : gameState.turnPhase === 'ROAD_BUILDING_CARD' ? (
                  <div className="w-full mt-4 bg-slate-800 rounded-3xl p-6 border-2 border-emerald-500 shadow-2xl">
                    <h3 className="text-xl font-bold text-emerald-400 mb-2 uppercase tracking-widest text-center">Road Building</h3>
                    <p className="text-slate-300 text-center mb-6 text-sm">Place 2 free roads! ({gameState.roadBuildingRoadsPlaced || 0} / 2 placed)</p>
                    <input 
                      type="number" value={edgeIdInput} onChange={(e) => setEdgeIdInput(e.target.value)} placeholder="Edge ID"
                      className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-4 text-white text-center text-xl font-black mb-4 focus:outline-none focus:border-emerald-500"
                    />
                    <button onClick={handleBuildRoad} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg py-3 rounded-xl shadow-md transition transform hover:-translate-y-1">
                      BUILD FREE ROAD
                    </button>
                  </div>
                ) : gameState.turnPhase === 'SETUP' ? (() => {
                  const pState = gameState.setupPhaseState && socket?.id ? gameState.setupPhaseState[socket.id] : null;
                  const needsSettlement = !pState || !pState.settlement;
                  const needsRoad = !pState || !pState.road;
                  
                  return (
                    <div className="w-full mt-4 bg-slate-800 rounded-3xl p-6 border border-slate-700 shadow-2xl">
                      <h3 className="text-xl font-bold text-yellow-500 mb-6 uppercase tracking-widest text-center border-b border-slate-700 pb-3">Setup Phase</h3>
                      {needsSettlement && (
                        <div className="mb-4">
                          <p className="text-slate-300 font-bold mb-2 uppercase text-sm">1. Place Settlement</p>
                          <input 
                            type="number" value={nodeIdInput} onChange={(e) => setNodeIdInput(e.target.value)} placeholder="Node ID (0-53)"
                            className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-4 text-white text-center text-xl font-black mb-3 focus:outline-none focus:border-indigo-500"
                          />
                          <button onClick={handleBuildSettlement} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg py-3 rounded-xl shadow-md transition transform hover:-translate-y-1">
                            BUILD SETTLEMENT
                          </button>
                        </div>
                      )}
                      {!needsSettlement && needsRoad && (
                        <div className="mb-4">
                          <p className="text-slate-300 font-bold mb-2 uppercase text-sm">2. Place Road</p>
                          <input 
                            type="number" value={edgeIdInput} onChange={(e) => setEdgeIdInput(e.target.value)} placeholder="Edge ID (0-71)"
                            className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-4 text-white text-center text-xl font-black mb-3 focus:outline-none focus:border-indigo-500"
                          />
                          <button onClick={handleBuildRoad} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg py-3 rounded-xl shadow-md transition transform hover:-translate-y-1">
                            BUILD ROAD
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })() : gameState.turnPhase === 'waiting_for_roll' ? (
                  <button
                    onClick={handleRollDice}
                    className="w-full mt-4 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-black text-3xl py-8 rounded-2xl shadow-[0_0_40px_rgba(234,179,8,0.4)] transform transition hover:-translate-y-2 active:translate-y-0 active:shadow-none"
                  >
                    ROLL DICE
                  </button>
                ) : (
                  <div className="w-full mt-4 flex flex-col space-y-4">
                    {showBuildMenu ? (
                      <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700 shadow-2xl flex flex-col space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                          <h3 className="text-xl font-bold text-yellow-500 uppercase tracking-widest">Build Menu</h3>
                          <button onClick={() => setShowBuildMenu(false)} className="text-slate-400 hover:text-white font-bold text-3xl leading-none">&times;</button>
                        </div>
                        
                        <div>
                          <p className="text-sm font-bold text-blue-400 mb-1 tracking-wider uppercase">Build Settlement</p>
                          <p className="text-[11px] text-slate-400 mb-3">(1 Wood, 1 Brick, 1 Sheep, 1 Wheat)</p>
                          <div className="flex space-x-3">
                            <input type="number" value={nodeIdInput} onChange={(e) => setNodeIdInput(e.target.value)} placeholder="Node ID" className="w-1/2 bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-center focus:outline-none focus:border-blue-500 font-bold text-lg" />
                            <button onClick={handleBuildSettlement} className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow transition transform hover:-translate-y-1 active:translate-y-0 text-lg">BUILD</button>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-bold text-blue-400 mb-1 tracking-wider uppercase">Build Road</p>
                          <p className="text-[11px] text-slate-400 mb-3">(1 Wood, 1 Brick)</p>
                          <div className="flex space-x-3">
                            <input type="number" value={edgeIdInput} onChange={(e) => setEdgeIdInput(e.target.value)} placeholder="Edge ID" className="w-1/2 bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-center focus:outline-none focus:border-blue-500 font-bold text-lg" />
                            <button onClick={handleBuildRoad} className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow transition transform hover:-translate-y-1 active:translate-y-0 text-lg">BUILD</button>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-bold text-blue-400 mb-1 tracking-wider uppercase">Upgrade City</p>
                          <p className="text-[11px] text-slate-400 mb-3">(3 Ore, 2 Wheat)</p>
                          <div className="flex space-x-3">
                            <input type="number" value={cityNodeIdInput} onChange={(e) => setCityNodeIdInput(e.target.value)} placeholder="Node ID" className="w-1/2 bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-center focus:outline-none focus:border-blue-500 font-bold text-lg" />
                            <button onClick={handleBuildCity} className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow transition transform hover:-translate-y-1 active:translate-y-0 text-lg">UPGRADE</button>
                          </div>
                        </div>
                      </div>
                    ) : showTradeMenu ? (
                      <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700 shadow-2xl flex flex-col space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                          <h3 className="text-xl font-bold text-yellow-500 uppercase tracking-widest">Trade</h3>
                          <button onClick={() => setShowTradeMenu(false)} className="text-slate-400 hover:text-white font-bold text-3xl leading-none">&times;</button>
                        </div>
                        
                        <div className="flex space-x-2 bg-slate-900 rounded-xl p-1 mb-2">
                          <button onClick={() => setTradeTab('player')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${tradeTab === 'player' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>PLAYER</button>
                          <button onClick={() => setTradeTab('maritime')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${tradeTab === 'maritime' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>MARITIME</button>
                        </div>

                        {tradeTab === 'player' ? (
                          <>
                            <div className="flex space-x-2">
                              <div className="w-1/2">
                                <p className="text-xs text-slate-400 mb-1 uppercase">Give</p>
                                <select value={offerRes} onChange={e => setOfferRes(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white mb-2">
                                  {['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'].map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <input type="number" min="1" value={offerAmt} onChange={e => setOfferAmt(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-center" />
                              </div>
                              <div className="w-1/2">
                                <p className="text-xs text-slate-400 mb-1 uppercase">Receive</p>
                                <select value={reqRes} onChange={e => setReqRes(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white mb-2">
                                  {['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'].map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <input type="number" min="1" value={reqAmt} onChange={e => setReqAmt(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-center" />
                              </div>
                            </div>

                            <div>
                              <p className="text-xs text-slate-400 mb-1 uppercase">Target Player</p>
                              <select value={tradeTargetId} onChange={e => setTradeTargetId(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white">
                                <option value="">-- Select Player --</option>
                                {gameState.players.filter(p => p.id !== socket?.id).map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>

                            <button onClick={handleProposeTrade} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl shadow-lg transition mt-2">
                              SEND OFFER
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="bg-slate-900 rounded-xl p-3 border border-slate-700 mb-2">
                              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 border-b border-slate-800 pb-1">Your Exchange Rates</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'].map(res => {
                                  const rate = (myData as any)?.tradeRates?.[res] || 4;
                                  const isSpecial = rate < 4;
                                  return (
                                    <div key={res} className={`flex justify-between px-2 py-1 rounded ${isSpecial ? 'bg-indigo-900/50 text-indigo-300 font-bold' : 'text-slate-300'}`}>
                                      <span>{res}</span>
                                      <span>{rate}:1</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex space-x-2 items-end">
                              <div className="w-[45%]">
                                <p className="text-xs text-slate-400 mb-1 uppercase">Give ({(myData as any)?.tradeRates?.[offerRes] || 4})</p>
                                <select value={offerRes} onChange={e => setOfferRes(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-bold">
                                  {['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'].map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                              </div>
                              <div className="w-[10%] text-center pb-3 text-slate-500 font-black">➡</div>
                              <div className="w-[45%]">
                                <p className="text-xs text-slate-400 mb-1 uppercase">Get (1)</p>
                                <select value={reqRes} onChange={e => setReqRes(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-bold">
                                  {['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'].map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                              </div>
                            </div>
                            <button 
                              onClick={handleMaritimeTrade} 
                              disabled={(myData?.inventory.filter(r => r === offerRes).length || 0) < ((myData as any)?.tradeRates?.[offerRes] || 4)}
                              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 rounded-xl shadow-lg transition mt-2">
                              TRADE WITH BANK
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setShowBuildMenu(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition transform hover:-translate-y-1 active:translate-y-0 text-xl">
                          BUILD
                        </button>
                        <button onClick={() => setShowTradeMenu(true)} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl shadow-lg transition transform hover:-translate-y-1 active:translate-y-0 text-xl">
                          TRADE
                        </button>
                        <button onClick={handleBuyDevCard} className="col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg transition transform hover:-translate-y-1 active:translate-y-0 text-xl">
                          BUY DEV CARD (1 Sheep, 1 Wheat, 1 Ore)
                        </button>
                        <button onClick={handleUndo} className="col-span-2 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl shadow-lg transition transform hover:-translate-y-1 active:translate-y-0 text-lg uppercase tracking-wider">
                          UNDO LAST ACTION
                        </button>
                      </div>
                    )}
                    <button onClick={handleEndTurn} className="w-full bg-red-600 hover:bg-red-500 text-white font-black text-xl py-4 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.4)] transition transform hover:-translate-y-1 active:translate-y-0 mt-2">
                      END TURN
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4 animate-pulse">
                <p className="text-slate-400 text-lg">Waiting for</p>
                <p className="text-3xl font-bold text-indigo-400 mt-1">{activePlayerName}</p>
                <p className="text-slate-500 text-sm mt-2">to play their turn...</p>
              </div>
            )}
          </div>

          {/* Secret Inventory */}
          {myData && (
            <div className="w-full bg-slate-800 rounded-3xl p-6 border border-slate-700 mt-4">
              <h3 className="text-xl font-bold text-slate-300 mb-4 border-b border-slate-700 pb-2">My Hand</h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'].map(res => {
                  const count = myData.inventory.filter(i => i === res).length;
                  return (
                    <div key={res} className="bg-slate-900 rounded-xl p-3 flex justify-between items-center border border-slate-700 shadow-inner">
                      <span className={`font-semibold ${count > 0 ? 'text-slate-200' : 'text-slate-500'}`}>{res}</span>
                      <span className={`${count > 0 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-600'} font-black px-3 py-1 rounded-lg`}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>

              <h3 className="text-lg font-bold text-slate-300 mb-3 border-b border-slate-700 pb-2">Development Cards</h3>
              {myData.devCards && myData.devCards.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {myData.devCards.map((card, idx) => {
                    const isPlayable = isActivePlayer && !gameState.hasPlayedDevCardThisTurn && card !== 'Victory Point' && card !== 'Hidden VP' && (gameState.turnPhase === 'main_action' || (gameState.turnPhase === 'waiting_for_roll' && card === 'Knight'));
                    return (
                      <div key={idx} className="bg-emerald-900/40 rounded-xl p-3 flex justify-between items-center border border-emerald-700 shadow-inner">
                        <span className="font-semibold text-emerald-200 uppercase tracking-wider text-sm">{card}</span>
                        {isPlayable && (
                          <button onClick={() => handlePlayDevCard(card)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1 px-3 rounded shadow">PLAY</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 italic text-center">No development cards.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 portrait-optimizations">
      <div className="w-full max-w-sm">
        <header className="text-center mb-10">
          <h1 className="text-5xl font-extrabold tracking-tight text-yellow-400 mb-2 drop-shadow-md">
            CATAN
          </h1>
          <p className="text-lg text-slate-400">Mobile Controller</p>
        </header>

        <form onSubmit={handleJoin} className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm text-center">
              {error}
            </div>
          )}
          
          <div className="mb-6">
            <label htmlFor="roomCode" className="block text-sm font-medium text-slate-400 mb-2 uppercase tracking-wide">
              Room Code
            </label>
            <input
              type="text"
              id="roomCode"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={4}
              placeholder="ABCD"
              className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl px-4 py-4 text-center text-3xl font-bold tracking-[0.2em] text-white focus:outline-none focus:border-yellow-400 transition-colors uppercase"
              required
            />
          </div>

          <div className="mb-8">
            <label htmlFor="name" className="block text-sm font-medium text-slate-400 mb-2 uppercase tracking-wide">
              Your Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name..."
              className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl px-4 py-3 text-lg text-white focus:outline-none focus:border-indigo-400 transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold text-xl py-4 rounded-xl shadow-lg transform transition hover:-translate-y-1 active:translate-y-0"
          >
            JOIN GAME
          </button>
        </form>
      </div>
    </div>
  );
}
