"use client";
import React, { useEffect, useRef } from 'react';

interface Particle {
    x: number;
    y: number;
    size: number;
    speed: number;
    opacity: number;
    emoji: string;
    drift: number;
    driftSpeed: number;
}

export const PookieBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const emojis = ["❤️", "✨", "🌸", "⭐", "🎀", "🍓", "🍭", "🧸", "🍼"];
        const particles: Particle[] = [];
        const particleCount = 28; // Keep it clean and elegant

        // Initialize particles
        for (let i = 0; i < particleCount; i++) {
            particles.push(createParticle(true));
        }

        function createParticle(randomY = false): Particle {
            return {
                x: Math.random() * width,
                y: randomY ? Math.random() * height : -50,
                size: 16 + Math.random() * 24,
                speed: 0.4 + Math.random() * 0.8,
                opacity: 0.2 + Math.random() * 0.4,
                emoji: emojis[Math.floor(Math.random() * emojis.length)],
                drift: 0,
                driftSpeed: (Math.random() - 0.5) * 0.02
            };
        }

        const draw = () => {
            ctx.clearRect(0, 0, width, height);

            particles.forEach((p, index) => {
                ctx.globalAlpha = p.opacity;
                ctx.font = `${p.size}px serif`;

                // Organic drift movement (sine wave)
                p.drift += p.driftSpeed;
                const currentX = p.x + Math.sin(p.drift) * 30;

                ctx.fillText(p.emoji, currentX, p.y);

                // Movement
                p.y += p.speed;

                // Reset particle when it leaves screen
                if (p.y > height + 50) {
                    particles[index] = createParticle();
                }

                // Loop X if it drifts too far
                if (p.x > width + 100) p.x = -50;
                if (p.x < -100) p.x = width + 50;
            });

            requestAnimationFrame(draw);
        };

        const animationId = requestAnimationFrame(draw);

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };

        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: -1,
                pointerEvents: 'none',
                background: '#FFF0F3', // Theme base
                transition: 'background 1s ease',
            }}
        />
    );
};
