import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Player, PieceData, Move, Position, GameMode } from './types';
import { getBoardArray, getValidMoves } from './gameLogic';
import { playSound } from './audio';

const INITIAL_PIECES: PieceData[] = [];
let idCounter = 0;
for (let r = 0; r < 8; r++) {
  for (let c = 0; c < 8; c++) {
    if ((r + c) % 2 === 1) {
      if (r < 3) {
        INITIAL_PIECES.push({ id: `b${idCounter++}`, player: Player.BLACK, isKing: false, r, c, captured: false });
      } else if (r > 4) {
        INITIAL_PIECES.push({ id: `w${idCounter++}`, player: Player.WHITE, isKing: false, r, c, captured: false });
      }
    }
  }
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export default function App() {
  const [gameMode, setGameMode] = useState<'menu' | 'playing'>('menu');
  
  // Phase 1: State Variables
  const [humanColor, setHumanColor] = useState<Player | null>(null);
  
  // The "Double Lock" State System
  const [currentTurn, setCurrentTurn] = useState<Player>(Player.WHITE);
  const [isBoardLocked, setIsBoardLocked] = useState<boolean>(false);
  
  const [pieces, setPieces] = useState<PieceData[]>(INITIAL_PIECES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  
  // Drag state
  const [dragState, setDragState] = useState<{
    id: string;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
  } | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const piecesRef = useRef(pieces);
  const playAITurnRef = useRef<() => Promise<void>>();

  // Keep a mutable ref of pieces for async functions to avoid stale closures
  useEffect(() => {
    piecesRef.current = pieces;
  }, [pieces]);

  const boardArray = useMemo(() => getBoardArray(pieces), [pieces]);
  const validMoves = useMemo(() => getValidMoves(boardArray, currentTurn), [boardArray, currentTurn]);

  const resetInputState = useCallback(() => {
    setSelectedId(null);
    setDragState(null);
  }, []);

  // Phase 1: Initialization Logic
  const startGame = (color: Player) => {
    console.log(`[STATE] Starting game. Human chose: ${color}`);
    setHumanColor(color);
    setCurrentTurn(Player.WHITE); // White always goes first
    setPieces(INITIAL_PIECES);
    setWinner(null);
    setGameMode('playing');

    if (color === Player.BLACK) {
      console.log("[STATE] Human is Black. Board locked. AI (White) goes first.");
      setIsBoardLocked(true);
      setTimeout(() => {
        if (playAITurnRef.current) playAITurnRef.current();
      }, 600);
    } else {
      console.log("[STATE] Human is White. Board unlocked. Waiting for human input.");
      setIsBoardLocked(false);
    }
  };

  // Phase 2 & 3: The Centralized endTurn() Function with Strict Win Condition
  const endTurn = useCallback((playerWhoJustFinished: Player) => {
    const nextTurn = playerWhoJustFinished === Player.WHITE ? Player.BLACK : Player.WHITE;
    const currentPieces = piecesRef.current;

    // Phase 2: Strict Win Condition Engine
    const whiteCount = currentPieces.filter(p => p.player === Player.WHITE && !p.captured).length;
    const blackCount = currentPieces.filter(p => p.player === Player.BLACK && !p.captured).length;
    const nextMoves = getValidMoves(getBoardArray(currentPieces), nextTurn);

    if (whiteCount === 0 || (nextTurn === Player.WHITE && nextMoves.length === 0)) {
      console.log("[STATE] GAME OVER: Black Wins!");
      setWinner(Player.BLACK);
      setIsBoardLocked(true);
      return;
    }
    if (blackCount === 0 || (nextTurn === Player.BLACK && nextMoves.length === 0)) {
      console.log("[STATE] GAME OVER: White Wins!");
      setWinner(Player.WHITE);
      setIsBoardLocked(true);
      return;
    }

    // Step B: Switch Turn
    setCurrentTurn(nextTurn);

    if (nextTurn !== humanColor) {
      // Step D: Trigger AI
      console.log(`[STATE] Turn passed to ${nextTurn} (AI). Board locked.`);
      setIsBoardLocked(true);
      setTimeout(() => {
        if (playAITurnRef.current) playAITurnRef.current();
      }, 600);
    } else {
      // Step C: Unlock for Human
      console.log(`[STATE] Turn passed to ${nextTurn} (Human). Board unlocked.`);
      setIsBoardLocked(false);
      resetInputState();
    }
  }, [humanColor, resetInputState]);

  // Atomic move execution (handles multi-jumps internally)
  const executeMove = async (move: Move, pieceId: string, startingPieces: PieceData[]) => {
    console.log(`[STATE] Executing move for ${pieceId}. Board locked.`);
    setIsBoardLocked(true);
    resetInputState();

    let currentPieces = [...startingPieces];

    try {
      if (move.path.length > 0) {
        // Multi-jump animation
        for (const jump of move.path) {
          currentPieces = currentPieces.map(p => p.id === pieceId ? { ...p, r: jump.to.r, c: jump.to.c } : p);
          setPieces(currentPieces);
          playSound('move');
          await delay(300);

          currentPieces = currentPieces.map(p => 
            (p.r === jump.capturedPos.r && p.c === jump.capturedPos.c && !p.captured) 
              ? { ...p, captured: true } 
              : p
          );
          setPieces(currentPieces);
          playSound('capture');
          setShake(true);
          setTimeout(() => setShake(false), 200);
          await delay(150);
        }
      } else {
        // Normal move
        currentPieces = currentPieces.map(p => p.id === pieceId ? { ...p, r: move.to.r, c: move.to.c } : p);
        setPieces(currentPieces);
        playSound('move');
        await delay(300);
      }

      // Check promotion
      let promoted = false;
      currentPieces = currentPieces.map(p => {
        if (p.id === pieceId && !p.isKing) {
          if (p.player === Player.WHITE && p.r === 0) { promoted = true; return { ...p, isKing: true }; }
          if (p.player === Player.BLACK && p.r === 7) { promoted = true; return { ...p, isKing: true }; }
        }
        return p;
      });

      if (promoted) {
        setPieces(currentPieces);
        playSound('select');
        await delay(600);
      }

      return currentPieces;
    } catch (error) {
      console.error("[STATE] Error during move execution:", error);
      throw error;
    }
  };

  const handleHumanMove = async (move: Move, pieceId: string) => {
    // Strict Guard
    if (isBoardLocked) return;
    if (currentTurn !== humanColor) return;

    try {
      await executeMove(move, pieceId, piecesRef.current);
      endTurn(currentTurn);
    } catch (e) {
      console.error("[STATE] Human move failed", e);
      endTurn(currentTurn); // Failsafe
    }
  };

  // The Asynchronous AI Failsafe
  playAITurnRef.current = async () => {
    console.log("[STATE] AI Turn Started.");
    const aiColor = humanColor === Player.WHITE ? Player.BLACK : Player.WHITE;
    
    try {
      const latestPieces = piecesRef.current;
      const board = getBoardArray(latestPieces);
      const aiMoves = getValidMoves(board, aiColor);

      if (aiMoves.length > 0) {
        const randomMove = aiMoves[Math.floor(Math.random() * aiMoves.length)];
        const piece = latestPieces.find(p => p.r === randomMove.from.r && p.c === randomMove.from.c);
        
        if (piece) {
          await executeMove(randomMove, piece.id, latestPieces);
        }
      }
      
      console.log("[STATE] AI Move Completed Successfully.");
      endTurn(aiColor);
    } catch (error) {
      console.error("[STATE] AI Logic Failed or Crashed:", error);
      endTurn(aiColor); // Failsafe handoff
    }
  };

  // Strict Player Input Guard (Event Delegation)
  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameMode === 'menu' || winner) return;
    
    // Strict Guard
    if (isBoardLocked) {
      console.warn("[STATE] Input rejected: Board is locked.");
      return;
    }
    if (currentTurn !== humanColor) {
      console.warn(`[STATE] Input rejected: Not ${humanColor}'s turn.`);
      return;
    }

    if (!boardRef.current || !selectedId || dragState) return;

    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let c = Math.floor((x / rect.width) * 8);
    let r = Math.floor((y / rect.height) * 8);

    // Adjust coordinates if board is rotated
    if (humanColor === Player.BLACK) {
      c = 7 - c;
      r = 7 - r;
    }

    const piece = pieces.find(p => p.id === selectedId);
    if (!piece) return;

    const move = validMoves.find(m => m.from.r === piece.r && m.from.c === piece.c && m.to.r === r && m.to.c === c);
    if (move) {
      handleHumanMove(move, piece.id);
    } else {
      resetInputState();
    }
  };

  // --- Pointer Events for Drag & Drop ---
  const handlePointerDown = (e: React.PointerEvent, piece: PieceData) => {
    if (gameMode === 'menu' || winner) return;
    
    // Strict Guard
    if (isBoardLocked) return;
    if (currentTurn !== humanColor) return;
    if (piece.player !== currentTurn) return;

    const pieceMoves = validMoves.filter(m => m.from.r === piece.r && m.from.c === piece.c);
    if (pieceMoves.length === 0) return;

    playSound('select');
    setSelectedId(piece.id);
    
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragState({
      id: piece.id,
      startX: e.clientX,
      startY: e.clientY,
      curX: e.clientX,
      curY: e.clientY
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    setDragState(prev => prev ? { ...prev, curX: e.clientX, curY: e.clientY } : null);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState || !boardRef.current) return;
    
    // Strict Guard
    if (isBoardLocked) {
      setDragState(null);
      return;
    }
    
    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let c = Math.floor((x / rect.width) * 8);
    let r = Math.floor((y / rect.height) * 8);

    // Adjust coordinates if board is rotated
    if (humanColor === Player.BLACK) {
      c = 7 - c;
      r = 7 - r;
    }

    const piece = pieces.find(p => p.id === dragState.id);
    if (piece) {
      const move = validMoves.find(m => m.from.r === piece.r && m.from.c === piece.c && m.to.r === r && m.to.c === c);
      if (move) {
        handleHumanMove(move, piece.id);
      }
    }
    
    setDragState(null);
  };

  // Derived UI state
  const selectedPiece = pieces.find(p => p.id === selectedId);
  const activeMoves = selectedPiece ? validMoves.filter(m => m.from.r === selectedPiece.r && m.from.c === selectedPiece.c) : [];
  const forcedCapturePieces = validMoves.filter(m => m.path.length > 0).map(m => `${m.from.r},${m.from.c}`);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Header */}
      <div className="mb-8 text-center z-10">
        <h1 className="text-4xl md:text-5xl font-serif text-amber-500 tracking-widest drop-shadow-lg mb-2">SHASHKI</h1>
        <div className="flex items-center justify-center gap-4 text-xl font-medium text-stone-300">
          <span className={`px-4 py-1 rounded-full transition-colors ${currentTurn === Player.WHITE ? 'bg-amber-900/80 text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'opacity-50'}`}>
            White {humanColor === Player.WHITE ? '(You)' : '(AI)'}
          </span>
          <span>vs</span>
          <span className={`px-4 py-1 rounded-full transition-colors ${currentTurn === Player.BLACK ? 'bg-stone-800 text-stone-200 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'opacity-50'}`}>
            Black {humanColor === Player.BLACK ? '(You)' : '(AI)'}
          </span>
        </div>
      </div>

      {/* Board Container */}
      <div className="w-full max-w-[800px] overflow-x-auto pb-8 -mb-8 flex justify-center z-10">
        <div 
          className="relative min-w-[720px] w-full aspect-square p-4 md:p-8 bg-wood-border rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.1)]"
          data-shake={shake}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Phase 1: The Pre-Game Lobby & Color Selection */}
          {gameMode === 'menu' && (
            <div id="start-screen-overlay" className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md rounded-2xl transition-opacity duration-500">
              <div className="bg-wood-board p-10 rounded-2xl border-4 border-amber-900/60 text-center shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col gap-6 transform transition-transform">
                <h2 className="text-4xl font-serif text-amber-500 mb-6 drop-shadow-lg">Choose Your Color</h2>
                <button
                  onClick={() => startGame(Player.WHITE)}
                  className="px-8 py-4 bg-gradient-to-r from-amber-800 to-amber-700 hover:from-amber-700 hover:to-amber-600 text-amber-100 font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(0,0,0,0.5)] hover:shadow-[0_6px_20px_rgba(251,191,36,0.4)] hover:-translate-y-1 text-xl"
                >
                  Play as WHITE
                </button>
                <button
                  onClick={() => startGame(Player.BLACK)}
                  className="px-8 py-4 bg-gradient-to-r from-stone-800 to-stone-700 hover:from-stone-700 hover:to-stone-600 text-stone-100 font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(0,0,0,0.5)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.2)] hover:-translate-y-1 text-xl"
                >
                  Play as BLACK
                </button>
              </div>
            </div>
          )}

          <div 
            ref={boardRef}
            onClick={handleBoardClick}
            className={`w-full h-full grid grid-cols-8 grid-rows-8 border-[12px] border-wood-board rounded-sm shadow-[inset_0_10px_20px_rgba(0,0,0,0.8)] relative bg-wood-light transition-transform duration-700 ${humanColor === Player.BLACK ? 'rotate-180' : ''}`}
          >
            {/* Render Squares */}
            {Array.from({ length: 64 }).map((_, i) => {
              const r = Math.floor(i / 8);
              const c = i % 8;
              const isDark = (r + c) % 2 === 1;
              const isHighlight = activeMoves.some(m => m.to.r === r && m.to.c === c);

              return (
                <div 
                  key={i} 
                  className={`relative w-full h-full ${isDark ? 'bg-wood-dark' : 'bg-wood-light'}`}
                >
                  {/* Ghost indicator for valid moves */}
                  {isHighlight && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-1/3 h-1/3 rounded-full bg-black/40 shadow-inner pointer-events-none" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Render Pieces */}
            {pieces.map(piece => {
              if (piece.captured) return null;

              const isSelected = selectedId === piece.id;
              const isDragged = dragState?.id === piece.id;
              const isForced = forcedCapturePieces.includes(`${piece.r},${piece.c}`);
              
              // Calculate position
              const style: React.CSSProperties = {
                left: `${piece.c * 12.5}%`,
                top: `${piece.r * 12.5}%`,
                width: '12.5%',
                height: '12.5%',
              };

              if (isDragged && dragState) {
                const isFlipped = humanColor === Player.BLACK;
                const deltaX = (dragState.curX - dragState.startX) * (isFlipped ? -1 : 1);
                const deltaY = (dragState.curY - dragState.startY) * (isFlipped ? -1 : 1);
                style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.1)`;
                style.zIndex = 50;
                style.transition = 'none';
              } else {
                // Bouncy tactile transition
                style.transition = 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                style.zIndex = isSelected ? 40 : 10;
              }

              return (
                <div
                  key={piece.id}
                  // Phase 3: Flex centering wrapper for the piece
                  className="absolute flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
                  style={style}
                  onPointerDown={(e) => handlePointerDown(e, piece)}
                >
                  <div 
                    className={`
                      relative rounded-full flex items-center justify-center
                      ${piece.player === Player.WHITE 
                        ? 'bg-gradient-to-br from-[#f3d5a2] to-[#b08d55] border-[3px] border-[#8b6b43]' 
                        : 'bg-gradient-to-br from-[#3a261c] to-[#110a07] border-[3px] border-[#0a0604]'}
                      ${isSelected && !isDragged ? 'ring-4 ring-amber-400/50' : ''}
                      ${isForced && !isSelected && !isBoardLocked ? 'animate-pulse shadow-[0_0_20px_8px_rgba(253,224,71,0.6)]' : ''}
                    `}
                    style={{
                      // Phase 3: Premium UI Scaling (85% size + heavy 3D shadow)
                      width: '85%',
                      height: '85%',
                      boxShadow: 'inset -4px -4px 8px rgba(0,0,0,0.5), 3px 3px 6px rgba(0,0,0,0.4)',
                      // Phase 1: Counter-rotate pieces if board is flipped
                      transform: humanColor === Player.BLACK ? 'rotate(-180deg)' : 'none',
                      transition: 'transform 0.3s ease'
                    }}
                  >
                    {/* Inner carved detail */}
                    <div className="absolute inset-[15%] rounded-full border border-black/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]" />
                    
                    {/* King Marker */}
                    {piece.isKing && (
                      <div key="king-marker" className="absolute inset-0 flex items-center justify-center animate-promote">
                        <svg viewBox="0 0 24 24" className="w-3/5 h-3/5 text-amber-400 opacity-90 drop-shadow-[0_3px_3px_rgba(0,0,0,0.9)]">
                          <path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Phase 2: Game Over Overlay */}
      {winner && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-wood-border p-8 rounded-2xl border-4 border-amber-900/50 text-center shadow-2xl transform animate-promote">
            <h2 className="text-5xl font-serif text-amber-500 mb-4">
              GAME OVER: {winner === Player.WHITE ? 'White' : 'Black'} Wins!
            </h2>
            <button 
              onClick={() => setGameMode('menu')}
              className="px-8 py-3 bg-amber-700 hover:bg-amber-600 text-amber-100 font-bold rounded-full transition-colors shadow-lg mt-4"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
