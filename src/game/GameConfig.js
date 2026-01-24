/**
 * Fire Ball - Game Configuration
 * Phaser 3 + Matter.js Physics
 */

// Game constants
export const GAME_CONFIG = {
    // Canvas dimensions (optimized for mobile/tablet portrait)
    WIDTH: 400,
    HEIGHT: 600,
    
    // Physics
    GRAVITY: 1.2,
    BALL_BOUNCE: 0.7,
    BALL_FRICTION: 0.01,
    PLAYER_SPEED: 5,
    JUMP_FORCE: 12,
    KICK_FORCE: 15,
    
    // Game rules
    MATCH_DURATION: 120, // 2 minutes in seconds
    WIN_SCORE: 5, // First to 5 goals
    
    // Player dimensions
    PLAYER_HEAD_RADIUS: 35,
    PLAYER_BODY_WIDTH: 30,
    PLAYER_BODY_HEIGHT: 50,
    
    // Ball
    BALL_RADIUS: 18,
    
    // Field
    GROUND_HEIGHT: 80,
    GOAL_WIDTH: 100,
    GOAL_HEIGHT: 80,
    
    // Colors (Fire FC brand)
    COLORS: {
        PRIMARY: 0xccff00,      // Neon green
        SECONDARY: 0xd4af37,    // Gold
        DARK: 0x1a1a1a,         // Dark background
        FIELD: 0x2d5a27,        // Grass green
        WHITE: 0xffffff,
        RED: 0xff4444,
        BLUE: 0x4444ff,
    }
};

// Player roster with photos
export const ROSTER = [
    { id: 'player_01', name: 'Player 1', photo: '/players/roster/20260112_111455-EDIT.jpg', number: 1 },
    { id: 'player_02', name: 'Player 2', photo: '/players/roster/20260112_111505-EDIT.jpg', number: 2 },
    { id: 'player_03', name: 'Player 3', photo: '/players/roster/20260112_111513-EDIT.jpg', number: 3 },
    { id: 'player_04', name: 'Player 4', photo: '/players/roster/20260112_111520-EDIT.jpg', number: 4 },
    { id: 'player_05', name: 'Player 5', photo: '/players/roster/20260112_111527-EDIT.jpg', number: 5 },
    { id: 'player_06', name: 'Player 6', photo: '/players/roster/20260112_111538-EDIT.jpg', number: 6 },
    { id: 'player_07', name: 'Player 7', photo: '/players/roster/20260112_111545-EDIT.jpg', number: 7 },
    { id: 'player_08', name: 'Player 8', photo: '/players/roster/20260112_111551-EDIT.jpg', number: 8 },
    { id: 'player_09', name: 'Player 9', photo: '/players/roster/20260112_111558-EDIT.jpg', number: 9 },
    { id: 'player_10', name: 'Player 10', photo: '/players/roster/20260112_111604-EDIT.jpg', number: 10 },
    { id: 'player_11', name: 'Player 11', photo: '/players/roster/20260112_111611-EDIT.jpg', number: 11 },
    { id: 'player_12', name: 'Player 12', photo: '/players/roster/20260112_111619-EDIT.jpg', number: 12 },
    { id: 'player_13', name: 'Player 13', photo: '/players/roster/20260112_111625.jpg', number: 13 },
    { id: 'player_14', name: 'Player 14', photo: '/players/roster/20260112_111630-EDIT.jpg', number: 14 },
    { id: 'bo', name: 'Bo', photo: '/players/roster/bo_official.png', number: 58 },
];

// Sound effects URLs (free game sounds)
export const SOUNDS = {
    KICK: 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3',
    GOAL: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
    WHISTLE: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
    CROWD: 'https://assets.mixkit.co/active_storage/sfx/506/506-preview.mp3',
    BOUNCE: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
};

export default GAME_CONFIG;
