import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import ChinaMap from './ChinaMap';
import {
  SCENES,
  ROUNDS_PER_GAME,
  ROUND_SECONDS,
  calcScore,
  haversine,
  formatYear,
  type Scene,
  type Era,
} from '@/data/scenes';
import { Map as MapIcon, X, Clock, Target } from 'lucide-react';

interface GameProps {
  eraFilter: Era | 'all';
  onFinish: (totals: {
    score: number;
    distance: number;
    yearError: number;
  }) => void;
  onExit: () => void;
}

interface RoundResult {
  scene: Scene;
  guessLoc: [number, number] | null;
  guessYear: number;
  distanceKm: number;
  yearError: number;
  score: number;
}

function pickScenes(eraFilter: Era | 'all'): Scene[] {
  const pool = eraFilter === 'all' ? SCENES : SCENES.filter(s => s.era === eraFilter);
  const arr = [...pool].sort(() => Math.random() - 0.5);
  return arr.slice(0, Math.min(ROUNDS_PER_GAME, arr.length));
}

export default function Game({ eraFilter, onFinish, onExit }: GameProps) {
  const scenes = useMemo(() => pickScenes(eraFilter), [eraFilter]);
  const [round, setRound] = useState(0);
  const [guessLoc, setGuessLoc] = useState<[number, number] | null>(null);
  const [guessYear, setGuessYear] = useState(1500);
  const [time, setTime] = useState(ROUND_SECONDS);
  const [showMap, setShowMap] = useState(false);
  const [reveal, setReveal] = useState<RoundResult | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);

  const scene = scenes[round];

  // 计时
  useEffect(() => {
    if (reveal) return;
    if (time <= 0) {
      submit();
      return;
    }
    const t = setTimeout(() => setTime(s => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, reveal]);

  function submit() {
    if (!scene) return;
    const dist = guessLoc ? haversine(guessLoc, scene.location) : 5000;
    const yErr = Math.abs(guessYear - scene.year);
    const score = guessLoc ? calcScore(dist, yErr) : 0;
    const r: RoundResult = {
      scene,
      guessLoc,
      guessYear,
      distanceKm: dist,
      yearError: yErr,
      score,
    };
    setReveal(r);
    setResults(rs => [...rs, r]);
  }

  function next() {
    if (round + 1 >= scenes.length) {
      const all = [...results];
      const totals = all.reduce(
        (acc, r) => ({
          score: acc.score + r.score,
          distance: acc.distance + r.distanceKm,
          yearError: acc.yearError + r.yearError,
        }),
        { score: 0, distance: 0, yearError: 0 }
      );
      onFinish(totals);
      return;
    }
    setRound(r => r + 1);
    setGuessLoc(null);
    setGuessYear(1500);
    setTime(ROUND_SECONDS);
    setReveal(null);
    setShowMap(false);
  }

  if (!scene) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">该时期暂无场景</p>
        <Button onClick={onExit} className="ml-4">返回</Button>
      </div>
    );
  }

  const totalScore = results.reduce((s, r) => s + r.score, 0);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 场景图 全屏背景 */}
      <img
        src={scene.image}
        alt={scene.title}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/40" />

      {/* 顶部 HUD */}
      <div className="relative z-10 flex items-center justify-between p-4 md:p-6">
        <div className="paper-card px-4 py-2 flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">第</span>
          <span className="text-2xl font-bold ink-text">{round + 1}</span>
          <span className="text-xs text-muted-foreground">/ {scenes.length} 回合</span>
        </div>

        <div className="paper-card px-4 py-2 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className={`text-2xl font-bold tabular-nums ${time <= 10 ? 'text-destructive' : 'ink-text'}`}>
            {String(Math.floor(time / 60)).padStart(2, '0')}:{String(time % 60).padStart(2, '0')}
          </span>
        </div>

        <div className="paper-card px-4 py-2 flex items-center gap-2">
          <Target className="w-4 h-4 text-accent" />
          <span className="text-2xl font-bold ink-text tabular-nums">{totalScore}</span>
        </div>
      </div>

      {/* 场景标注 */}
      <div className="relative z-10 px-4 md:px-6">
        <div className="paper-card inline-block px-4 py-2">
          <p className="text-sm ink-text">{scene.description}</p>
          <p className="text-xs text-muted-foreground mt-1">来源：{scene.source}</p>
        </div>
      </div>

      {/* 底部控制 */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 p-4 md:p-6 space-y-3 ${reveal ? 'pointer-events-none opacity-0' : ''}`}>
        {/* 年份滑块 */}
        {!reveal && (
          <div className="paper-card p-4 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-muted-foreground tracking-widest">猜测年份</label>
              <span className="text-xl font-bold ink-text">{formatYear(guessYear)}</span>
            </div>
            <Slider
              value={[guessYear]}
              min={-1000}
              max={2024}
              step={1}
              onValueChange={v => setGuessYear(v[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>公元前 1000</span>
              <span>公元 2024</span>
            </div>
          </div>
        )}

        {/* 揭晓面板 */}
        {reveal && (
          <div className="paper-card p-5 max-w-3xl mx-auto">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-2xl font-bold ink-text">{reveal.scene.title}</h3>
              <div className="text-3xl font-bold text-primary">+{reveal.score}</div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">真实地点</p>
                <p className="ink-text font-semibold">{reveal.scene.locationName}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  距离误差：<span className="font-semibold text-foreground">{reveal.distanceKm.toFixed(0)} 公里</span>
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">真实年份</p>
                <p className="ink-text font-semibold">{formatYear(reveal.scene.year)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  年份误差：<span className="font-semibold text-foreground">{reveal.yearError} 年</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 max-w-3xl mx-auto">
          <Button
            variant="outline"
            onClick={onExit}
            className="bg-card/90 backdrop-blur"
          >
            退出
          </Button>
          <Button
            onClick={() => setShowMap(true)}
            variant="outline"
            className="flex-1 bg-card/90 backdrop-blur"
          >
            <MapIcon className="w-4 h-4 mr-2" />
            {guessLoc ? '已选定地点' : '在地图上选地点'}
          </Button>
          {reveal ? (
            <Button onClick={next} className="seal-btn flex-1">
              {round + 1 >= scenes.length ? '查看结果' : '下一回合'}
            </Button>
          ) : (
            <Button
              onClick={submit}
              disabled={!guessLoc}
              className="seal-btn flex-1"
            >
              提交答案
            </Button>
          )}
        </div>
      </div>

      {/* 地图弹层 */}
      {(showMap || reveal) && (
        <div className="fixed inset-0 z-30 bg-foreground/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="paper-card w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h3 className="text-lg font-bold ink-text">
                  {reveal ? '答案揭晓' : '在中国地图上点选位置'}
                </h3>
                {guessLoc && !reveal && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    已选：{guessLoc[1].toFixed(2)}°N, {guessLoc[0].toFixed(2)}°E
                  </p>
                )}
              </div>
              {!reveal && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMap(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
            <ChinaMap
              guess={guessLoc}
              onGuess={loc => setGuessLoc(loc)}
              truth={reveal ? reveal.scene.location : null}
              interactive={!reveal}
              className="flex-1 w-full"
            />
            {!reveal && (
              <div className="p-3 flex gap-2 border-t border-border">
                <Button variant="outline" onClick={() => setShowMap(false)} className="flex-1">
                  确认地点
                </Button>
                <Button
                  onClick={() => {
                    setShowMap(false);
                    submit();
                  }}
                  disabled={!guessLoc}
                  className="seal-btn flex-1"
                >
                  提交答案
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
