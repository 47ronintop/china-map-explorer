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
import { Map as MapIcon, X, Clock, Target, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { nearestCity } from '@/data/cities';

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
  const [cardCollapsed, setCardCollapsed] = useState(false);

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
    setCardCollapsed(false);
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
      {/* 场景图 全屏背景 — 优先使用 360° 全景 */}
      {scene.panorama ? (
        <PanoramaViewer src={scene.panorama} className="absolute inset-0 w-full h-full" />
      ) : (
        <img
          src={scene.image}
          alt={scene.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/40 pointer-events-none" />

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
          <span className="text-2xl font-bold ink-text tabular-nums">
            {Math.round(totalScore / 10)}
            <span className="text-xs text-muted-foreground font-normal">/{results.length * 100 || 100}</span>
          </span>
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
          <Button
            onClick={submit}
            disabled={!guessLoc}
            className="seal-btn flex-1"
          >
            提交答案
          </Button>
        </div>
      </div>

      {/* 地图弹层 */}
      {(showMap || reveal) && (
        <div className="fixed inset-0 z-30 bg-foreground/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="paper-card w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden relative">
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (reveal) next();
                  else setShowMap(false);
                }}
                title={reveal ? '关闭并继续' : '关闭'}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="relative flex-1 w-full">
              <ChinaMap
                guess={guessLoc}
                onGuess={loc => setGuessLoc(loc)}
                truth={reveal ? reveal.scene.location : null}
                interactive={!reveal}
                className="absolute inset-0 w-full h-full"
              />

              {/* 揭晓时左下角对比卡 (可折叠) */}
              {reveal && (
                cardCollapsed ? (
                  <div className="absolute bottom-16 left-3 z-[1100] flex items-center gap-2 animate-scale-in">
                    <button
                      type="button"
                      onClick={() => setCardCollapsed(false)}
                      className="paper-card px-3 py-2 flex items-center gap-2 shadow-xl hover:bg-accent/10 transition-colors"
                      title="展开结果"
                    >
                      <Target className="w-4 h-4 text-primary" />
                      <span className="text-sm font-bold ink-text tabular-nums">
                        {Math.round(reveal.score / 10)}<span className="text-xs text-muted-foreground font-normal">/100</span>
                      </span>
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <Button onClick={next} className="seal-btn h-9 text-sm shadow-xl">
                      {round + 1 >= scenes.length ? '查看结果' : '下一回合 →'}
                    </Button>
                  </div>
                ) : (
                  <div className="absolute bottom-16 left-3 z-[1100] paper-card p-4 w-[min(92%,320px)] animate-scale-in shadow-xl">
                    <div className="flex items-baseline justify-between mb-2 gap-2">
                      <h4 className="text-base font-bold ink-text truncate pr-1 flex-1">{reveal.scene.title}</h4>
                      <div className="text-2xl font-bold text-primary shrink-0 tabular-nums">
                        {Math.round(reveal.score / 10)}<span className="text-sm text-muted-foreground font-normal">/100</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCardCollapsed(true)}
                        className="shrink-0 -mr-1 -mt-1 p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
                        title="收起卡片"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-muted-foreground">你的猜测</p>
                          <p className="ink-text">
                            {guessLoc ? `${guessLoc[1].toFixed(2)}°N, ${guessLoc[0].toFixed(2)}°E` : '未选'} · {formatYear(reveal.guessYear)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-[hsl(0,65%,42%)] mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-muted-foreground">真实答案</p>
                          <p className="ink-text">{reveal.scene.locationName} · {formatYear(reveal.scene.year)}</p>
                        </div>
                      </div>
                      <div className="border-t border-border pt-2 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-muted-foreground">距离差</p>
                          <p className="font-semibold ink-text">{reveal.distanceKm.toFixed(0)} 公里</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">年份差</p>
                          <p className="font-semibold ink-text">{reveal.yearError} 年</p>
                        </div>
                      </div>
                    </div>
                    <Button onClick={next} className="seal-btn w-full mt-3 h-9 text-sm">
                      {round + 1 >= scenes.length ? '查看结果' : '下一回合 →'}
                    </Button>
                  </div>
                )
              )}

              {/* 选点时右下角浮动操作面板 */}
              {!reveal && (
                <div className="absolute bottom-16 right-3 z-[1100] paper-card p-3 flex flex-col gap-2 shadow-xl w-[min(92%,260px)] animate-scale-in">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    {guessLoc ? (
                      <span className="ink-text font-medium truncate">
                        已选：{nearestCity(guessLoc[0], guessLoc[1]).name}
                      </span>
                    ) : (
                      <span>点击地图选择地点</span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGuessLoc(null)}
                      disabled={!guessLoc}
                      className="flex-1"
                    >
                      重置
                    </Button>
                    <Button
                      size="sm"
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
