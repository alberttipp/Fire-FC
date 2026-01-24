/**
 * 🔥 FIRE BALL - Premium Head Soccer Game
 * Styled like HeadBall 2
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Volume2, VolumeX, ArrowLeft, Flame, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

// ============================================
// GAME CONFIGURATION
// ============================================
const CONFIG = {
    WIDTH: 800,
    HEIGHT: 500,
    
    // Physics
    GRAVITY: 0.5,
    FRICTION: 0.99,
    
    // Player
    PLAYER_SIZE: 60,
    PLAYER_SPEED: 6,
    JUMP_POWER: 13,
    KICK_POWER: 16,
    
    // Ball
    BALL_RADIUS: 18,
    BALL_BOUNCE: 0.75,
    
    // Field
    GROUND_Y: 400,
    GOAL_WIDTH: 60,
    GOAL_HEIGHT: 110,
    
    // Rules
    WIN_SCORE: 5,
    MATCH_TIME: 120,
};

const STATES = {
    LOADING: 'loading',
    MENU: 'menu',
    SELECT: 'select', 
    PLAYING: 'playing',
    GOAL: 'goal',
    GAMEOVER: 'gameover',
};

// ============================================
// MAIN GAME COMPONENT
// ============================================
const FireBall = ({ onClose }) => {
    const canvasRef = useRef(null);
    const gameLoopRef = useRef(null);
    const gameRef = useRef(null);
    
    const [screen, setScreen] = useState(STATES.LOADING);
    const [roster, setRoster] = useState([]);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [opponent, setOpponent] = useState(null);
    const [score, setScore] = useState({ p1: 0, p2: 0 });
    const [timeLeft, setTimeLeft] = useState(CONFIG.MATCH_TIME);
    const [lastScorer, setLastScorer] = useState(null);
    const [soundOn, setSoundOn] = useState(true);

    // ============================================
    // FETCH ROSTER FROM DATABASE
    // ============================================
    useEffect(() => {
        const fetchRoster = async () => {
            try {
                const { data, error } = await supabase
                    .from('players')
                    .select('id, first_name, last_name, number, avatar_url')
                    .order('number');

                if (error) {
                    console.error('Error fetching roster:', error);
                    // Fallback to empty roster
                    setRoster([]);
                } else {
                    // Transform data for game
                    const players = (data || []).map(p => ({
                        id: p.id,
                        name: `${p.first_name} ${p.last_name}`,
                        firstName: p.first_name,
                        lastName: p.last_name,
                        photo: p.avatar_url || null,
                        number: p.number || 0,
                    }));
                    setRoster(players);
                }
            } catch (err) {
                console.error('Failed to fetch roster:', err);
                setRoster([]);
            }
            
            // Move to menu after loading
            setScreen(STATES.MENU);
        };

        fetchRoster();
    }, []);

    // ============================================
    // INITIALIZE GAME
    // ============================================
    const initGame = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Game state
        gameRef.current = {
            p1: {
                x: CONFIG.WIDTH * 0.75,
                y: CONFIG.GROUND_Y - CONFIG.PLAYER_SIZE,
                vx: 0,
                vy: 0,
                onGround: true,
                photo: null,
                kicking: false,
                kickFrame: 0,
            },
            p2: {
                x: CONFIG.WIDTH * 0.25,
                y: CONFIG.GROUND_Y - CONFIG.PLAYER_SIZE,
                vx: 0,
                vy: 0,
                onGround: true,
                photo: null,
                kicking: false,
                kickFrame: 0,
            },
            ball: {
                x: CONFIG.WIDTH / 2,
                y: 200,
                vx: 0,
                vy: 0,
                spin: 0,
            },
            controls: { left: false, right: false, jump: false, kick: false },
            running: true,
            goalScored: false,
        };

        // Load photos
        if (selectedPlayer?.photo) {
            const img = new Image();
            img.onload = () => { if (gameRef.current) gameRef.current.p1.photo = img; };
            img.src = selectedPlayer.photo;
        }
        if (opponent?.photo) {
            const img = new Image();
            img.onload = () => { if (gameRef.current) gameRef.current.p2.photo = img; };
            img.src = opponent.photo;
        }

        // Game loop
        const loop = () => {
            if (!gameRef.current?.running) return;
            update();
            render(ctx);
            gameLoopRef.current = requestAnimationFrame(loop);
        };
        gameLoopRef.current = requestAnimationFrame(loop);
    }, [selectedPlayer, opponent]);

    // ============================================
    // UPDATE
    // ============================================
    const update = () => {
        const g = gameRef.current;
        if (!g || g.goalScored) return;

        const { p1, p2, ball, controls } = g;

        // Player 1 controls
        if (controls.left) p1.vx = -CONFIG.PLAYER_SPEED;
        else if (controls.right) p1.vx = CONFIG.PLAYER_SPEED;
        else p1.vx *= 0.85;

        if (controls.jump && p1.onGround) {
            p1.vy = -CONFIG.JUMP_POWER;
            p1.onGround = false;
        }

        if (controls.kick && !p1.kicking) {
            p1.kicking = true;
            p1.kickFrame = 10;
        }

        // AI for P2
        const targetX = ball.x < CONFIG.WIDTH * 0.6 ? ball.x : CONFIG.WIDTH * 0.25;
        if (p2.x < targetX - 20) p2.vx = CONFIG.PLAYER_SPEED * 0.65;
        else if (p2.x > targetX + 20) p2.vx = -CONFIG.PLAYER_SPEED * 0.65;
        else p2.vx *= 0.85;

        // AI jump
        if (p2.onGround) {
            const dist = Math.hypot(ball.x - p2.x, ball.y - p2.y);
            if (dist < 120 && ball.y < p2.y - 20 && Math.random() > 0.7) {
                p2.vy = -CONFIG.JUMP_POWER * 0.85;
                p2.onGround = false;
            }
        }

        // Physics for players
        [p1, p2].forEach(p => {
            p.vy += CONFIG.GRAVITY;
            p.x += p.vx;
            p.y += p.vy;

            // Ground
            if (p.y > CONFIG.GROUND_Y - CONFIG.PLAYER_SIZE) {
                p.y = CONFIG.GROUND_Y - CONFIG.PLAYER_SIZE;
                p.vy = 0;
                p.onGround = true;
            }

            // Walls
            p.x = Math.max(CONFIG.PLAYER_SIZE/2, Math.min(CONFIG.WIDTH - CONFIG.PLAYER_SIZE/2, p.x));

            // Kick animation
            if (p.kicking) {
                p.kickFrame--;
                if (p.kickFrame <= 0) p.kicking = false;
            }
        });

        // Ball physics
        ball.vy += CONFIG.GRAVITY * 0.7;
        ball.vx *= CONFIG.FRICTION;
        ball.vy *= CONFIG.FRICTION;
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.spin += ball.vx * 0.1;

        // Ball boundaries
        if (ball.y > CONFIG.GROUND_Y - CONFIG.BALL_RADIUS) {
            ball.y = CONFIG.GROUND_Y - CONFIG.BALL_RADIUS;
            ball.vy *= -CONFIG.BALL_BOUNCE;
            ball.vx *= 0.9;
        }
        if (ball.y < CONFIG.BALL_RADIUS + 50) {
            ball.y = CONFIG.BALL_RADIUS + 50;
            ball.vy *= -0.5;
        }

        // Side walls (except goals)
        const goalTop = CONFIG.GROUND_Y - CONFIG.GOAL_HEIGHT;
        if (ball.x < CONFIG.BALL_RADIUS) {
            if (ball.y < goalTop) {
                ball.x = CONFIG.BALL_RADIUS;
                ball.vx *= -CONFIG.BALL_BOUNCE;
            }
        }
        if (ball.x > CONFIG.WIDTH - CONFIG.BALL_RADIUS) {
            if (ball.y < goalTop) {
                ball.x = CONFIG.WIDTH - CONFIG.BALL_RADIUS;
                ball.vx *= -CONFIG.BALL_BOUNCE;
            }
        }

        // Player-ball collision
        [p1, p2].forEach((p, idx) => {
            const headX = p.x;
            const headY = p.y - CONFIG.PLAYER_SIZE * 0.2;
            const headR = CONFIG.PLAYER_SIZE * 0.55;

            const dx = ball.x - headX;
            const dy = ball.y - headY;
            const dist = Math.hypot(dx, dy);
            const minDist = headR + CONFIG.BALL_RADIUS;

            if (dist < minDist && dist > 0) {
                const nx = dx / dist;
                const ny = dy / dist;
                
                ball.x = headX + nx * (minDist + 1);
                ball.y = headY + ny * (minDist + 1);

                let power = CONFIG.KICK_POWER;
                if (p.kicking) power *= 1.5;

                ball.vx = nx * power + p.vx * 0.5;
                ball.vy = ny * power - 3;

                // Clamp
                const speed = Math.hypot(ball.vx, ball.vy);
                if (speed > 22) {
                    ball.vx = (ball.vx / speed) * 22;
                    ball.vy = (ball.vy / speed) * 22;
                }
            }
        });

        // Goal detection
        const goalY = CONFIG.GROUND_Y - CONFIG.GOAL_HEIGHT;
        if (ball.x < CONFIG.GOAL_WIDTH && ball.y > goalY + 20) {
            g.goalScored = true;
            handleGoal('p1');
        }
        if (ball.x > CONFIG.WIDTH - CONFIG.GOAL_WIDTH && ball.y > goalY + 20) {
            g.goalScored = true;
            handleGoal('p2');
        }
    };

    // ============================================
    // RENDER
    // ============================================
    const render = (ctx) => {
        const g = gameRef.current;
        if (!g) return;

        const { p1, p2, ball } = g;
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // === BACKGROUND: Stadium ===
        // Sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
        skyGrad.addColorStop(0, '#1a3a5c');
        skyGrad.addColorStop(1, '#0d1f33');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);

        // Stadium structure
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(0, 30, W, 150);

        // Crowd (rows of colored dots)
        drawCrowd(ctx, 0, 40, W, 130);

        // Banner
        ctx.fillStyle = '#1e6b4a';
        ctx.fillRect(50, 175, W - 100, 35);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🔥 ROCKFORD FIRE FC 🔥', W/2, 198);

        // === FIELD ===
        drawField(ctx);

        // === GOALS ===
        drawGoal(ctx, 0, true);
        drawGoal(ctx, W - CONFIG.GOAL_WIDTH, false);

        // === PLAYERS ===
        drawPlayer(ctx, p2, false, opponent?.number || '2');
        drawPlayer(ctx, p1, true, selectedPlayer?.number || '1');

        // === BALL ===
        drawBall(ctx, ball);

        // === SCOREBOARD ===
        drawScoreboard(ctx);
    };

    const drawCrowd = (ctx, x, y, w, h) => {
        const colors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c'];
        const rows = 5;
        const cols = 40;
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const px = x + (c / cols) * w + Math.sin(r * 3 + c) * 5;
                const py = y + (r / rows) * h + 10;
                const color = colors[(r + c) % colors.length];
                
                // Head
                ctx.fillStyle = '#fdbf6f';
                ctx.beginPath();
                ctx.arc(px, py, 6, 0, Math.PI * 2);
                ctx.fill();
                
                // Shirt
                ctx.fillStyle = color;
                ctx.fillRect(px - 5, py + 5, 10, 12);
            }
        }
    };

    const drawField = (ctx) => {
        const W = CONFIG.WIDTH;
        const groundY = CONFIG.GROUND_Y;
        const fieldTop = 215;

        // Field background with stripes
        const stripeWidth = 80;
        for (let i = 0; i < W / stripeWidth; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#2d7a4a' : '#34915a';
            ctx.fillRect(i * stripeWidth, fieldTop, stripeWidth, groundY - fieldTop);
        }

        // Field border (dark green outline)
        ctx.strokeStyle = '#1a4d2e';
        ctx.lineWidth = 4;
        ctx.strokeRect(20, fieldTop + 5, W - 40, groundY - fieldTop - 10);

        // Center line
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(W/2, fieldTop + 10);
        ctx.lineTo(W/2, groundY - 5);
        ctx.stroke();

        // Center circle
        ctx.beginPath();
        ctx.arc(W/2, (fieldTop + groundY) / 2 + 30, 50, 0, Math.PI * 2);
        ctx.stroke();

        // Ground (brown dirt strip)
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(0, groundY, W, 100);

        // Ground texture
        ctx.fillStyle = '#4e342e';
        for (let i = 0; i < 50; i++) {
            const rx = Math.random() * W;
            const ry = groundY + Math.random() * 40;
            ctx.fillRect(rx, ry, 15, 3);
        }
    };

    const drawGoal = (ctx, x, isLeft) => {
        const goalY = CONFIG.GROUND_Y - CONFIG.GOAL_HEIGHT;
        const goalW = CONFIG.GOAL_WIDTH;
        const goalH = CONFIG.GOAL_HEIGHT;

        // Goal back (net area)
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(isLeft ? x - 20 : x, goalY, isLeft ? 20 + goalW : goalW + 20, goalH);

        // Net pattern
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < goalW + 20; i += 8) {
            ctx.beginPath();
            ctx.moveTo((isLeft ? x - 20 : x) + i, goalY);
            ctx.lineTo((isLeft ? x - 20 : x) + i, goalY + goalH);
            ctx.stroke();
        }
        for (let i = 0; i < goalH; i += 8) {
            ctx.beginPath();
            ctx.moveTo(isLeft ? x - 20 : x, goalY + i);
            ctx.lineTo(isLeft ? x + goalW : x + goalW + 20, goalY + i);
            ctx.stroke();
        }

        // Goal frame (white posts)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (isLeft) {
            ctx.moveTo(x + goalW, CONFIG.GROUND_Y);
            ctx.lineTo(x + goalW, goalY);
            ctx.lineTo(x, goalY);
            ctx.lineTo(x, CONFIG.GROUND_Y);
        } else {
            ctx.moveTo(x, CONFIG.GROUND_Y);
            ctx.lineTo(x, goalY);
            ctx.lineTo(x + goalW, goalY);
            ctx.lineTo(x + goalW, CONFIG.GROUND_Y);
        }
        ctx.stroke();
    };

    const drawPlayer = (ctx, player, isP1, number) => {
        const { x, y, photo, kicking, vx } = player;
        const size = CONFIG.PLAYER_SIZE;
        const facingRight = isP1 ? vx < 0 : vx >= 0;

        ctx.save();
        
        // Flip if needed
        if (!facingRight) {
            ctx.translate(x, 0);
            ctx.scale(-1, 1);
            ctx.translate(-x, 0);
        }

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x, CONFIG.GROUND_Y - 2, size * 0.4, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        const legOffset = kicking ? 15 : 0;
        ctx.fillStyle = isP1 ? '#1a1a1a' : '#1a1a1a';
        // Back leg
        ctx.fillRect(x - 12, y + size * 0.5, 10, 35);
        // Front leg (kick animation)
        ctx.save();
        ctx.translate(x + 5, y + size * 0.5);
        ctx.rotate(kicking ? 0.5 : 0);
        ctx.fillRect(0, 0, 10, 35);
        ctx.restore();

        // Shoes
        ctx.fillStyle = isP1 ? '#ccff00' : '#ff4444';
        ctx.fillRect(x - 15, y + size * 0.5 + 30, 15, 10);
        ctx.fillRect(x + 2 + (kicking ? 10 : 0), y + size * 0.5 + 30, 15, 10);

        // Body (jersey)
        const jerseyGrad = ctx.createLinearGradient(x - 20, y, x + 20, y + 40);
        if (isP1) {
            jerseyGrad.addColorStop(0, '#ccff00');
            jerseyGrad.addColorStop(1, '#99cc00');
        } else {
            jerseyGrad.addColorStop(0, '#ff4444');
            jerseyGrad.addColorStop(1, '#cc0000');
        }
        ctx.fillStyle = jerseyGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + size * 0.35, 22, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isP1 ? '#669900' : '#990000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Jersey number
        ctx.fillStyle = isP1 ? '#1a1a1a' : '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(number, x, y + size * 0.45);

        // Head (big!)
        const headRadius = size * 0.55;
        const headY = y - size * 0.2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, headY, headRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        if (photo) {
            ctx.drawImage(photo, x - headRadius, headY - headRadius, headRadius * 2, headRadius * 2);
        } else {
            // Fallback face
            ctx.fillStyle = '#fdbf6f';
            ctx.fill();
            
            // Eyes
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(x - 10, headY - 5, 8, 10, 0, 0, Math.PI * 2);
            ctx.ellipse(x + 10, headY - 5, 8, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(x - 8, headY - 3, 4, 0, Math.PI * 2);
            ctx.arc(x + 12, headY - 3, 4, 0, Math.PI * 2);
            ctx.fill();

            // Mouth
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, headY + 12, 8, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.stroke();
        }
        ctx.restore();

        // Head outline
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, headY, headRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    };

    const drawBall = (ctx, ball) => {
        const { x, y, spin } = ball;
        const r = CONFIG.BALL_RADIUS;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x, CONFIG.GROUND_Y - 2, r * 0.9, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ball
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(spin);

        // White base
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Pentagon pattern
        ctx.fillStyle = '#333';
        const pentagons = [
            { x: 0, y: 0, size: r * 0.4 },
            { x: r * 0.6, y: 0, size: r * 0.25 },
            { x: -r * 0.6, y: 0, size: r * 0.25 },
            { x: 0, y: r * 0.6, size: r * 0.25 },
            { x: 0, y: -r * 0.6, size: r * 0.25 },
        ];
        pentagons.forEach(p => {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
                const px = p.x + Math.cos(angle) * p.size;
                const py = p.y + Math.sin(angle) * p.size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        });

        // Outline
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    };

    const drawScoreboard = (ctx) => {
        const W = CONFIG.WIDTH;

        // Scoreboard background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(W/2 - 100, 5, 200, 40);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(W/2 - 100, 5, 200, 40);

        // Timer
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(formatTime(timeLeft), W/2, 35);

        // P1 Score (left of scoreboard)
        ctx.fillStyle = '#ccff00';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(score.p1, W/2 - 110, 38);

        // P2 Score (right of scoreboard)
        ctx.fillStyle = '#ff4444';
        ctx.textAlign = 'left';
        ctx.fillText(score.p2, W/2 + 110, 38);

        // Player avatars next to scores
        if (selectedPlayer?.photo && gameRef.current?.p1?.photo) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(W/2 - 150, 25, 20, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(gameRef.current.p1.photo, W/2 - 170, 5, 40, 40);
            ctx.restore();
            ctx.strokeStyle = '#ccff00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(W/2 - 150, 25, 20, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (opponent?.photo && gameRef.current?.p2?.photo) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(W/2 + 150, 25, 20, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(gameRef.current.p2.photo, W/2 + 130, 5, 40, 40);
            ctx.restore();
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(W/2 + 150, 25, 20, 0, Math.PI * 2);
            ctx.stroke();
        }
    };

    // ============================================
    // GAME EVENTS
    // ============================================
    const handleGoal = (scorer) => {
        if (screen !== STATES.PLAYING) return;
        
        setLastScorer(scorer);
        setScore(prev => {
            const newScore = { ...prev, [scorer]: prev[scorer] + 1 };
            if (newScore.p1 >= CONFIG.WIN_SCORE || newScore.p2 >= CONFIG.WIN_SCORE) {
                setTimeout(() => setScreen(STATES.GAMEOVER), 2000);
            } else {
                setTimeout(() => resetBall(), 2000);
            }
            return newScore;
        });
        setScreen(STATES.GOAL);
    };

    const resetBall = () => {
        if (gameRef.current) {
            gameRef.current.ball = { x: CONFIG.WIDTH / 2, y: 200, vx: 0, vy: 0, spin: 0 };
            gameRef.current.goalScored = false;
        }
        setScreen(STATES.PLAYING);
    };

    const startMatch = () => {
        if (!selectedPlayer) return;
        const others = roster.filter(p => p.id !== selectedPlayer.id);
        setOpponent(others[Math.floor(Math.random() * others.length)]);
        setScore({ p1: 0, p2: 0 });
        setTimeLeft(CONFIG.MATCH_TIME);
        setScreen(STATES.PLAYING);
    };

    // ============================================
    // CONTROLS
    // ============================================
    useEffect(() => {
        if (screen !== STATES.PLAYING && screen !== STATES.GOAL) return;

        const onKeyDown = (e) => {
            if (!gameRef.current) return;
            const c = gameRef.current.controls;
            if (e.key === 'ArrowLeft' || e.key === 'a') c.left = true;
            if (e.key === 'ArrowRight' || e.key === 'd') c.right = true;
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') c.jump = true;
            if (e.key === 'x' || e.key === 'j') c.kick = true;
        };
        const onKeyUp = (e) => {
            if (!gameRef.current) return;
            const c = gameRef.current.controls;
            if (e.key === 'ArrowLeft' || e.key === 'a') c.left = false;
            if (e.key === 'ArrowRight' || e.key === 'd') c.right = false;
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') c.jump = false;
            if (e.key === 'x' || e.key === 'j') c.kick = false;
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [screen]);

    // ============================================
    // LIFECYCLE
    // ============================================
    useEffect(() => {
        if (screen === STATES.PLAYING) initGame();
        return () => {
            if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
            if (gameRef.current) gameRef.current.running = false;
        };
    }, [screen, initGame]);

    useEffect(() => {
        if (screen !== STATES.PLAYING) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { setScreen(STATES.GAMEOVER); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [screen]);

    const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

    // ============================================
    // TOUCH CONTROLS COMPONENT
    // ============================================
    const TouchControls = () => (
        <div className="absolute bottom-0 left-0 right-0 flex justify-between items-end p-4 pointer-events-none">
            {/* Left side controls */}
            <div className="flex gap-2 pointer-events-auto">
                <button
                    onTouchStart={() => gameRef.current && (gameRef.current.controls.left = true)}
                    onTouchEnd={() => gameRef.current && (gameRef.current.controls.left = false)}
                    onMouseDown={() => gameRef.current && (gameRef.current.controls.left = true)}
                    onMouseUp={() => gameRef.current && (gameRef.current.controls.left = false)}
                    onMouseLeave={() => gameRef.current && (gameRef.current.controls.left = false)}
                    className="w-16 h-16 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform border-4 border-yellow-300"
                >
                    <span className="text-3xl text-white drop-shadow-md">◀</span>
                </button>
                <button
                    onTouchStart={() => gameRef.current && (gameRef.current.controls.right = true)}
                    onTouchEnd={() => gameRef.current && (gameRef.current.controls.right = false)}
                    onMouseDown={() => gameRef.current && (gameRef.current.controls.right = true)}
                    onMouseUp={() => gameRef.current && (gameRef.current.controls.right = false)}
                    onMouseLeave={() => gameRef.current && (gameRef.current.controls.right = false)}
                    className="w-16 h-16 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform border-4 border-yellow-300"
                >
                    <span className="text-3xl text-white drop-shadow-md">▶</span>
                </button>
            </div>

            {/* Right side controls */}
            <div className="flex gap-2 pointer-events-auto">
                <button
                    onTouchStart={() => gameRef.current && (gameRef.current.controls.jump = true)}
                    onTouchEnd={() => gameRef.current && (gameRef.current.controls.jump = false)}
                    onMouseDown={() => gameRef.current && (gameRef.current.controls.jump = true)}
                    onMouseUp={() => gameRef.current && (gameRef.current.controls.jump = false)}
                    onMouseLeave={() => gameRef.current && (gameRef.current.controls.jump = false)}
                    className="w-16 h-16 bg-gradient-to-b from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform border-4 border-orange-300"
                >
                    <span className="text-2xl text-white drop-shadow-md">⬆</span>
                </button>
                <button
                    onTouchStart={() => gameRef.current && (gameRef.current.controls.kick = true)}
                    onTouchEnd={() => gameRef.current && (gameRef.current.controls.kick = false)}
                    onMouseDown={() => gameRef.current && (gameRef.current.controls.kick = true)}
                    onMouseUp={() => gameRef.current && (gameRef.current.controls.kick = false)}
                    onMouseLeave={() => gameRef.current && (gameRef.current.controls.kick = false)}
                    className="w-16 h-16 bg-gradient-to-b from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform border-4 border-orange-300"
                >
                    <span className="text-2xl">👟</span>
                </button>
            </div>
        </div>
    );

    // ============================================
    // RENDER
    // ============================================
    return (
        <div className="fixed inset-0 z-[100] bg-gradient-to-b from-purple-900 to-black flex flex-col items-center justify-center overflow-hidden">
            {/* Header buttons */}
            <div className="absolute top-2 left-2 right-2 flex justify-between z-50">
                <button onClick={() => setSoundOn(!soundOn)} className="p-2 bg-white/20 rounded-full backdrop-blur">
                    {soundOn ? <Volume2 className="w-5 h-5 text-white" /> : <VolumeX className="w-5 h-5 text-white" />}
                </button>
                <button onClick={onClose} className="p-2 bg-red-500/80 hover:bg-red-500 rounded-full backdrop-blur">
                    <X className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* LOADING */}
            {screen === STATES.LOADING && (
                <div className="text-center p-8">
                    <Loader2 className="w-16 h-16 text-brand-green animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 uppercase tracking-widest">Loading Roster...</p>
                </div>
            )}

            {/* MENU */}
            {screen === STATES.MENU && (
                <div className="text-center p-8 animate-fade-in">
                    <h1 className="text-5xl md:text-7xl font-black mb-2">
                        <span className="text-orange-500">🔥</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500"> FIRE BALL</span>
                    </h1>
                    <p className="text-gray-300 mb-8 uppercase tracking-widest">Rockford Fire FC • U11 Boys</p>
                    
                    <button
                        onClick={() => setScreen(STATES.SELECT)}
                        className="px-10 py-5 bg-gradient-to-b from-green-400 to-green-600 text-white font-black text-2xl uppercase rounded-2xl hover:scale-110 transition-transform shadow-xl shadow-green-500/40 border-4 border-green-300"
                    >
                        PLAY NOW
                    </button>
                    
                    <p className="mt-6 text-gray-500 text-sm">{roster.length} players loaded</p>
                </div>
            )}

            {/* PLAYER SELECT */}
            {screen === STATES.SELECT && (
                <div className="w-full max-w-lg p-4">
                    <button onClick={() => setScreen(STATES.MENU)} className="flex items-center gap-2 text-gray-300 hover:text-white mb-4">
                        <ArrowLeft className="w-5 h-5" /> Back
                    </button>
                    <h2 className="text-3xl font-black text-white text-center mb-4">CHOOSE YOUR PLAYER</h2>
                    
                    {roster.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400 mb-2">No players found in database.</p>
                            <p className="text-sm text-gray-500">Run the setup SQL script first!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 max-h-[50vh] overflow-y-auto p-2">
                            {roster.map(player => (
                                <button
                                    key={player.id}
                                    onClick={() => setSelectedPlayer(player)}
                                    className={`relative aspect-square rounded-2xl overflow-hidden border-4 transition-all ${
                                        selectedPlayer?.id === player.id 
                                            ? 'border-green-400 scale-110 shadow-lg shadow-green-400/50 z-10' 
                                            : 'border-white/20 hover:border-white/50'
                                    }`}
                                >
                                    {player.photo ? (
                                        <img src={player.photo} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                            <span className="text-3xl font-black text-white/50">
                                                {player.firstName?.charAt(0)}{player.lastName?.charAt(0)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 py-1 text-center">
                                        <span className="text-white font-bold text-sm">#{player.number} {player.firstName}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    
                    {selectedPlayer && (
                        <button
                            onClick={startMatch}
                            className="w-full mt-6 py-4 bg-gradient-to-b from-orange-500 to-red-600 text-white font-black text-2xl uppercase rounded-2xl hover:scale-105 transition-transform shadow-xl border-4 border-orange-400"
                        >
                            🔥 START MATCH
                        </button>
                    )}
                </div>
            )}

            {/* GAME */}
            {(screen === STATES.PLAYING || screen === STATES.GOAL) && (
                <div className="relative w-full h-full flex items-center justify-center">
                    <canvas
                        ref={canvasRef}
                        width={CONFIG.WIDTH}
                        height={CONFIG.HEIGHT}
                        className="max-w-full max-h-[70vh] rounded-lg shadow-2xl"
                        style={{ imageRendering: 'pixelated' }}
                    />
                    
                    {/* Goal overlay */}
                    {screen === STATES.GOAL && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                            <div className="text-center">
                                <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-orange-500 animate-bounce">
                                    GOAL!
                                </h1>
                                <p className="text-white text-2xl mt-2">
                                    {lastScorer === 'p1' ? '🎉 You scored!' : '😬 They scored!'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Touch controls */}
                    <TouchControls />
                </div>
            )}

            {/* GAME OVER */}
            {screen === STATES.GAMEOVER && (
                <div className="text-center p-8">
                    <h1 className={`text-5xl md:text-6xl font-black mb-6 ${
                        score.p1 > score.p2 ? 'text-green-400' : score.p1 < score.p2 ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                        {score.p1 > score.p2 ? '🏆 VICTORY!' : score.p1 < score.p2 ? '💀 DEFEAT' : '🤝 DRAW'}
                    </h1>
                    
                    <div className="flex justify-center items-center gap-8 mb-8">
                        <div className="text-center">
                            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-green-400 mx-auto mb-2 shadow-lg shadow-green-400/30">
                                {selectedPlayer?.photo && <img src={selectedPlayer.photo} className="w-full h-full object-cover" />}
                            </div>
                            <span className="text-5xl font-black text-green-400">{score.p1}</span>
                        </div>
                        <span className="text-3xl text-gray-500 font-bold">VS</span>
                        <div className="text-center">
                            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-red-400 mx-auto mb-2 shadow-lg shadow-red-400/30">
                                {opponent?.photo && <img src={opponent.photo} className="w-full h-full object-cover" />}
                            </div>
                            <span className="text-5xl font-black text-red-400">{score.p2}</span>
                        </div>
                    </div>
                    
                    <div className="space-y-3 max-w-xs mx-auto">
                        <button
                            onClick={() => { setScore({ p1: 0, p2: 0 }); setTimeLeft(CONFIG.MATCH_TIME); setScreen(STATES.PLAYING); }}
                            className="w-full py-4 bg-gradient-to-b from-green-400 to-green-600 text-white font-black text-xl uppercase rounded-xl flex items-center justify-center gap-2 border-4 border-green-300"
                        >
                            <RotateCcw className="w-6 h-6" /> REMATCH
                        </button>
                        <button
                            onClick={() => setScreen(STATES.SELECT)}
                            className="w-full py-3 bg-white/20 text-white font-bold uppercase rounded-xl"
                        >
                            Change Player
                        </button>
                        <button onClick={() => setScreen(STATES.MENU)} className="w-full py-2 text-gray-400 hover:text-white">
                            Main Menu
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FireBall;
