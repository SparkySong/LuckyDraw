import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLotteryStore } from "@/store/useStore";
import { cn } from "@/lib/utils";
import bgImg from "@/assets/bg.jpg";
import confetti from "canvas-confetti";
import { Maximize2, Settings, ChevronLeft, ChevronRight } from "lucide-react";

interface RollingBoardProps {
  isRolling: boolean;
  candidates: { id: string; name: string; dept: string }[];
  currentWinners: { id: string; name: string; dept: string }[]; // 中奖者（定格显示）
}

// 混淆名字的生成器（用于滚动动画）- 仅姓名
const generateMockNames = (candidates: any[], count: number) => {
  if (candidates.length === 0) return Array(count).fill({ name: "???" });
  return Array.from({ length: count }).map(() => {
    return candidates[Math.floor(Math.random() * candidates.length)];
  });
};

export default function RollingBoard({ isRolling, candidates, currentWinners }: RollingBoardProps) {
  const [displayNames, setDisplayNames] = useState(generateMockNames(candidates, 12));
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const animationRef = useRef<number>(0);
  const phaseRef = useRef<'idle' | 'accelerating' | 'running' | 'decelerating'>('idle');
  const speedRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const candidatesRef = useRef(candidates);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { currentPrizeId, prizes, settings, viewMode } = useLotteryStore();
  const currentPrize = prizes.find(p => p.id === currentPrizeId);
  const scrollMode = settings.scrollMode || 'none';

  const [currentPage, setCurrentPage] = useState(0);
  const winnersPerPage = settings.winnersPerPage || 24;

  // 保持 candidates 引用最新
  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);

  // 当滚动状态或中奖名单发生改变时重置滚动位置
  const winnersKey = JSON.stringify(currentWinners.map(w => w.id));

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isRolling, winnersKey]);

  // 自动平缓向上滚动中奖名单（类似电影结尾谢幕名单，防止遮挡且不使用自动翻页）
  useEffect(() => {
    const showWinners = !isAnimating && !isRolling && currentWinners.length > 0;
    const container = scrollContainerRef.current;
    
    console.log("AutoScroll Checking State:", {
      showWinners,
      isAnimating,
      isRolling,
      winnersLength: currentWinners.length,
      hasContainer: !!container,
      scrollHeight: container?.scrollHeight,
      clientHeight: container?.clientHeight
    });

    if (!showWinners || !container || scrollMode !== 'scroll') return;

    let scrollIntervalId: any;
    let startTimeoutId: any;
    let pauseTimeoutId: any;
    let scrollBackTimeoutId: any;
    let isPaused = false;

    const startScroll = () => {
      // 检查是否超出容器高度。如果在首屏渲染完前为 0，我们在 interval 中动态适配
      scrollIntervalId = setInterval(() => {
        if (isPaused) return;

        // 如果渲染尚未彻底完成（比如高度还没算对），我们静默等待不退出，直到高度变大
        if (container.scrollHeight <= container.clientHeight) {
          return;
        }

        // 滚动到底部（留有 3 像素偏差）
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 3) {
          isPaused = true;
          clearInterval(scrollIntervalId);

          // 停留在底部 3 秒，然后平滑滚回顶部
          pauseTimeoutId = setTimeout(() => {
            container.scrollTo({ top: 0, behavior: 'smooth' });
            
            // 等待 1.5 秒滚回顶部的动画执行完成，重置并重新启动滚动
            scrollBackTimeoutId = setTimeout(() => {
              isPaused = false;
              startScroll();
            }, 1500);
          }, 3000);
        } else {
          container.scrollTop += 1; // 每次前移 1 像素，顺滑稳健
        }
      }, 30); // 30 毫秒一帧，约 33 FPS，保证流畅性与极低的 CPU/GPU 负载
    };

    // 停留 3 秒再开始滚动，让观众和主持看清首屏
    startTimeoutId = setTimeout(() => {
      startScroll();
    }, 3000);

    return () => {
      clearInterval(scrollIntervalId);
      clearTimeout(startTimeoutId);
      clearTimeout(pauseTimeoutId);
      clearTimeout(scrollBackTimeoutId);
    };
  }, [isAnimating, isRolling, winnersKey]);

  // 滚动动画逻辑（带加速和减速）
  useEffect(() => {
    const MIN_SPEED = 2;      // 初始速度：每秒2次
    const MAX_SPEED = 12;     // 最大速度：每秒12次（约83ms一次，肉眼可见）
    const ACCEL_DURATION = 1000;  // 加速时间：1秒
    const DECEL_DURATION = 1500;  // 减速时间：1.5秒

    if (isRolling && phaseRef.current === 'idle') {
      // 开始动画：进入加速阶段
      phaseRef.current = 'accelerating';
      setIsAnimating(true);
      speedRef.current = MIN_SPEED;
      lastUpdateRef.current = Date.now();

      const startTime = Date.now();
      let decelStartTime = 0;
      let decelStartSpeed = MAX_SPEED;

      const update = () => {
        const now = Date.now();

        // 根据当前阶段计算速度
        if (phaseRef.current === 'accelerating') {
          const elapsed = now - startTime;
          if (elapsed < ACCEL_DURATION) {
            // easeOut 加速曲线
            const progress = elapsed / ACCEL_DURATION;
            speedRef.current = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * (1 - Math.pow(1 - progress, 2));
          } else {
            phaseRef.current = 'running';
            speedRef.current = MAX_SPEED;
          }
        } else if (phaseRef.current === 'decelerating') {
          if (decelStartTime === 0) {
            decelStartTime = now;
            decelStartSpeed = speedRef.current;
          }
          const elapsed = now - decelStartTime;
          if (elapsed < DECEL_DURATION) {
            // easeOut 减速曲线
            const progress = elapsed / DECEL_DURATION;
            speedRef.current = decelStartSpeed * Math.pow(1 - progress, 2);
          } else {
            // 动画结束
            phaseRef.current = 'idle';
            setIsAnimating(false);
            cancelAnimationFrame(animationRef.current);
            return;
          }
        }

        // 根据当前速度决定是否更新名字
        const interval = 1000 / Math.max(speedRef.current, 0.5);
        if (now - lastUpdateRef.current >= interval) {
          setDisplayNames(generateMockNames(candidatesRef.current, 12));
          lastUpdateRef.current = now;
        }

        animationRef.current = requestAnimationFrame(update);
      };

      animationRef.current = requestAnimationFrame(update);
    } else if (!isRolling && (phaseRef.current === 'accelerating' || phaseRef.current === 'running')) {
      // 用户停止：进入减速阶段
      phaseRef.current = 'decelerating';
    }

    return () => {
      if (phaseRef.current === 'idle') {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRolling]);

  // 如果动画完全停止且有中奖者，显示中奖者
  const showWinners = !isAnimating && !isRolling && currentWinners.length > 0;

  const totalPages = Math.ceil(currentWinners.length / winnersPerPage);

  const currentPageWinners = scrollMode === 'page'
    ? currentWinners.slice(currentPage * winnersPerPage, (currentPage + 1) * winnersPerPage)
    : currentWinners;

  const layoutBaseCount = scrollMode === 'page' ? winnersPerPage : currentWinners.length;

  const winnerNameClass =
    layoutBaseCount > 40
      ? "text-lg md:text-xl"
      : layoutBaseCount > 24
        ? "text-xl md:text-2xl"
        : layoutBaseCount > 12
          ? "text-2xl md:text-3xl"
          : "text-4xl md:text-5xl";
  const winnerCardPadding =
    layoutBaseCount > 40
      ? "p-4"
      : layoutBaseCount > 24
        ? "p-5"
        : "p-8";
  const winnerCardMinWidth =
    layoutBaseCount > 40
      ? 140
      : layoutBaseCount > 24
        ? 160
        : 220;

  // 当中奖名单改变时，重置当前页码
  useEffect(() => {
    setCurrentPage(0);
  }, [winnersKey]);

  // 演示翻页模式的键盘/翻页笔控制
  useEffect(() => {
    if (!showWinners || scrollMode !== 'page') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免输入框冲突
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setCurrentPage(prev => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showWinners, scrollMode, totalPages]);

  // 监听中奖展示，触发撒花特效
  useEffect(() => {
    if (showWinners) {
        // 从左右两侧发射礼花
        const end = Date.now() + 3000;
        const colors = ['#FFD700', '#FF4500', '#FFFFFF'];
        let animationId: number;

        (function frame() {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.8 },
                colors: colors
            });
            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.8 },
                colors: colors
            });

            if (Date.now() < end) {
                animationId = requestAnimationFrame(frame);
            }
        }());

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    }
  }, [showWinners]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    handleFullscreenChange();
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      {/* Background with overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0" 
        style={{ backgroundImage: `url(${bgImg})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white via-stone-100/98 to-white dark:from-black dark:via-zinc-950/98 dark:to-black" />
        
        {/* 2027 Neo-Luxury Ambient Aura Lighting */}
        <div className="absolute top-[10%] left-[5%] w-[60vw] h-[60vw] rounded-full bg-amber-300/10 dark:bg-yellow-500/5 blur-[150px] animate-[pulse_12s_infinite_alternate] pointer-events-none" />
        <div className="absolute bottom-[5%] right-[5%] w-[65vw] h-[65vw] rounded-full bg-orange-300/10 dark:bg-amber-500/5 blur-[160px] animate-[pulse_15s_infinite_alternate] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] rounded-full bg-rose-200/20 dark:bg-red-950/15 blur-[120px] animate-[pulse_9s_infinite] pointer-events-none" />

        {/* Ambient Gold Particle Flow (CSS-only ultra-smooth sparkles) */}
        <div className="absolute inset-0 overflow-hidden opacity-60 dark:opacity-40 pointer-events-none z-0">
          <div className="absolute w-2 h-2 rounded-full bg-amber-500/50 dark:bg-yellow-500/40 blur-[1px] animate-[sparkle_10s_infinite] top-[90%] left-[15%]" />
          <div className="absolute w-3.5 h-3.5 rounded-full bg-amber-500/35 dark:bg-amber-400/25 blur-[2.5px] animate-[sparkle_15s_infinite] top-[90%] left-[75%]" style={{ animationDelay: '2.5s' }} />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-600/60 dark:bg-yellow-300/50 blur-[1px] animate-[sparkle_8s_infinite] top-[90%] left-[35%]" style={{ animationDelay: '4.5s' }} />
          <div className="absolute w-2.5 h-2.5 rounded-full bg-amber-500/45 dark:bg-yellow-500/35 blur-[1.5px] animate-[sparkle_12s_infinite] top-[90%] left-[55%]" style={{ animationDelay: '1.2s' }} />
          <div className="absolute w-2 h-2 rounded-full bg-amber-600/55 dark:bg-amber-500/45 blur-[1px] animate-[sparkle_18s_infinite] top-[90%] left-[85%]" style={{ animationDelay: '6s' }} />
          <div className="absolute w-3 h-3 rounded-full bg-amber-500/40 dark:bg-yellow-400/30 blur-[2px] animate-[sparkle_14s_infinite] top-[90%] left-[25%]" style={{ animationDelay: '8s' }} />
        </div>
      </div>

      {/* Main Content */}
      <div className="z-10 w-full h-full flex items-center justify-center">
        <AnimatePresence mode="wait">
          
          {/* 模式 1: 欢迎页 */}
          {viewMode === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center justify-center text-center p-8 relative"
            >
              {/* Golden circular backdrop glow */}
              <div className="absolute w-[500px] h-[500px] bg-gradient-to-tr from-amber-400/20 dark:from-yellow-500/10 to-transparent blur-[120px] rounded-full pointer-events-none -z-10" />

              {settings.logo && (
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 50 }}
                  className="relative mb-10 group"
                >
                  <div className="absolute inset-0 bg-yellow-500/15 blur-2xl rounded-full group-hover:bg-yellow-500/25 transition-all duration-700 pointer-events-none" />
                  <img
                    src={settings.logo}
                    alt="Logo"
                    className="max-h-36 md:max-h-48 w-auto relative drop-shadow-[0_4px_30px_rgba(255,215,0,0.25)] transition-transform duration-700 group-hover:scale-105"
                  />
                </motion.div>
              )}
              
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="relative"
              >
                <h2 className="text-amber-700/80 dark:text-yellow-500/90 text-2xl md:text-4xl font-cinzel tracking-[0.4em] uppercase mb-4 drop-shadow-[0_0_15px_rgba(234,179,8,0.25)] font-bold">
                  {settings.welcomeSubtitle || "Welcome"}
                </h2>
                
                {/* Horizontal Divider Line */}
                <div className="w-32 h-[1px] bg-gradient-to-r from-transparent via-amber-600/60 dark:via-yellow-500/60 to-transparent mx-auto my-6" />

                <h1 className="text-6xl md:text-9xl font-black font-cinzel tracking-wider drop-shadow-[0_0_40px_rgba(255,215,0,0.5)] leading-none select-none bg-gradient-to-b from-gray-900 via-gray-800 to-amber-700 dark:from-white dark:via-white dark:to-amber-200 bg-clip-text text-transparent py-2">
                  {settings.welcomeTitle || "ANNUAL PARTY"}
                </h1>
              </motion.div>
            </motion.div>
          )}

          {/* 模式 2: 奖项展示页 */}
          {viewMode === 'prize' && (
            <motion.div
              key="prize"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-7xl px-8 flex flex-col items-center justify-center flex-1"
            >
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-amber-600 dark:text-yellow-500 text-3xl md:text-5xl font-cinzel tracking-[0.3em] uppercase mb-12 drop-shadow-[0_0_20px_rgba(255,215,0,0.5)]"
              >
                {settings.prizePageTitle || "今日奖项"}
              </motion.h2>
              <div className="flex flex-nowrap justify-center gap-8 w-full p-6 -m-6">
                {prizes.map((prize, idx) => (
                  <motion.div
                    key={prize.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + idx * 0.1, type: "spring" }}
                    className="relative group max-w-md flex-1"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-400/15 dark:from-yellow-600/30 to-red-300/15 dark:to-red-900/40 blur-2xl rounded-3xl group-hover:blur-3xl transition-all" />
                    <div className="relative bg-white/70 dark:bg-black/60 backdrop-blur-md border-2 border-amber-400/50 dark:border-yellow-500/40 p-8 rounded-3xl flex flex-col items-center justify-center text-center hover:border-amber-500 dark:hover:border-yellow-500/80 transition-all shadow-[0_4px_30px_rgba(180,130,0,0.12)] dark:shadow-[0_0_40px_rgba(255,215,0,0.15)] min-h-[280px]">
                      <div className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white font-cinzel mb-3 drop-shadow-lg">{prize.name}</div>
                      <div className="text-amber-700 dark:text-yellow-400 text-2xl font-bold mb-4">× {prize.count} 名</div>
                      {prize.description && (
                        <div className="mt-4 pt-4 border-t-2 border-amber-400/40 dark:border-yellow-500/30 w-full">
                          <div className="text-amber-800 dark:text-yellow-100 text-xl md:text-2xl font-medium drop-shadow-md">
                            {prize.description}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 模式 3: 抽奖页 */}
          {viewMode === 'lottery' && (
            <motion.div
              key="lottery"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-[90vw] h-[85vh] px-4 flex flex-col items-center justify-between gap-6"
            >
              <style dangerouslySetInnerHTML={{__html: `
                .no-scrollbar::-webkit-scrollbar {
                  display: none;
                }
              `}} />

              {/* Title / Prize Info (置顶且固定，防止滚动遮挡) */}
              <div className="text-center shrink-0">
                <h2 className="text-xl md:text-2xl font-cinzel tracking-[0.3em] uppercase mb-1 text-amber-600 dark:text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)] font-semibold">
                  {settings.title}
                </h2>
                <h1 className="text-5xl md:text-7xl font-cinzel font-black text-gray-900 dark:text-white drop-shadow-[0_0_30px_rgba(255,215,0,0.4)] tracking-wide">
                  {currentPrize?.name || "Ready"}
                </h1>
                <div className="mt-3 flex items-center justify-center gap-2 text-gray-700 dark:text-white/90">
                  <span className="text-base font-sans tracking-wide">本轮抽取: <span className="text-amber-600 dark:text-yellow-400 font-extrabold text-2xl drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] font-mono">{currentPrize?.count}</span> 人</span>
                </div>
                <div className="w-64 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 dark:via-yellow-500/40 to-transparent mx-auto mt-4 blur-[0.5px]" />
              </div>

              {/* Rolling Area / Winner Display (中奖者列表滚动容器) */}
              <div 
                ref={scrollContainerRef}
                className={cn(
                  "w-full flex-1 min-h-0 overflow-y-auto no-scrollbar relative py-2",
                  !showWinners && "flex items-center justify-center perspective-1000"
                )}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <AnimatePresence mode="wait">
                  {showWinners ? (
                    // Winner Display
                    <div className="w-full relative h-full">
                      {scrollMode === 'page' ? (
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={currentPage}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.02 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="w-full"
                          >
                            <div
                              className="grid gap-4 w-full"
                              style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${winnerCardMinWidth}px, 1fr))` }}
                            >
                              {currentPageWinners.map((winner, idx) => (
                                <motion.div
                                  key={winner.id}
                                  initial={{ opacity: 0, y: 30 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.03, type: "spring" }}
                                  className="relative group"
                                >
                                  <div className="absolute inset-0 bg-gradient-to-br from-amber-300/15 dark:from-yellow-500/10 via-rose-200/15 dark:via-red-950/20 to-amber-400/10 dark:to-yellow-600/5 blur-2xl rounded-2xl group-hover:blur-3xl transition-all duration-500" />
                                  <div className={`relative bg-white/75 dark:bg-zinc-950/65 backdrop-blur-xl border border-amber-300/40 dark:border-yellow-500/25 ${winnerCardPadding} rounded-2xl flex flex-col items-center justify-center text-center hover:border-amber-500 dark:hover:border-yellow-500/80 transition-all duration-500 shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.6),0_0_15px_rgba(234,179,8,0.05)] hover:shadow-[0_20px_40px_rgba(180,130,0,0.18)] dark:hover:shadow-[0_20px_40px_rgba(234,179,8,0.25),0_0_30px_rgba(234,179,8,0.1)] hover:-translate-y-2.5 overflow-hidden group cursor-default min-h-[120px]`}>
                                    {/* Shimmer sweep effect */}
                                    <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-amber-500/8 dark:via-yellow-500/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" style={{ backgroundImage: 'linear-gradient(120deg, transparent 30%, rgba(180,130,0,0.08) 40%, rgba(180,130,0,0.12) 50%, rgba(180,130,0,0.08) 60%, transparent 70%)', backgroundSize: '200% 100%' }} />
                                    
                                    <div className={`${winnerNameClass} font-bold text-gray-900 dark:text-white font-cinzel drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-tight break-words tracking-wide group-hover:text-amber-700 dark:group-hover:text-yellow-100 transition-colors`}>{winner.name}</div>
                                    {settings.showDept && winner.dept && (
                                      <div className="text-amber-700/90 dark:text-yellow-400/90 text-sm md:text-base mt-2.5 font-medium drop-shadow-md tracking-wider">{winner.dept}</div>
                                    )}
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      ) : (
                        <div
                          className="grid gap-4 w-full"
                          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${winnerCardMinWidth}px, 1fr))` }}
                        >
                          {currentWinners.map((winner, idx) => (
                            <motion.div
                              key={winner.id}
                              initial={{ opacity: 0, y: 30 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.05, type: "spring" }}
                              className="relative group"
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-amber-300/15 dark:from-yellow-500/10 via-rose-200/15 dark:via-red-950/20 to-amber-400/10 dark:to-yellow-600/5 blur-2xl rounded-2xl group-hover:blur-3xl transition-all duration-500" />
                              <div className={`relative bg-white/75 dark:bg-zinc-950/65 backdrop-blur-xl border border-amber-300/40 dark:border-yellow-500/25 ${winnerCardPadding} rounded-2xl flex flex-col items-center justify-center text-center hover:border-amber-500 dark:hover:border-yellow-500/80 transition-all duration-500 shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.6),0_0_15px_rgba(234,179,8,0.05)] hover:shadow-[0_20px_40px_rgba(180,130,0,0.18)] dark:hover:shadow-[0_20px_40px_rgba(234,179,8,0.25),0_0_30px_rgba(234,179,8,0.1)] hover:-translate-y-2.5 overflow-hidden group cursor-default min-h-[120px]`}>
                                {/* Shimmer sweep effect */}
                                <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-amber-500/8 dark:via-yellow-500/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" style={{ backgroundImage: 'linear-gradient(120deg, transparent 30%, rgba(180,130,0,0.08) 40%, rgba(180,130,0,0.12) 50%, rgba(180,130,0,0.08) 60%, transparent 70%)', backgroundSize: '200% 100%' }} />
                                
                                <div className={`${winnerNameClass} font-bold text-gray-900 dark:text-white font-cinzel drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-tight break-words tracking-wide group-hover:text-amber-700 dark:group-hover:text-yellow-100 transition-colors`}>{winner.name}</div>
                                {settings.showDept && winner.dept && (
                                  <div className="text-amber-700/90 dark:text-yellow-400/90 text-sm md:text-base mt-2.5 font-medium drop-shadow-md tracking-wider">{winner.dept}</div>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Rolling State
                    <motion.div 
                      key="rolling"
                      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full opacity-80"
                    >
                      {displayNames.slice(0, 12).map((item, i) => (
                        <div key={i} className="bg-black/5 dark:bg-white/5 backdrop-blur-sm border border-black/10 dark:border-white/10 p-6 rounded-lg flex flex-col items-center justify-center min-h-[100px]">
                           <span className={cn(
                             "text-3xl font-bold text-gray-900/90 dark:text-white/90 font-mono transition-all duration-75",
                             isAnimating && "blur-[1px] scale-105"
                           )}>
                             {item.name}
                           </span>
                           {settings.showDept && item.dept && (
                             <span className="text-gray-500 dark:text-white/60 text-xs mt-1.5 block font-sans">{item.dept}</span>
                           )}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Edge page turns and bottom indicators for Page Scroll Mode */}
              {showWinners && scrollMode === 'page' && totalPages > 1 && (
                <>
                  {/* Left Arrow Button */}
                  {currentPage > 0 && (
                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))}
                      className="absolute left-6 top-1/2 -translate-y-1/2 z-30 bg-white/70 dark:bg-black/60 hover:bg-amber-100 dark:hover:bg-yellow-500/20 text-amber-600 dark:text-yellow-500 hover:text-amber-700 dark:hover:text-yellow-400 border border-amber-400/50 dark:border-yellow-500/40 hover:border-amber-500 dark:hover:border-yellow-500 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur group cursor-pointer"
                    >
                      <ChevronLeft className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    </button>
                  )}

                  {/* Right Arrow Button */}
                  {currentPage < totalPages - 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1))}
                      className="absolute right-6 top-1/2 -translate-y-1/2 z-30 bg-white/70 dark:bg-black/60 hover:bg-amber-100 dark:hover:bg-yellow-500/20 text-amber-600 dark:text-yellow-500 hover:text-amber-700 dark:hover:text-yellow-400 border border-amber-400/50 dark:border-yellow-500/40 hover:border-amber-500 dark:hover:border-yellow-500 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur group cursor-pointer"
                    >
                      <ChevronRight className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    </button>
                  )}

                  {/* Bottom Dot Indicators */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-white/70 dark:bg-black/60 px-5 py-2.5 rounded-full border border-amber-400/40 dark:border-yellow-500/30 backdrop-blur-md">
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentPage(idx)}
                        className={cn(
                          "transition-all duration-500 ease-out cursor-pointer h-2.5 rounded-full",
                          idx === currentPage 
                            ? "bg-gradient-to-r from-amber-500 to-orange-600 dark:from-yellow-400 dark:to-amber-500 w-8 shadow-[0_0_12px_rgba(200,150,0,0.5)] dark:shadow-[0_0_12px_rgba(250,204,21,0.6)]" 
                            : "bg-black/15 dark:bg-white/20 hover:bg-black/30 dark:hover:bg-white/40 w-2.5"
                        )}
                      />
                    ))}
                    <span className="text-amber-700/80 dark:text-yellow-500/80 text-sm font-mono font-bold ml-2 select-none">
                      {currentPage + 1} / {totalPages}
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {!isFullscreen && (
        <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-3">
          <button
            type="button"
            title="全屏显示"
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen?.();
                return;
              }
              document.documentElement.requestFullscreen?.();
            }}
            className="h-10 w-10 rounded-full bg-black/5 dark:bg-white/10 text-gray-700 dark:text-white border border-black/10 dark:border-white/20 backdrop-blur hover:bg-black/10 dark:hover:bg-white/20 hover:border-black/20 dark:hover:border-white/40 flex items-center justify-center"
          >
            <Maximize2 className="h-5 w-5" />
          </button>
          <a
            href="#/admin"
            title="进入后台管理"
            className="h-10 w-10 rounded-full bg-black/5 dark:bg-white/10 text-gray-700 dark:text-white border border-black/10 dark:border-white/20 backdrop-blur hover:bg-black/10 dark:hover:bg-white/20 hover:border-black/20 dark:hover:border-white/40 flex items-center justify-center"
          >
            <Settings className="h-5 w-5" />
          </a>
        </div>
      )}
    </div>
  );
}
