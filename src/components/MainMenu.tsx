import React, { useState } from 'react';
import { User, Cpu, Swords, Crown, Zap, Shield, Skull } from 'lucide-react';
import type{ GameMode, Difficulty } from '../types';
import clsx from 'clsx';

interface MainMenuProps {
  onStartGame: (mode: GameMode, difficulty?: Difficulty) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStartGame }) => {
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-6 animate-in fade-in zoom-in duration-300">
      
      <div className="text-center mb-10">
        <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4 drop-shadow-lg" />
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 mb-2">
          Grandmaster Chess
        </h1>
        <p className="text-slate-400">Select your opponent</p>
      </div>

      {!selectedMode ? (
        <div className="grid grid-cols-1 gap-4 w-full">
          <button
            onClick={() => onStartGame('friend')}
            className="group relative flex items-center p-6 bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl transition-all hover:bg-slate-750 hover:shadow-xl hover:-translate-y-1"
          >
            <div className="bg-blue-500/20 p-4 rounded-full mr-5 group-hover:bg-blue-500/30 transition-colors">
              <User className="w-8 h-8 text-blue-400" />
            </div>
            <div className="text-left">
              <h3 className="text-xl font-bold text-white mb-1">Play vs Friend</h3>
              <p className="text-sm text-slate-400">Two players on the same device</p>
            </div>
          </button>

          <button
            onClick={() => setSelectedMode('bot')}
            className="group relative flex items-center p-6 bg-slate-800 border border-slate-700 hover:border-purple-500 rounded-xl transition-all hover:bg-slate-750 hover:shadow-xl hover:-translate-y-1"
          >
            <div className="bg-purple-500/20 p-4 rounded-full mr-5 group-hover:bg-purple-500/30 transition-colors">
              <Cpu className="w-8 h-8 text-purple-400" />
            </div>
            <div className="text-left">
              <h3 className="text-xl font-bold text-white mb-1">Play vs Bot</h3>
              <p className="text-sm text-slate-400">Challenge our offline engine</p>
            </div>
          </button>

          <button
            onClick={() => onStartGame('online')}
            className="group relative flex items-center p-6 bg-slate-800 border border-slate-700 hover:border-green-500 rounded-xl transition-all hover:bg-slate-750 hover:shadow-xl hover:-translate-y-1"
          >
            <div className="bg-green-500/20 p-4 rounded-full mr-5 group-hover:bg-green-500/30 transition-colors">
              <Zap className="w-8 h-8 text-green-400" />
            </div>
            <div className="text-left">
              <h3 className="text-xl font-bold text-white mb-1">Play Online</h3>
              <p className="text-sm text-slate-400">Challenge a friend remotely</p>
            </div>
          </button>
        </div>
      ) : (
        <div className="w-full">
          <div className="flex items-center gap-2 mb-6 cursor-pointer text-slate-400 hover:text-white transition-colors" onClick={() => setSelectedMode(null)}>
            <span className="text-lg">← Back</span>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Select Difficulty</h2>
          
          <div className="grid grid-cols-1 gap-3">
            <DifficultyButton 
              difficulty="easy" 
              icon={<Zap className="w-5 h-5" />} 
              label="Easy" 
              desc="Casual play for beginners"
              color="text-green-400"
              bg="bg-green-500/10"
              border="hover:border-green-500"
              onClick={() => onStartGame('bot', 'easy')} 
            />
            <DifficultyButton 
              difficulty="medium" 
              icon={<Shield className="w-5 h-5" />} 
              label="Medium" 
              desc="A balanced challenge"
              color="text-yellow-400"
              bg="bg-yellow-500/10"
              border="hover:border-yellow-500"
              onClick={() => onStartGame('bot', 'medium')} 
            />
            <DifficultyButton 
              difficulty="hard" 
              icon={<Swords className="w-5 h-5" />} 
              label="Hard" 
              desc="Strong strategic moves"
              color="text-orange-400"
              bg="bg-orange-500/10"
              border="hover:border-orange-500"
              onClick={() => onStartGame('bot', 'hard')} 
            />
            <DifficultyButton 
              difficulty="impossible" 
              icon={<Skull className="w-5 h-5" />} 
              label="Impossible" 
              desc="Grandmaster level calculation"
              color="text-red-500"
              bg="bg-red-500/10"
              border="hover:border-red-500"
              onClick={() => onStartGame('bot', 'impossible')} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface DifficultyButtonProps {
  difficulty: Difficulty;
  icon: React.ReactNode;
  label: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
  onClick: () => void;
}

const DifficultyButton: React.FC<DifficultyButtonProps> = ({ icon, label, desc, color, bg, border, onClick }) => (
  <button
    onClick={onClick}
    className={clsx(
      "flex items-center p-4 bg-slate-800 border border-slate-700 rounded-lg transition-all hover:bg-slate-750 hover:shadow-lg active:scale-[0.98]",
      border
    )}
  >
    <div className={clsx("p-3 rounded-lg mr-4", bg, color)}>
      {icon}
    </div>
    <div className="text-left">
      <h3 className={clsx("font-bold", color)}>{label}</h3>
      <p className="text-xs text-slate-400">{desc}</p>
    </div>
  </button>
);
