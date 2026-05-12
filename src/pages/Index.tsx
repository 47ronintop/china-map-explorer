import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Game from '@/components/Game';
import { ERAS, type Era } from '@/data/scenes';
import { Compass, Trophy } from 'lucide-react';

type View = 'menu' | 'play' | 'results';
type EraOption = Era | 'all';

interface Totals {
  score: number;
  distance: number;
  yearError: number;
}

export default function Index() {
  const [view, setView] = useState<View>('menu');
  const [era, setEra] = useState<EraOption>('all');
  const [totals, setTotals] = useState<Totals | null>(null);

  useEffect(() => {
    document.title = '华舆寻踪 · 中国时空猜地游戏';
    const desc = '在中国地图上猜历史场景的地点与年代，从秦汉到现代，沉浸式时空之旅。';
    let m = document.querySelector('meta[name="description"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute('name', 'description');
      document.head.appendChild(m);
    }
    m.setAttribute('content', desc);
  }, []);

  if (view === 'play') {
    return (
      <Game
        eraFilter={era}
        onFinish={t => {
          setTotals(t);
          setView('results');
        }}
        onExit={() => setView('menu')}
      />
    );
  }

  if (view === 'results' && totals) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="paper-card p-8 md:p-12 max-w-xl w-full text-center space-y-6">
          <Trophy className="w-16 h-16 mx-auto text-accent" />
          <h1 className="text-4xl font-bold ink-text">游戏结束</h1>
          <p className="text-muted-foreground italic">
            "究天人之际，通古今之变。" — 司马迁
          </p>
          <div className="space-y-3 py-4">
            <div className="flex justify-between items-baseline border-b border-border pb-2">
              <span className="text-muted-foreground">总分</span>
              <span className="text-4xl font-bold text-primary">
                {Math.round(totals.score / 50)}
                <span className="text-base text-muted-foreground font-normal">/100</span>
              </span>
            </div>
            <div className="flex justify-between items-baseline border-b border-border pb-2">
              <span className="text-muted-foreground">总距离误差</span>
              <span className="text-xl font-semibold ink-text">{totals.distance.toFixed(0)} 公里</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground">总年份误差</span>
              <span className="text-xl font-semibold ink-text">{totals.yearError} 年</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setView('menu')}>
              返回主页
            </Button>
            <Button className="seal-btn flex-1" onClick={() => setView('play')}>
              再玩一局
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="paper-card p-8 md:p-12 max-w-2xl w-full space-y-8">
        <header className="text-center space-y-3">
          <Compass className="w-14 h-14 mx-auto text-primary" />
          <h1 className="text-5xl md:text-6xl font-bold ink-text tracking-wider">
            华舆寻踪
          </h1>
          <p className="text-sm tracking-[0.4em] text-muted-foreground uppercase">
            China · Time · Geo
          </p>
          <p className="text-base text-muted-foreground max-w-md mx-auto pt-2 leading-relaxed">
            观一幅古今华夏之景，猜其所在何方、所历何年。<br/>
            五回合定胜负，地点与年代皆计分。
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm tracking-widest text-muted-foreground text-center">
            选择时期
          </h2>
          <div className="space-y-2">
            <EraButton active={era === 'all'} onClick={() => setEra('all')}>
              <div className="font-bold">全部</div>
              <div className="text-xs opacity-70">所有时代</div>
            </EraButton>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ERAS) as Era[]).map(k => (
                <EraButton
                  key={k}
                  active={era === k}
                  onClick={() => setEra(k)}
                >
                  <div className="font-bold">{ERAS[k].label}</div>
                  <div className="text-xs opacity-70">{ERAS[k].range}</div>
                </EraButton>
              ))}
            </div>
          </div>
        </section>

        <Button
          className="seal-btn w-full h-14 text-lg"
          onClick={() => setView('play')}
        >
          开始 · 启程
        </Button>

        <footer className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
          灵感来自 wen-ware.com · 中国版 · beta v0.1
        </footer>
      </div>
    </main>
  );
}

function EraButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border transition-all text-center ${
        active
          ? 'border-primary bg-primary/10 text-foreground shadow-sm'
          : 'border-border bg-card hover:border-primary/40 text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
