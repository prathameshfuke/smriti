'use client';

import { useTranslations } from 'next-intl';
import { analytics } from '@/lib/analytics';
import { Play } from 'lucide-react';

export default function TutorialButton() {
  const t = useTranslations('games.dualNBack.gameUI.tutorial');

  const handleClick = () => {
    // 追踪教程按钮点击事件
    analytics.tutorial.buttonClick({
      game_id: 'dual-n-back',
      source: 'how_to_play_section'
    });
  };

  return (
    <button
      id="tutorial-trigger-howtoplay"
      className="group relative px-6 py-3 bg-primary text-ink-inverse rounded-tile text-patient-sm font-semibold shadow-sm hover:shadow-md hover:bg-primary-dark transform hover:-translate-y-0.5 transition-all duration-300 ease-out overflow-hidden focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-dark"
      onClick={handleClick}
    >
      {/* 动态背景效果 */}
      <div className="absolute inset-0 bg-ink-inverse opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>

      {/* 闪光效果 */}
      <div className="absolute inset-0 -top-2 -left-2 bg-ink-inverse opacity-0 group-hover:opacity-10 transform -skew-x-12 group-hover:translate-x-full transition-all duration-1000 ease-out"></div>

      {/* 按钮内容 */}
      <div className="relative flex items-center gap-2">
        <Play className="w-4 h-4" />
        <span>{t('interactiveTutorial')}</span>
      </div>
    </button>
  );
}