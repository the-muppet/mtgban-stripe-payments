'use client';

import React, { useState, useEffect, useCallback } from 'react';


interface Point {
    x: number;
    y: number;
}

interface Edge {
    id: string;
    start: Point;
    end: Point;
    length: number;
    startDistance: number;
    endDistance: number;
}

interface Hexagon {
    id: string;
    centerX: number;
    centerY: number;
    vertices: Point[];
    edges: Edge[];
    perimeter: number;
}

interface Pulse {
    id: number;
    hexId: string;
    startDistance: number;
    progress: number;
    fadeProgress: number;
}

export default function HexagonalBackground() {
    const [hexagons, setHexagons] = useState<Hexagon[]>([]);
    const [pulses, setPulses] = useState<Pulse[]>([]);
    const [activePulseHexagons, setActivePulseHexagons] = useState<Set<string>>(new Set());
    const [isVisible, setIsVisible] = useState<boolean>(true);

    const size = 130;
    const width = size * Math.sqrt(3);
    const height = size * 2;
    const verticalSpacing = height * 0.75;
    const horizontalSpacing = width;


    const createRandomPulse = useCallback(() => {
        if (hexagons.length === 0 || !isVisible || activePulseHexagons.size >= 3) return;

        const availableHexagons = hexagons.filter(hex => !activePulseHexagons.has(hex.id));
        if (availableHexagons.length === 0) return;

        // Get a random hexagon from available ones
        const randomHexagon = availableHexagons[Math.floor(Math.random() * availableHexagons.length)];
        const randomEdge = randomHexagon.edges[Math.floor(Math.random() * 6)];
        const randomParam = Math.random();
        const startDistance = randomEdge.startDistance + (randomParam * randomEdge.length);

        setPulses(currentPulses => [
            ...currentPulses,
            {
                id: Date.now(),
                hexId: randomHexagon.id,
                startDistance,
                progress: 0,
                fadeProgress: 0
            }
        ]);
    }, [hexagons, activePulseHexagons, isVisible]);

    useEffect(() => {
        let timeout: NodeJS.Timeout;

        const scheduleNextPulse = () => {
            if (!isVisible) return;

            // Random delay between 1.5 and 2.5 seconds
            const delay = 1500 + Math.random() * 1000;

            timeout = setTimeout(() => {
                createRandomPulse();
                scheduleNextPulse(); // Schedule next pulse after creating one
            }, delay);
        };

        if (isVisible) {
            scheduleNextPulse();
        }

        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [createRandomPulse, isVisible]);

    useEffect(() => {
        const generateHexagons = () => {
            const rows = Math.ceil(window.innerHeight / verticalSpacing) + 2;
            const cols = Math.ceil(window.innerWidth / horizontalSpacing) + 2;

            const newHexagons: Hexagon[] = [];

            // Generate perfect grid
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const offset = row % 2 === 0 ? 0 : horizontalSpacing / 2;
                    const centerX = (col * horizontalSpacing) + offset;
                    const centerY = row * verticalSpacing;

                    const vertices: Point[] = [];
                    const edges: Edge[] = [];
                    let totalPerimeter = 0;

                    // Generate vertices
                    for (let i = 0; i < 6; i++) {
                        const angle = (Math.PI / 3) * i - Math.PI / 6;
                        vertices.push({
                            x: centerX + size * Math.cos(angle),
                            y: centerY + size * Math.sin(angle)
                        });
                    }

                    // Generate edges
                    for (let i = 0; i < 6; i++) {
                        const start = vertices[i];
                        const end = vertices[(i + 1) % 6];
                        const length = Math.sqrt(
                            Math.pow(end.x - start.x, 2) +
                            Math.pow(end.y - start.y, 2)
                        );
                        edges.push({
                            id: `${row}-${col}-${i}`,
                            start,
                            end,
                            length,
                            startDistance: totalPerimeter,
                            endDistance: totalPerimeter + length
                        });
                        totalPerimeter += length;
                    }

                    newHexagons.push({
                        id: `${row}-${col}`,
                        centerX,
                        centerY,
                        vertices,
                        edges,
                        perimeter: totalPerimeter
                    });
                }
            }

            setHexagons(newHexagons);
        };

        generateHexagons();
        window.addEventListener('resize', generateHexagons);
        return () => window.removeEventListener('resize', generateHexagons);
    }, []);

    

    useEffect(() => {
        let animationId: number;

        const updatePulses = () => {
            if (!isVisible) return;

            setPulses(currentPulses => {
                const remainingPulses = currentPulses
                    .map(pulse => ({
                        ...pulse,
                        progress: pulse.progress + 0.007,
                        fadeProgress: pulse.progress > 0.7 ? (pulse.progress - 0.7) * 3.33 : 0
                    }))
                    .filter(pulse => pulse.progress < 1);

                setActivePulseHexagons(new Set(remainingPulses.map(p => p.hexId)));
                return remainingPulses;
            });

            animationId = requestAnimationFrame(updatePulses);
        };

        if (isVisible) {
            animationId = requestAnimationFrame(updatePulses);
        }

        return () => {
            if (animationId) cancelAnimationFrame(animationId);
        };
    }, [isVisible]);


    useEffect(() => {
        let animationId: number;
        const updatePulses = () => {
            setPulses(currentPulses => {
                const remainingPulses = currentPulses
                    .map(pulse => ({
                        ...pulse,
                        progress: pulse.progress + 0.007,
                        fadeProgress: pulse.progress > 0.7 ? (pulse.progress - 0.7) * 3.33 : 0
                    }))
                    .filter(pulse => pulse.progress < 1);

                setActivePulseHexagons(new Set(remainingPulses.map(p => p.hexId)));

                return remainingPulses;
            });

            animationId = requestAnimationFrame(updatePulses);
        };

        animationId = requestAnimationFrame(updatePulses);
        return () => cancelAnimationFrame(animationId);
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const { clientX, clientY } = e;

        hexagons.forEach(hexagon => {
            if (activePulseHexagons.has(hexagon.id)) return;

            hexagon.edges.forEach(edge => {
                const { start, end } = edge;

                const A = clientX - start.x;
                const B = clientY - start.y;
                const C = end.x - start.x;
                const D = end.y - start.y;

                const dot = A * C + B * D;
                const lenSq = C * C + D * D;
                let param = -1;

                if (lenSq !== 0) param = dot / lenSq;

                let hitX, hitY;
                if (param < 0) {
                    hitX = start.x;
                    hitY = start.y;
                } else if (param > 1) {
                    hitX = end.x;
                    hitY = end.y;
                } else {
                    hitX = start.x + param * C;
                    hitY = start.y + param * D;
                }

                const distance = Math.sqrt(
                    Math.pow(clientX - hitX, 2) +
                    Math.pow(clientY - hitY, 2)
                );

                if (distance < 5 && param >= 0 && param <= 1) {
                    const startDistance = edge.startDistance + (param * edge.length);

                    setPulses(currentPulses => [
                        ...currentPulses,
                        {
                            id: Date.now(),
                            hexId: hexagon.id,
                            startDistance,
                            progress: 0,
                            fadeProgress: 0
                        }
                    ]);
                }
            });
        });
    }, [hexagons, activePulseHexagons]);

    const getGlowColor = (progress: number, intensity: number) => {
        const red = 255;
        const green = Math.min(255, Math.floor(44 + (progress * 151)));
        const blue = 0;
        return `rgba(${red}, ${green}, ${blue}, ${intensity})`;
    };

    const renderHexagon = (hexagon: Hexagon) => {
        const activePulses = pulses.filter(p => p.hexId === hexagon.id);

        const pathData = hexagon.vertices
            .map((v, i) => `${i === 0 ? 'M' : 'L'}${v.x},${v.y}`)
            .join(' ') + 'Z';

        return (
            <g key={hexagon.id}>
                <path
                    d={pathData}
                    fill="#000000"
                    stroke="rgba(255, 30, 0, 0.1)"
                    strokeWidth="1"
                />

                {activePulses.map(pulse => {
                    const pulseWidth = hexagon.perimeter * 0.15;
                    const intensity = Math.max(0, 1 - pulse.fadeProgress);
                    const glowColor = getGlowColor(pulse.progress, intensity);

                    return (
                        <React.Fragment key={pulse.id}>
                            <path
                                d={pathData}
                                fill="none"
                                stroke={glowColor}
                                strokeWidth={2 + intensity * 2}
                                strokeDasharray={`${pulseWidth} ${hexagon.perimeter}`}
                                strokeDashoffset={-pulse.startDistance - (pulse.progress * hexagon.perimeter * 0.5)}
                                style={{
                                    filter: intensity > 0 ? `drop-shadow(0 0 ${intensity * 8}px ${glowColor})` : 'none'
                                }}
                            />
                            <path
                                d={pathData}
                                fill="none"
                                stroke={glowColor}
                                strokeWidth={2 + intensity * 2}
                                strokeDasharray={`${pulseWidth} ${hexagon.perimeter}`}
                                strokeDashoffset={-pulse.startDistance + (pulse.progress * hexagon.perimeter * 0.5)}
                                style={{
                                    filter: intensity > 0 ? `drop-shadow(0 0 ${intensity * 8}px ${glowColor})` : 'none'
                                }}
                            />
                        </React.Fragment>
                    );
                })}
            </g>
        );
    };

    return (
        <div className="relative w-screen h-screen bg-black overflow-hidden">
            <div
                className="absolute inset-0 w-full h-full"
                onMouseMove={handleMouseMove}
            >
                <svg className="w-full h-full">
                    {hexagons.map(renderHexagon)}
                </svg>
            </div>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <section className="pricing-section w-full">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex flex-col items-center space-y-16">
                            <h1 className="gradient-text-1 text-3xl font-extrabold text-center sm:text-5xl pointer-events-auto">
                                MTGBAN
                            </h1>
                            <p className="text-lg text-zinc-400 text-center sm:text-2xl max-w-3xl pointer-events-auto">
                                Join an elite network of TCG market professionals.<br />
                                Advanced data analysis, granular market coverage and keen industry insights<br />
                                reveal opportunity others overlook. Whether you're scaling up or starting out,<br />
                                our platform delivers proven value at every level.
                            </p>
                            <h1 className="gradient-text-2 text-3xl font-extrabold text-center sm:text-5xl pointer-events-auto">
                                Gain Access
                            </h1>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};
