/**
 * Fire Ball - Sound Manager
 * Handles game audio with graceful fallbacks
 */

import { SOUNDS } from './GameConfig';

class SoundManager {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.loaded = false;
        this.audioContext = null;
    }

    async init() {
        if (this.loaded) return;
        
        try {
            // Create audio context for mobile compatibility
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Preload sounds
            for (const [name, url] of Object.entries(SOUNDS)) {
                try {
                    const audio = new Audio();
                    audio.preload = 'auto';
                    audio.src = url;
                    audio.volume = 0.5;
                    this.sounds[name] = audio;
                } catch (e) {
                    console.warn(`Failed to load sound: ${name}`, e);
                }
            }
            
            this.loaded = true;
        } catch (e) {
            console.warn('Audio initialization failed:', e);
        }
    }

    play(soundName) {
        if (!this.enabled || !this.sounds[soundName]) return;
        
        try {
            // Resume audio context if suspended (mobile requirement)
            if (this.audioContext?.state === 'suspended') {
                this.audioContext.resume();
            }
            
            const sound = this.sounds[soundName];
            sound.currentTime = 0;
            sound.play().catch(e => console.warn('Sound play failed:', e));
        } catch (e) {
            console.warn(`Failed to play sound: ${soundName}`, e);
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        
        // Stop all sounds when disabled
        if (!enabled) {
            Object.values(this.sounds).forEach(sound => {
                try {
                    sound.pause();
                    sound.currentTime = 0;
                } catch (e) {}
            });
        }
    }

    // Individual sound methods for convenience
    kick() { this.play('KICK'); }
    goal() { this.play('GOAL'); }
    whistle() { this.play('WHISTLE'); }
    crowd() { this.play('CROWD'); }
    bounce() { this.play('BOUNCE'); }
}

// Singleton instance
const soundManager = new SoundManager();

export default soundManager;
