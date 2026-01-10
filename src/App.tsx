import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Board } from './components/Board.tsx';
import { MoveHistory } from './components/MoveHistory.tsx';
import { CapturedPieces } from './components/CapturedPieces.tsx';
import { MainMenu } from './components/MainMenu.tsx';
import { RotateCcw, Trophy, Crown, Swords, ArrowLeft, Copy, Check } from 'lucide-react';
import type{ PieceColor, PieceType, GameMode, Difficulty } from './types';
import { soundEngine } from './utils/sound';
import { getBestMove } from './utils/simpleEngine';
import clsx from 'clsx';
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:3001`, {
  autoConnect: false,
  reconnection: true,
  transports: ['websocket', 'polling'] // Prefer websocket, fall back to polling if needed (or force websocket: ['websocket'])
});

function App() {
  // View State
  const [view, setView] = useState<'menu' | 'game'>('menu');
  const [gameMode, setGameMode] = useState<GameMode>('friend');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  // Game State
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen()); 
  const [captured, setCaptured] = useState<{w: {type: PieceType, color: PieceColor}[], b: {type: PieceType, color: PieceColor}[]}>({w: [], b: []});
  
  // Online State
  const [roomId, setRoomId] = useState('');
  const [playerColor, setPlayerColor] = useState<PieceColor>('w');
  const [isOnlineGameStarted, setIsOnlineGameStarted] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Ref to prevent bot moving twice or during renders
  const isBotThinking = useRef(false);

  // Check for reconnection
  useEffect(() => {
    const handleConnect = () => {
      // If we have a roomId, try to rejoin upon reconnection
      if (roomId && gameMode === 'online') {
         console.log('Reconnecting to room:', roomId);
         socket.emit('join_room', roomId);
      }
    };
    
    socket.on('connect', handleConnect);
    return () => {
      socket.off('connect', handleConnect);
    };
  }, [roomId, gameMode]);

  const startGame = (mode: GameMode, diff?: Difficulty) => {
    setGameMode(mode);
    if (diff) setDifficulty(diff);
    resetGame();
    
    if (mode === 'online') {
       if (!socket.connected) socket.connect();
       // Don't switch view yet, wait for room selection
    } else {
       setView('game');
    }
  };

  const returnToMenu = () => {
    setView('menu');
    // Disconnect socket if leaving online mode
    if (gameMode === 'online') {
        socket.disconnect();
        setRoomId('');
        setIsOnlineGameStarted(false);
        setJoinRoomId('');
        setError('');
    }
  };

  const makeMove = useCallback((move: { from: string; to: string; promotion?: string }) => {
    try {
      // For online games, check turn
      if (gameMode === 'online' && game.turn() !== playerColor) {
        return false;
      }

      const result = game.move(move);
      if (result) {
        setFen(game.fen());
        
        // Handle Sounds
        if (game.isGameOver()) {
          soundEngine.playGameEnd();
        } else if (game.inCheck()) {
          soundEngine.playCheck();
        } else if (result.captured) {
          soundEngine.playCapture();
        } else {
          soundEngine.playMove();
        }

        // Handle Captures State
        if (result.captured) {
            setCaptured(prev => ({
                ...prev,
                [result.color]: [...prev[result.color], { type: result.captured as PieceType, color: result.color === 'w' ? 'b' : 'w' }]
            }));
        }
        
        if (gameMode === 'online') {
           socket.emit('move', { roomId, move, fen: game.fen() });
        }

        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }, [game, gameMode, playerColor, roomId]);

  // Bot Logic Effect
  useEffect(() => {
    if (gameMode === 'bot' && !game.isGameOver() && game.turn() === 'b' && !isBotThinking.current) {
      isBotThinking.current = true;
      
      // Small timeout to allow UI to render player's move first
      setTimeout(() => {
        const bestMoveSan = getBestMove(game, difficulty);
        if (bestMoveSan) {
          makeMove({ from: '', to: '', promotion: '' } as any); // Using internal chess.js move parser via string
          game.move(bestMoveSan); // Re-apply cleanly
          
          // Sync state
          setFen(game.fen());
          const history = game.history({ verbose: true });
          const lastMove = history[history.length - 1];

           // Re-run sound logic for bot (since we bypassed makeMove wrapper mostly)
           if (game.isGameOver()) {
            soundEngine.playGameEnd();
          } else if (game.inCheck()) {
            soundEngine.playCheck();
          } else if (lastMove.captured) {
            soundEngine.playCapture();
            setCaptured(prev => ({
              ...prev,
              [lastMove.color]: [...prev[lastMove.color], { type: lastMove.captured as PieceType, color: lastMove.color === 'w' ? 'b' : 'w' }]
            }));
          } else {
            soundEngine.playMove();
          }
        }
        isBotThinking.current = false;
      }, 500);
    }
  }, [fen, gameMode, difficulty, game, makeMove]);

  // Socket Logic
  useEffect(() => {
    socket.on('room_created', (id: string) => {
        setRoomId(id);
        setPlayerColor('w');
    });

    socket.on('game_start', ({ white, black, fen: serverFen }: { white: string; black: string, fen?: string }) => {
        setIsOnlineGameStarted(true);
        setView('game');
        
        // Determine color based on socket ID
        if (socket.id === black) {
            setPlayerColor('b');
        } else if (socket.id === white) {
             setPlayerColor('w');
        }

        // Apply server state if provided (useful for reconnections)
        if (serverFen) {
             game.load(serverFen);
             setFen(serverFen);
             // TODO: Ideally we should also reconstruct captured pieces from FEN or history here
        }
    });

    socket.on('move_received', ({ move, fen: newFen }: { move: { from: string; to: string; promotion?: string }; fen: string }) => {
        // Apply move from opponent
        try {
            game.move(move); 
            // OR use load(newFen) to be safer against desync, but move() allows animation/sound detection
            // Verify sync
            if (game.fen() !== newFen) {
                console.warn('FEN desync detected, correcting...');
                game.load(newFen);
            }
            setFen(game.fen());
            
            // Handle sounds
            if (game.isGameOver()) soundEngine.playGameEnd();
            else if (game.inCheck()) soundEngine.playCheck();
            else soundEngine.playMove();
        } catch(e) {
            console.error('Move received error:', e);
            game.load(newFen); // Fallback force sync
            setFen(newFen);
        }
    });

    socket.on('error', (msg: string) => {
        setError(msg);
    });

    return () => {
        socket.off('room_created');
        socket.off('game_start');
        socket.off('move_received');
        socket.off('error');
    };
  }, [game]);

  const createRoom = () => {
      socket.emit('create_room');
  };

  const joinRoom = () => {
      if (joinRoomId) {
          socket.emit('join_room', joinRoomId);
          setRoomId(joinRoomId);
      }
  };
    
  const copyRoomId = () => {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const resetGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setCaptured({w: [], b: []});
    isBotThinking.current = false;
    soundEngine.playMove(); 
  };

  const isGameOver = game.isGameOver();
  const turn = game.turn();
  const winner = game.isCheckmate() ? (turn === 'w' ? 'Black' : 'White') : null;
  const inCheck = game.inCheck();
  
  let drawReason = '';
  if (game.isDraw()) {
    if (game.isStalemate()) drawReason = 'Stalemate';
    else if (game.isThreefoldRepetition()) drawReason = 'Repetition';
    else if (game.isInsufficientMaterial()) drawReason = 'Insufficient Material';
    else drawReason = 'Draw';
  }

  let statusColor = "text-slate-200";
  let statusText = '';
  if (gameMode === 'online') {
      statusText = turn === playerColor ? "Your Turn" : "Opponent's Turn";
  } else {
      statusText = `${turn === 'w' ? "White's" : "Black's"} Turn`;
  }
  
  if (winner) {
    statusText = `Checkmate! ${winner} Wins!`;
    statusColor = "text-yellow-400";
  } else if (drawReason) {
    statusText = `Draw: ${drawReason}`;
    statusColor = "text-orange-300";
  } else if (inCheck) {
    statusText = `Check! ${turn === 'w' ? "White" : "Black"} to move.`;
    statusColor = "text-red-400";
  }

  const isFlipped = gameMode === 'online' && playerColor === 'b';

  // --- RENDER ---

  if (view === 'menu') {
    return (
      <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex flex-col items-center justify-center font-sans selection:bg-blue-500/30">
        {!roomId && !isOnlineGameStarted && gameMode === 'online' ? (
             <div className="w-full max-w-md p-6 bg-slate-800 rounded-xl border border-slate-700 shadow-xl animate-in fade-in zoom-in duration-300">
                <button 
                  onClick={() => setGameMode('friend')} 
                  className="mb-4 text-slate-400 hover:text-white flex items-center gap-2 text-sm"
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <h2 className="text-2xl font-bold mb-6 text-center">Online Multiplayer</h2>
                
                {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">{error}</div>}

                <div className="space-y-4">
                    <button 
                        onClick={createRoom}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all"
                    >
                        Create Room
                    </button>
                    
                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-slate-700"></div>
                        <span className="flex-shrink mx-4 text-slate-500 text-sm">Or Join</span>
                        <div className="flex-grow border-t border-slate-700"></div>
                    </div>

                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Enter Room ID" 
                            value={joinRoomId}
                            onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 font-mono tracking-wider"
                        />
                        <button 
                            onClick={joinRoom}
                            className="px-6 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all"
                        >
                            Join
                        </button>
                    </div>
                </div>
             </div>
        ) : roomId && !isOnlineGameStarted && gameMode === 'online' ? (
            <div className="w-full max-w-md p-8 bg-slate-800 rounded-xl border border-slate-700 shadow-xl animate-in fade-in zoom-in duration-300 text-center">
                 <h2 className="text-2xl font-bold mb-2">Room Created</h2>
                 <p className="text-slate-400 mb-6">Share this ID with your friend</p>
                 
                 <button 
                    onClick={copyRoomId}
                    className="w-full bg-slate-900 border border-slate-700 p-4 rounded-lg flex items-center justify-between mb-6 group hover:border-blue-500 transition-colors"
                 >
                    <span className="font-mono text-2xl font-bold tracking-widest text-blue-400">{roomId}</span>
                    {copied ? <Check className="text-green-500" /> : <Copy className="text-slate-500 group-hover:text-blue-500" />}
                 </button>

                 <div className="flex items-center justify-center gap-2 text-slate-500 text-sm animate-pulse">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Waiting for opponent to join...
                 </div>
                 
                 <button 
                  onClick={returnToMenu}
                  className="mt-8 text-slate-500 hover:text-white text-sm"
                 >
                  Cancel
                 </button>
            </div>
        ) : (
            <MainMenu onStartGame={startGame} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex flex-col items-center py-4 sm:py-8 px-4 font-sans selection:bg-blue-500/30">
      
      {/* Header */}
      <header className="mb-4 sm:mb-8 text-center space-y-1 relative w-full max-w-6xl">
        <button 
          onClick={returnToMenu}
          className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-2 hidden sm:flex items-center gap-1"
        >
          <ArrowLeft size={20} /> <span className="text-sm font-bold">Menu</span>
        </button>

        <div className="flex items-center justify-center gap-2 mb-1">
          <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 fill-yellow-500/20" />
          <h1 className="text-2xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-indigo-300 to-purple-300 tracking-tight">
            Grandmaster Chess
          </h1>
        </div>
        <p className="text-slate-500 text-xs sm:text-sm font-medium tracking-wide">
          {gameMode === 'bot' ? `VS BOT (${difficulty.toUpperCase()})` : 'PLAYER VS PLAYER'}
        </p>
      </header>

      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-6 items-start justify-center">
        
        {/* Main Game Area */}
        <div className="flex flex-col gap-3 w-full max-w-[550px] mx-auto lg:mx-0">
          
          {/* Top Player Info */}
          <div className="bg-slate-800/40 backdrop-blur-sm p-3 rounded-xl border border-slate-700/50 flex justify-between items-center shadow-lg">
             <div className="flex items-center gap-3">
               <div className={clsx("w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center border shadow-inner transition-colors", 
                  isFlipped ? "bg-white border-slate-200" : "bg-black border-slate-600"
               )}>
                  <div className={clsx("w-3 h-3 rounded-full", isFlipped ? "bg-black" : "bg-white shadow-[0_0_5px_rgba(255,255,255,0.5)]")} />
               </div>
               <div>
                  <div className="font-bold text-slate-200 leading-tight text-sm sm:text-base">
                    {gameMode === 'online' ? 'Opponent' : (gameMode === 'bot' ? 'Computer' : (isFlipped ? 'White' : 'Black'))}
                  </div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                     {gameMode === 'online' ? (isFlipped ? 'White' : 'Black') : (gameMode === 'bot' ? `Level: ${difficulty}` : 'Player 2')}
                  </div>
               </div>
             </div>
             <CapturedPieces pieces={isFlipped ? captured.b : captured.w} playerColor={isFlipped ? 'b' : 'w'} />
          </div>

          {/* The Board */}
          <div className="w-full shadow-2xl rounded-lg ring-1 ring-white/5">
            <Board 
              game={game} 
              onMove={makeMove} 
              orientation={gameMode === 'online' ? playerColor : "w"}
              isGameOver={isGameOver}
            />
          </div>

          {/* Bottom Player Info */}
          <div className="bg-slate-800/40 backdrop-blur-sm p-3 rounded-xl border border-slate-700/50 flex justify-between items-center shadow-lg">
             <div className="flex items-center gap-3">
               <div className={clsx("w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center border shadow-inner transition-colors", 
                  isFlipped ? "bg-black border-slate-600" : "bg-white border-slate-200"
               )}>
                  <div className={clsx("w-3 h-3 rounded-full", isFlipped ? "bg-white shadow-[0_0_5px_rgba(255,255,255,0.5)]" : "bg-black")} />
               </div>
               <div>
                  <div className="font-bold text-slate-200 leading-tight text-sm sm:text-base">
                    {gameMode === 'online' ? 'You' : (isFlipped ? 'Black' : 'White')}
                  </div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    {gameMode === 'online' ? (isFlipped ? 'Black' : 'White') : 'Player 1'}
                  </div>
               </div>
             </div>
             <CapturedPieces pieces={isFlipped ? captured.w : captured.b} playerColor={isFlipped ? 'w' : 'b'} />
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-3 mt-1">
             <button 
               onClick={returnToMenu}
               className="flex sm:hidden items-center justify-center gap-2 bg-slate-800 py-3 rounded-lg font-bold text-slate-400 border border-slate-700 hover:text-white"
             >
               <ArrowLeft size={16} />
               <span className="text-sm">Menu</span>
             </button>
             <button 
               onClick={resetGame}
               className={clsx(
                 "flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 py-3 rounded-lg font-bold transition-all text-slate-300 border border-slate-700 hover:border-slate-500 hover:text-white shadow-md active:scale-[0.98]",
                 "col-span-1 sm:col-span-2"
               )}
             >
               <RotateCcw size={16} />
               <span className="text-sm">Reset Game</span>
             </button>
          </div>
        </div>

        {/* Sidebar: Info & History */}
        <div className="w-full lg:w-80 flex flex-col gap-4 h-full shrink-0">
          
          {/* Game Status Card */}
          <div className={clsx(
            "p-5 rounded-xl border flex flex-col items-center justify-center text-center shadow-lg transition-all duration-300 relative overflow-hidden",
            isGameOver 
              ? "bg-gradient-to-br from-indigo-900/90 to-slate-900 border-indigo-500/50" 
              : inCheck 
                 ? "bg-gradient-to-br from-red-900/40 to-slate-900 border-red-500/30"
                 : "bg-slate-800/60 border-slate-700/50"
          )}>
            {/* Background effects */}
            {isGameOver && <div className="absolute inset-0 bg-indigo-500/10 animate-pulse pointer-events-none" />}
            {inCheck && !isGameOver && <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />}
            
            {isGameOver ? (
               <Trophy className="text-yellow-400 mb-2 w-10 h-10 drop-shadow-lg animate-bounce" />
            ) : inCheck ? (
               <Swords className="text-red-400 mb-2 w-10 h-10 drop-shadow-lg animate-pulse" />
            ) : (
               <div className={clsx("mb-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border shadow-sm", 
                  turn === 'w' ? "bg-white text-black border-white" : "bg-black text-white border-slate-600"
               )}>
                  Current Turn
               </div>
            )}
            
            <h2 className={clsx("text-2xl font-bold mb-1 tracking-tight drop-shadow-sm transition-colors duration-300", statusColor)}>
              {statusText}
            </h2>
            
            {!isGameOver && !inCheck && (
               <p className="text-slate-400 text-xs mt-1">
                 {turn === 'w' ? "White to move" : "Black to move"}
               </p>
            )}
          </div>

          {/* History Panel */}
          <div className="flex-1 min-h-[300px] lg:min-h-0 lg:h-[400px]">
             <MoveHistory history={game.history()} />
          </div>
          
        </div>
      </div>
    </div>
  );
}

export default App;
