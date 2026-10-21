import { useEffect, useRef } from 'react';

import truckImage from '../assets/cargoyard/yard-truck-top.webp';
import './auth-entrance-transition.css';

export const ENTRANCE_COVER_MS = 1200;
export const ENTRANCE_DURATION_MS = 2400;

type DustParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  age: number;
  life: number;
  sprite: number;
  wobble: number;
  fog: boolean;
};

function makeDustSprite(color: string): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = 96;
  sprite.height = 96;
  const context = sprite.getContext('2d');
  if (!context) return sprite;

  const gradient = context.createRadialGradient(48, 48, 3, 48, 48, 47);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.38, color);
  gradient.addColorStop(1, 'rgb(203 195 177 / 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 96, 96);
  return sprite;
}

export function AuthEntranceTransition() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const convoyRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const convoy = convoyRef.current;
    if (!canvas || !convoy) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const sprites = [
      makeDustSprite('rgb(158 148 130 / 0.58)'),
      makeDustSprite('rgb(187 177 158 / 0.55)'),
      makeDustSprite('rgb(215 207 190 / 0.62)'),
    ];
    const particles: DustParticle[] = [];
    let frame = 0;
    let width = 0;
    let height = 0;
    let lastTime = 0;
    let startTime = 0;
    let emission = 0;
    let fogEmission = 0;

    function resize() {
      if (!canvas || !context) return;
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function draw(now: number) {
      if (!context || !convoy) return;
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      const delta = Math.min(now - (lastTime || now), 40);
      lastTime = now;
      const mobile = width <= 540;
      const truckLength = mobile ? 300 : 384;
      const driveProgress = Math.min(elapsed / 1350, 1);
      const eased = driveProgress < 0.5
        ? 2 * driveProgress * driveProgress
        : 1 - Math.pow(-2 * driveProgress + 2, 2) / 2;
      const truckX = -truckLength - 70 + eased * (width + truckLength + 140);
      convoy.style.transform = `translate(${truckX}px, -50%)`;
      convoy.style.opacity = String(elapsed < 1030 ? 1 : Math.max(0, 1 - (elapsed - 1030) / 170));

      if (elapsed < 1350 && truckX > -60 && truckX < width + 60) {
        emission += delta * 0.11;
        while (emission >= 1) {
          emission -= 1;
          for (const side of [-1, 1]) {
            particles.push({
              x: truckX + 12 + Math.random() * 22,
              y: height / 2 + side * (mobile ? 38 : 48),
              vx: -45 - Math.random() * 115,
              vy: side * (75 + Math.random() * 125),
              size: 25 + Math.random() * 24,
              age: 0,
              life: 900 + Math.random() * 600,
              sprite: Math.floor(Math.random() * sprites.length),
              wobble: Math.random() * Math.PI * 2,
              fog: false,
            });
          }
        }
      }

      if (elapsed >= 650 && elapsed < 1450) {
        fogEmission += delta * 0.07;
        while (fogEmission >= 1) {
          fogEmission -= 1;
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 70,
            vy: (Math.random() - 0.5) * 70,
            size: 90 + Math.random() * 90,
            age: 0,
            life: 1400 + Math.random() * 500,
            sprite: 2,
            wobble: Math.random() * Math.PI * 2,
            fog: true,
          });
        }
      }

      context.clearRect(0, 0, width, height);
      const dissolve = elapsed > 1550 ? Math.max(0, 1 - (elapsed - 1550) / 850) : 1;
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        if (!particle) continue;
        particle.age += delta;
        if (particle.age >= particle.life) {
          particles.splice(index, 1);
          continue;
        }
        const progress = particle.age / particle.life;
        particle.x += particle.vx * delta / 1000;
        particle.y += (particle.vy + Math.sin(particle.wobble + progress * 8) * 18) * delta / 1000;
        const radius = particle.size * (particle.fog ? 0.8 + progress * 1.4 : 0.7 + progress * 2.5);
        context.globalAlpha = Math.min(1, progress * 5) * (1 - progress) * dissolve * (particle.fog ? 0.55 : 1);
        const sprite = sprites[particle.sprite];
        if (sprite) context.drawImage(sprite, particle.x - radius, particle.y - radius, radius * 2, radius * 2);
      }
      context.globalAlpha = 1;

      if (elapsed < ENTRANCE_DURATION_MS) frame = window.requestAnimationFrame(draw);
    }

    resize();
    convoy.style.animation = 'none';
    window.addEventListener('resize', resize);
    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="auth-entrance" role="status" aria-label="Đang vào bãi dự án">
      <span className="auth-entrance__road" aria-hidden="true"><span /></span>
      <span className="auth-entrance__convoy" ref={convoyRef} aria-hidden="true">
        <img className="auth-entrance__truck" src={truckImage} alt="" />
      </span>
      <span className="auth-entrance__veil" aria-hidden="true" />
      <canvas className="auth-entrance__particles" ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
