import React, { useState, useRef, useEffect, useCallback } from 'react';
import "./App.css";
import { Upload, Play, RotateCcw, Share2, Volume2 } from 'lucide-react';
import { Toaster, toast } from 'sonner';

const GRAVITY = 0.7;
const JUMP_STRENGTH = -11;
const PIPE_WIDTH = 80;
const PIPE_GAP = 230; // Increased gap for better playability
const INITIAL_PIPE_SPEED = 3;
const SPEED_INCREASE_INTERVAL = 10000; // 10 seconds
const SPEED_INCREASE_AMOUNT = 0.4;
const MAX_PIPE_SPEED = 8;
const PLAYER_SIZE = 50;
const HIT_SOUND_DURATION = 3000;
const getInitialSpeed = (mobile) => (mobile ? INITIAL_PIPE_SPEED : INITIAL_PIPE_SPEED + 1);

function App() {
  const [gameState, setGameState] = useState('setup'); // 'setup', 'ready', 'playing', 'gameover'
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerImage, setPlayerImage] = useState(null); // No default - shows stylish bird
  const [obstacleImage, setObstacleImage] = useState('https://images.unsplash.com/photo-1662374162155-2552f45b9f37?crop=entropy&cs=srgb&fm=jpg&q=85&w=200');
  const [hitSound, setHitSound] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(3);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [isMobile, setIsMobile] = useState(false);

  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);
  const playerRef = useRef({ y: 250, velocity: 0 });
  const pipesRef = useRef([]);
  const scoreRef = useRef(0);
  const playerImgRef = useRef(null);
  const obstacleImgRef = useRef(null);
  const cloudsRef = useRef([]);
  const audioRef = useRef(null);
  const audioTimeoutRef = useRef(null);
  const pipeSpeedRef = useRef(3);
  const gameStartTimeRef = useRef(null);
  const speedIntervalRef = useRef(null);

  // Responsive canvas sizing
  useEffect(() => {
    const updateCanvasSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      if (mobile) {
        // Portrait mode for mobile - fill most of screen
        const width = Math.min(window.innerWidth - 32, 400);
        const height = Math.min(window.innerHeight - 200, 600);
        setCanvasSize({ width, height });
      } else {
        // Desktop - standard size
        setCanvasSize({ width: 800, height: 600 });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
      if (speedIntervalRef.current) {
        clearInterval(speedIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = playerImage;
    img.onload = () => {
      playerImgRef.current = img;
    };
  }, [playerImage]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = obstacleImage;
    img.onload = () => {
      obstacleImgRef.current = img;
    };
  }, [obstacleImage]);

  const handlePlayerImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPlayerImage(event.target.result);
        toast.success('Player image uploaded!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleObstacleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setObstacleImage(event.target.result);
        toast.success('Obstacle image uploaded!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSoundUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setHitSound(event.target.result);
        toast.success('Hit sound uploaded!');
      };
      reader.readAsDataURL(file);
    }
  };

  const playHitSound = useCallback(() => {
    if (hitSound) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
      
      const audio = new Audio(hitSound);
      audio.volume = 0.5;
      audioRef.current = audio;
      
      audio.play().catch(e => console.log('Audio play failed:', e));
      
      audioTimeoutRef.current = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      }, HIT_SOUND_DURATION);
    }
  }, [hitSound]);

  const initGame = () => {
    // Center player based on canvas height
    playerRef.current = { y: canvasSize.height / 2 - PLAYER_SIZE, velocity: 0 };
    pipesRef.current = [];
    scoreRef.current = 0;
    const initialSpeed = getInitialSpeed(isMobile);
    pipeSpeedRef.current = initialSpeed;
    setCurrentSpeed(initialSpeed);
    setScore(0);
    
    // Spread clouds across canvas width
    cloudsRef.current = [
      { x: canvasSize.width * 0.1, y: 80, size: 60, speed: 0.5 },
      { x: canvasSize.width * 0.4, y: 150, size: 80, speed: 0.3 },
      { x: canvasSize.width * 0.6, y: 100, size: 70, speed: 0.4 },
      { x: canvasSize.width * 0.9, y: 180, size: 90, speed: 0.35 }
    ];
  };

  const startGame = () => {
    initGame();
    setGameState('ready'); // Set to ready state, waiting for first click
    setShowResults(false);
  };

  const beginPlaying = useCallback(() => {
    // First pipe starts from right edge
    const groundHeight = isMobile ? 60 : 100;
    pipesRef.current = [{ 
      x: canvasSize.width, 
      topHeight: Math.random() * (canvasSize.height - PIPE_GAP - groundHeight - 100) + 60 
    }];
    gameStartTimeRef.current = Date.now();
    setGameState('playing');
    
    // Start speed increase interval
    speedIntervalRef.current = setInterval(() => {
      if (pipeSpeedRef.current < MAX_PIPE_SPEED) {
        pipeSpeedRef.current = Math.min(pipeSpeedRef.current + SPEED_INCREASE_AMOUNT, MAX_PIPE_SPEED);
        setCurrentSpeed(pipeSpeedRef.current);
      }
    }, SPEED_INCREASE_INTERVAL);
  }, [isMobile, canvasSize]);

  const endGame = useCallback(() => {
    playHitSound();
    if (speedIntervalRef.current) {
      clearInterval(speedIntervalRef.current);
      speedIntervalRef.current = null;
    }
    setGameState('gameover');
    setShowResults(true);
    if (scoreRef.current > highScore) {
      setHighScore(scoreRef.current);
    }
  }, [highScore, playHitSound]);

  const jump = useCallback(() => {
    // Softer jump on mobile for better control
    const jumpStrength = isMobile ? -6 : JUMP_STRENGTH;
    
    if (gameState === 'ready') {
      beginPlaying();
      playerRef.current.velocity = jumpStrength;
    } else if (gameState === 'playing') {
      playerRef.current.velocity = jumpStrength;
    }
  }, [gameState, beginPlaying, isMobile]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };

    const handleTouchStart = (e) => {
      if (gameState === 'ready' || gameState === 'playing') {
        e.preventDefault();
        jump();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('touchstart', handleTouchStart);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [jump, gameState]);

  // Ready state - shows canvas with player stationary, waiting for click
  useEffect(() => {
    if (gameState !== 'ready') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const groundHeight = isMobile ? 60 : 100;
    const playerSize = isMobile ? 40 : PLAYER_SIZE;

    const drawReadyScreen = () => {
      // Draw background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#87CEEB');
      bgGradient.addColorStop(0.7, '#B0E0E6');
      bgGradient.addColorStop(1, '#F0F8FF');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);
      
      // Draw clouds
      cloudsRef.current.forEach(cloud => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.size * 0.5, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size * 0.4, cloud.y - cloud.size * 0.2, cloud.size * 0.4, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size * 0.8, cloud.y, cloud.size * 0.5, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size * 0.6, cloud.y + cloud.size * 0.2, cloud.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw ground
      ctx.fillStyle = '#90EE90';
      ctx.fillRect(0, height - groundHeight, width, groundHeight);
      
      for (let i = 0; i < width; i += 30) {
        ctx.fillStyle = '#228B22';
        ctx.beginPath();
        ctx.arc(i, height - groundHeight, 15, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw player stationary
      ctx.save();
      ctx.translate(width / 4 + playerSize / 2, playerRef.current.y + playerSize / 2);
      if (playerImgRef.current) {
        ctx.beginPath();
        ctx.arc(0, 0, playerSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(
          playerImgRef.current,
          -playerSize / 2,
          -playerSize / 2,
          playerSize,
          playerSize
        );
      } else {
        // Stylish gradient bird with glow effect
        const birdGradient = ctx.createRadialGradient(0, 0, 5, 0, 0, playerSize / 2);
        birdGradient.addColorStop(0, '#FFD700');
        birdGradient.addColorStop(0.5, '#FF6B6B');
        birdGradient.addColorStop(1, '#EE5A24');
        
        ctx.shadowColor = '#FF6B6B';
        ctx.shadowBlur = 15;
        
        ctx.fillStyle = birdGradient;
        ctx.beginPath();
        ctx.arc(0, 0, playerSize / 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // Scale features for bird size
        const scale = playerSize / PLAYER_SIZE;
        
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(8 * scale, -5 * scale, 10 * scale, 12 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(10 * scale, -5 * scale, 5 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(12 * scale, -7 * scale, 2 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#FF9500';
        ctx.beginPath();
        ctx.moveTo(playerSize / 2 - 5 * scale, 0);
        ctx.lineTo(playerSize / 2 + 12 * scale, 3 * scale);
        ctx.lineTo(playerSize / 2 - 5 * scale, 8 * scale);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#C0392B';
        ctx.beginPath();
        ctx.ellipse(-5 * scale, 5 * scale, 12 * scale, 8 * scale, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Draw "Click to Start" message - responsive size
      const boxWidth = isMobile ? 200 : 300;
      const boxHeight = isMobile ? 70 : 100;
      const fontSize = isMobile ? 20 : 28;
      const subFontSize = isMobile ? 12 : 16;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(width / 2 - boxWidth / 2, height / 2 - boxHeight / 2, boxWidth, boxHeight);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeRect(width / 2 - boxWidth / 2, height / 2 - boxHeight / 2, boxWidth, boxHeight);
      
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('🎮 TAP TO START', width / 2, height / 2);
      ctx.font = `${subFontSize}px Arial`;
      ctx.fillText('Press SPACE or Click', width / 2, height / 2 + (isMobile ? 20 : 30));
    };

    drawReadyScreen();
  }, [gameState, isMobile, canvasSize]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Responsive sizing
    const groundHeight = isMobile ? 60 : 100;
    const playerSize = isMobile ? 40 : PLAYER_SIZE;
    const pipeWidth = isMobile ? 60 : PIPE_WIDTH;
    const pipeGap = isMobile ? 180 : PIPE_GAP;
    const pipeSpacing = isMobile ? 200 : 300;

    const drawCloud = (x, y, size) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.arc(x + size * 0.4, y - size * 0.2, size * 0.4, 0, Math.PI * 2);
      ctx.arc(x + size * 0.8, y, size * 0.5, 0, Math.PI * 2);
      ctx.arc(x + size * 0.6, y + size * 0.2, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawPipe = (x, y, pipeHeight, isTop) => {
      const gradient = ctx.createLinearGradient(x, 0, x + pipeWidth, 0);
      gradient.addColorStop(0, '#22c55e');
      gradient.addColorStop(0.5, '#16a34a');
      gradient.addColorStop(1, '#15803d');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, pipeWidth, pipeHeight);
      
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, pipeWidth, pipeHeight);
      
      const capHeight = isMobile ? 20 : 30;
      const capWidth = pipeWidth + 10;
      const capX = x - 5;
      
      if (isTop) {
        const capY = pipeHeight - capHeight;
        const capGradient = ctx.createLinearGradient(capX, capY, capX, capY + capHeight);
        capGradient.addColorStop(0, '#4ade80');
        capGradient.addColorStop(1, '#22c55e');
        ctx.fillStyle = capGradient;
        
        ctx.fillRect(capX, capY, capWidth, capHeight);
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 2;
        ctx.strokeRect(capX, capY, capWidth, capHeight);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(capX, capY + capHeight - 5, capWidth, 5);
      } else {
        const capGradient = ctx.createLinearGradient(capX, y, capX, y + capHeight);
        capGradient.addColorStop(0, '#22c55e');
        capGradient.addColorStop(1, '#16a34a');
        ctx.fillStyle = capGradient;
        
        ctx.fillRect(capX, y, capWidth, capHeight);
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 2;
        ctx.strokeRect(capX, y, capWidth, capHeight);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(capX, y, capWidth, 5);
      }
    };

    const gameLoop = () => {
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#87CEEB');
      bgGradient.addColorStop(0.7, '#B0E0E6');
      bgGradient.addColorStop(1, '#F0F8FF');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);
      
      cloudsRef.current.forEach(cloud => {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.size < 0) {
          cloud.x = width + cloud.size;
          cloud.y = Math.random() * (height * 0.4) + 50;
        }
        drawCloud(cloud.x, cloud.y, cloud.size);
      });

      ctx.fillStyle = '#90EE90';
      ctx.fillRect(0, height - groundHeight, width, groundHeight);
      
      for (let i = 0; i < width; i += 30) {
        ctx.fillStyle = '#228B22';
        ctx.beginPath();
        ctx.arc(i, height - groundHeight, 15, 0, Math.PI * 2);
        ctx.fill();
      }

      // Softer gravity on mobile for smoother control
      const gravity = isMobile ? 0.4 : GRAVITY;
      playerRef.current.velocity += gravity;
      playerRef.current.y += playerRef.current.velocity;

      if (playerRef.current.y + playerSize > height - groundHeight || playerRef.current.y < 0) {
        endGame();
        return;
      }

      pipesRef.current.forEach(pipe => {
        pipe.x -= pipeSpeedRef.current;
      });

      if (pipesRef.current.length === 0 || pipesRef.current[pipesRef.current.length - 1].x < width - pipeSpacing) {
        // More varied pipe heights
        const minTopHeight = 50;
        const maxTopHeight = height - pipeGap - groundHeight - 50;
        pipesRef.current.push({
          x: width,
          topHeight: Math.random() * (maxTopHeight - minTopHeight) + minTopHeight
        });
      }

      pipesRef.current = pipesRef.current.filter(pipe => pipe.x > -pipeWidth);

      pipesRef.current.forEach(pipe => {
        drawPipe(pipe.x, 0, pipe.topHeight, true);
        drawPipe(pipe.x, pipe.topHeight + pipeGap, height - pipe.topHeight - pipeGap - groundHeight, false);

        if (obstacleImgRef.current) {
          const imgSize = isMobile ? 40 : 60;
          ctx.save();
          ctx.beginPath();
          ctx.arc(pipe.x + pipeWidth / 2, pipe.topHeight - 15, imgSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(
            obstacleImgRef.current,
            pipe.x + pipeWidth / 2 - imgSize / 2,
            pipe.topHeight - 15 - imgSize / 2,
            imgSize,
            imgSize
          );
          ctx.restore();

          ctx.save();
          ctx.beginPath();
          ctx.arc(pipe.x + pipeWidth / 2, pipe.topHeight + pipeGap + 15, imgSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(
            obstacleImgRef.current,
            pipe.x + pipeWidth / 2 - imgSize / 2,
            pipe.topHeight + pipeGap + 15 - imgSize / 2,
            imgSize,
            imgSize
          );
          ctx.restore();
        }

        const playerLeft = width / 4;
        const playerRight = playerLeft + playerSize;
        const playerTop = playerRef.current.y;
        const playerBottom = playerTop + playerSize;

        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + pipeWidth;

        if (playerRight > pipeLeft && playerLeft < pipeRight) {
          if (playerTop < pipe.topHeight || playerBottom > pipe.topHeight + pipeGap) {
            endGame();
            return;
          }
        }

        if (pipe.x + pipeWidth < width / 4 && !pipe.scored) {
          pipe.scored = true;
          scoreRef.current += 1;
          setScore(scoreRef.current);
        }
      });

      // Draw player
      ctx.save();
      ctx.translate(width / 4 + playerSize / 2, playerRef.current.y + playerSize / 2);
      ctx.rotate(Math.min(playerRef.current.velocity * 0.05, 1.5));
      if (playerImgRef.current) {
        ctx.beginPath();
        ctx.arc(0, 0, playerSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(
          playerImgRef.current,
          -playerSize / 2,
          -playerSize / 2,
          playerSize,
          playerSize
        );
      } else {
        // Stylish gradient bird
        const birdGradient = ctx.createRadialGradient(0, 0, 5, 0, 0, playerSize / 2);
        birdGradient.addColorStop(0, '#FFD700');
        birdGradient.addColorStop(0.5, '#FF6B6B');
        birdGradient.addColorStop(1, '#EE5A24');
        
        ctx.shadowColor = '#FF6B6B';
        ctx.shadowBlur = 15;
        
        ctx.fillStyle = birdGradient;
        ctx.beginPath();
        ctx.arc(0, 0, playerSize / 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // Scale features
        const scale = playerSize / PLAYER_SIZE;
        
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(8 * scale, -5 * scale, 10 * scale, 12 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(10 * scale, -5 * scale, 5 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(12 * scale, -7 * scale, 2 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#FF9500';
        ctx.beginPath();
        ctx.moveTo(playerSize / 2 - 5 * scale, 0);
        ctx.lineTo(playerSize / 2 + 12 * scale, 3 * scale);
        ctx.lineTo(playerSize / 2 - 5 * scale, 8 * scale);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#C0392B';
        ctx.beginPath();
        ctx.ellipse(-5 * scale, 5 * scale, 12 * scale, 8 * scale, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, endGame, isMobile]);

  const shareScore = () => {
    const text = `I scored ${score} points in this viral Flappy game! Can you beat me? 🎮`;

    if (navigator.share) {
      navigator.share({
        title: 'My Game Score',
        text: text,
        url: 'https://flappymeme.online'
      }).catch(() => {});
    } else {
      const fullText = `${text} https://flappymeme.online`;
      navigator.clipboard.writeText(fullText);
      toast.success('Score copied to clipboard!');
    }
  };


  return (
    <div className="min-h-screen bg-yellow-50">
      <Toaster position="top-center" richColors />
      
      <div className={`container mx-auto px-4 ${isMobile && gameState !== 'setup' ? 'py-2' : 'py-8'} max-w-6xl`}>
        {/* Hide title on mobile when playing */}
        {!(isMobile && (gameState === 'ready' || gameState === 'playing')) && (
          <>
            <h1 className={`game-title text-center text-slate-800 mb-2 tracking-wide ${isMobile ? 'text-3xl' : 'text-5xl md:text-7xl'}`}>
              🎮 FLAPPY MEME
            </h1>
            <p className={`text-center text-slate-600 mb-8 ${isMobile ? 'text-sm mb-4' : 'text-lg'}`}>
              Customize. Play. Go Viral! 🚀
            </p>
          </>
        )}

        {/* Hide ad on mobile when playing */}
        {!(isMobile && gameState !== 'setup') && (
          <div className="mb-6 w-full h-[90px] bg-slate-200 flex items-center justify-center border-2 border-dashed border-slate-400 rounded-xl">
            <span className="text-slate-500 font-bold text-sm md:text-base">📢 Ad Space - Google AdSense Placeholder</span>
          </div>
        )}

        {gameState === 'setup' && (
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-3xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8">
              <h2 className="game-title text-2xl mb-6 text-slate-800">🎨 Customize Your Game</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-lg font-bold mb-3 text-slate-700">Player Image</label>
                  <div className="flex items-center gap-4">
                    {playerImage ? (
                      <img
                        src={playerImage}
                        alt="Player"
                        className="w-20 h-20 rounded-full border-4 border-rose-500 object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full border-4 border-rose-500 flex items-center justify-center"
                           style={{background: 'radial-gradient(circle, #FFD700 0%, #FF6B6B 50%, #EE5A24 100%)'}}>
                        <span className="text-3xl">🐦</span>
                      </div>
                    )}
                    <label className="upload-button bg-rose-500 text-white px-6 py-3 rounded-full flex items-center gap-2">
                      <Upload size={20} />
                      {playerImage ? 'Change' : 'Upload'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePlayerImageUpload}
                        className="hidden"
                        data-testid="player-image-upload"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-lg font-bold mb-3 text-slate-700">Obstacle Image</label>
                  <div className="flex items-center gap-4">
                    <img
                      src={obstacleImage}
                      alt="Obstacle"
                      className="w-20 h-20 rounded-full border-4 border-lime-500 object-cover"
                    />
                    <label className="upload-button bg-lime-500 text-white px-6 py-3 rounded-full flex items-center gap-2">
                      <Upload size={20} />
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleObstacleImageUpload}
                        className="hidden"
                        data-testid="obstacle-image-upload"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-lg font-bold mb-3 text-slate-700">Hit Sound</label>
                  <div className="flex items-center gap-4">
                        <div
                            className="w-20 h-20 rounded-full border-4 border-purple-500 flex items-center justify-center cursor-pointer"
                            style={{background: 'linear-gradient(135deg, #6366F1, #8B5CF6)'}}
                        >
                          <span className="text-3xl">🎵</span>
                        </div>
                  <label className="upload-button bg-purple-500 text-white px-6 py-3 rounded-full flex items-center gap-2 w-fit">
                    <Volume2 size={20} />
                    {hitSound ? 'Sound Uploaded ✓' : 'Upload'}
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleSoundUpload}
                      className="hidden"
                      data-testid="sound-upload"
                    />
                  </label>
                  </div>
                </div>
              </div>

              <button
                onClick={startGame}
                className="upload-button w-full mt-8 bg-rose-500 hover:bg-rose-600 text-white px-8 py-4 rounded-full flex items-center justify-center gap-3 text-xl"
                data-testid="start-game-button"
              >
                <Play size={28} />
                START GAME
              </button>
            </div>

            <div className="bg-white rounded-3xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8">
              <h2 className="game-title text-2xl mb-6 text-slate-800">📖 How to Play</h2>
              <div className="space-y-4 text-slate-700">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🖱️</span>
                  <div>
                    <p className="font-bold">Click / Tap / Space</p>
                    <p className="text-sm">Make your player jump</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🎯</span>
                  <div>
                    <p className="font-bold">Avoid Obstacles</p>
                    <p className="text-sm">{"Don't hit the pipes or edges"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-3xl">⭐</span>
                  <div>
                    <p className="font-bold">Score Points</p>
                    <p className="text-sm">Pass through gaps to score</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🎨</span>
                  <div>
                    <p className="font-bold">Customize Everything</p>
                    <p className="text-sm">Use your own images and sounds!</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-6 bg-yellow-100 rounded-2xl border-2 border-yellow-400">
                <p className="text-center text-lg font-bold text-slate-800">
                  High Score: <span className="text-rose-500 text-3xl">{highScore}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {(gameState === 'ready' || gameState === 'playing' || gameState === 'gameover') && (
          <div className={`flex flex-col items-center ${isMobile ? 'fixed inset-0 bg-yellow-50 z-40 pt-4' : ''}`}>
            <div className={`${isMobile ? 'mb-2' : 'mb-6'} text-center`}>
              <p className={`score-display text-slate-800 ${isMobile ? 'text-4xl' : ''}`}>{score}</p>
              <p className={`text-slate-600 font-bold ${isMobile ? 'text-sm' : ''}`}>SCORE</p>
              {gameState === 'playing' && (
                <p className="text-xs text-slate-500 mt-1">Speed: {currentSpeed.toFixed(1)}x</p>
              )}
            </div>

            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              onClick={jump}
              className="game-canvas bg-sky-300 cursor-pointer rounded-2xl shadow-lg"
              style={{ maxWidth: '100%', touchAction: 'none' }}
              data-testid="game-canvas"
            />

            <p className={`${isMobile ? 'mt-2 text-sm' : 'mt-4'} text-slate-600 text-center`}>
              {gameState === 'ready' ? 'Tap to start!' : 'Tap to jump'}
            </p>

            {gameState === 'gameover' && (
              <button
                onClick={() => setGameState('setup')}
                className="upload-button mt-6 bg-slate-700 text-white px-8 py-4 rounded-full flex items-center gap-3"
                data-testid="back-to-setup-button"
              >
                <RotateCcw size={24} />
                Back to Setup
              </button>
            )}
          </div>
        )}

        {showResults && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 max-w-md w-full" data-testid="results-modal">
              <h2 className="game-title text-4xl text-center mb-4 text-slate-800">GAME OVER!</h2>
              
              <div className="text-center mb-6">
                <p className="text-6xl mb-2">🎮</p>
                <p className="text-slate-600 text-lg mb-2">Your Score</p>
                <p className="score-display text-rose-500" data-testid="final-score">{score}</p>
                
                {score > highScore - score && score > 0 && (
                  <p className="text-lime-600 font-bold mt-2 text-xl">🎉 New High Score!</p>
                )}
              </div>

              <div className="space-y-3">
                <button
                  onClick={startGame}
                  className="upload-button w-full bg-rose-500 text-white px-6 py-4 rounded-full flex items-center justify-center gap-2"
                  data-testid="play-again-button"
                >
                  <Play size={24} />
                  Play Again
                </button>

                <button
                  onClick={shareScore}
                  className="upload-button w-full bg-purple-500 text-white px-6 py-4 rounded-full flex items-center justify-center gap-2"
                  data-testid="share-score-button"
                >
                  <Share2 size={24} />
                  Share Score
                </button>

                <button
                  onClick={() => {
                    setShowResults(false);
                    setTimeout(() => setGameState('setup'), 100);
                  }}
                  className="upload-button w-full bg-slate-700 text-white px-6 py-4 rounded-full flex items-center justify-center gap-2"
                  data-testid="new-game-button"
                >
                  <RotateCcw size={24} />
                  New Game
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Footer - only show on setup page */}
      {gameState === 'setup' && (
          <footer className="py-6 text-center border-t border-slate-200 bg-yellow-50">
            <p className="text-slate-500 text-sm">
              Made with ❤️ for meme and game lovers
            </p>
            <a
                href="mailto:flappymeme2@gmail.com"
                className="text-slate-400 hover:text-rose-500 text-sm transition-colors"
            >
              📧 flappymeme2@gmail.com
            </a>
          </footer>
      )}
    </div>
  );
}

export default App;
