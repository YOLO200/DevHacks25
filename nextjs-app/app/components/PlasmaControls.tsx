'use client'

import { useState } from 'react';

interface PlasmaControlsProps {
  onColorChange: (color: string) => void;
  onDirectionChange: (direction: 'forward' | 'reverse' | 'pingpong') => void;
  onSpeedChange: (speed: number) => void;
  onScaleChange: (scale: number) => void;
  onOpacityChange: (opacity: number) => void;
  onMouseInteractiveChange: (interactive: boolean) => void;
  initialValues?: {
    color: string;
    direction: 'forward' | 'reverse' | 'pingpong';
    speed: number;
    scale: number;
    opacity: number;
    mouseInteractive: boolean;
  };
}

export default function PlasmaControls({
  onColorChange,
  onDirectionChange,
  onSpeedChange,
  onScaleChange,
  onOpacityChange,
  onMouseInteractiveChange,
  initialValues = {
    color: '#8b5cf6',
    direction: 'forward' as const,
    speed: 1.0,
    scale: 2.0,
    opacity: 0.2,
    mouseInteractive: false
  }
}: PlasmaControlsProps) {
  const [color, setColor] = useState(initialValues.color);
  const [direction, setDirection] = useState(initialValues.direction);
  const [speed, setSpeed] = useState(initialValues.speed);
  const [scale, setScale] = useState(initialValues.scale);
  const [opacity, setOpacity] = useState(initialValues.opacity);
  const [mouseInteractive, setMouseInteractive] = useState(initialValues.mouseInteractive);

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    onColorChange(newColor);
  };

  const handleDirectionChange = (newDirection: 'forward' | 'reverse' | 'pingpong') => {
    setDirection(newDirection);
    onDirectionChange(newDirection);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    onSpeedChange(newSpeed);
  };

  const handleScaleChange = (newScale: number) => {
    setScale(newScale);
    onScaleChange(newScale);
  };

  const handleOpacityChange = (newOpacity: number) => {
    setOpacity(newOpacity);
    onOpacityChange(newOpacity);
  };

  const handleMouseInteractiveChange = (newInteractive: boolean) => {
    setMouseInteractive(newInteractive);
    onMouseInteractiveChange(newInteractive);
  };

  return (
    <div className="fixed top-20 right-6 z-50 bg-white/95 backdrop-blur-md rounded-xl p-6 shadow-xl border border-gray-300/80 min-w-64">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            Customize Plasma
          </h3>
          
          <div className="space-y-4">
            {/* Color */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
                </svg>
                Color
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-12 h-8 rounded border-2 border-gray-400 cursor-pointer shadow-sm"
                />
                <span className="text-xs text-gray-700 font-mono bg-gray-100 px-2 py-1 rounded">{color}</span>
              </div>
            </div>

            {/* Direction */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 01-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Direction: <span className="text-blue-600 font-bold">{direction}</span>
              </label>
              <select
                value={direction}
                onChange={(e) => handleDirectionChange(e.target.value as 'forward' | 'reverse' | 'pingpong')}
                className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800 font-medium"
              >
                <option value="forward">Forward</option>
                <option value="reverse">Reverse</option>
                <option value="pingpong">Ping Pong</option>
              </select>
            </div>

            {/* Speed */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                Speed: <span className="text-green-600 font-bold">{speed.toFixed(1)}x</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={speed}
                onChange={(e) => handleSpeedChange(Number(e.target.value))}
                className="w-full h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((speed - 0.1) / (3 - 0.1)) * 100}%, #e5e7eb ${((speed - 0.1) / (3 - 0.1)) * 100}%, #e5e7eb 100%)`
                }}
              />
            </div>

            {/* Scale */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                Scale: <span className="text-purple-600 font-bold">{scale.toFixed(1)}x</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={scale}
                onChange={(e) => handleScaleChange(Number(e.target.value))}
                className="w-full h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((scale - 0.5) / (3 - 0.5)) * 100}%, #e5e7eb ${((scale - 0.5) / (3 - 0.5)) * 100}%, #e5e7eb 100%)`
                }}
              />
            </div>

            {/* Opacity */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                Opacity: <span className="text-orange-600 font-bold">{opacity.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={opacity}
                onChange={(e) => handleOpacityChange(Number(e.target.value))}
                className="w-full h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #f97316 0%, #f97316 ${opacity * 100}%, #e5e7eb ${opacity * 100}%, #e5e7eb 100%)`
                }}
              />
            </div>

            {/* Mouse Interactive */}
            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mouseInteractive}
                  onChange={(e) => handleMouseInteractiveChange(e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-400 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm font-semibold text-gray-800 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 01-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" />
                  </svg>
                  Mouse Interactive
                </span>
              </label>
            </div>
          </div>
        </div>
      );
}
