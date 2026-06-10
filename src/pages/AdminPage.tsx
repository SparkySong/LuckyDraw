import { useState, useEffect, useRef } from "react";
import { useLotteryStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Download, Upload, Trash, Play, Square,
  ShieldAlert, MonitorPlay, LogOut,
  Plus, Pencil, Search, Sun, Moon
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { SAMPLE_CSV } from "@/assets/sample";
import { cn } from "@/lib/utils";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // 从 sessionStorage 恢复登录状态（关闭浏览器后失效）
    return sessionStorage.getItem('admin_authenticated') === 'true';
  });
  const {
    participants, winners, prizes, settings, currentPrizeId, isRolling, roundWinners, viewMode,
    importParticipants, fullReset, resetWinners,
    addPrize, updatePrize, removePrize, setSettings, selectPrize, setViewMode,
    startRolling, stopRolling,
    addParticipant, updateParticipant, removeParticipant
  } = useLotteryStore();

  const { theme, toggleTheme } = useTheme();

  const [csvText, setCsvText] = useState("");


  // 受控模式解锁：通过 URL 参数 ?controlled=1 解锁必中/禁中/权重功能
  // 支持两种格式：
  // 1. http://localhost:8081/?controlled=1#/admin
  // 2. http://localhost:8081/#/admin?controlled=1
  const [controlledModeUnlocked, setControlledModeUnlocked] = useState(false);

  useEffect(() => {
    // 先尝试从 location.search 获取（标准格式）
    let params = new URLSearchParams(window.location.search);
    if (params.get('controlled') === '1') {
      setControlledModeUnlocked(true);
      return;
    }
    // 再尝试从 hash 中解析（hash 路由格式）
    const hash = window.location.hash;
    const hashQueryIndex = hash.indexOf('?');
    if (hashQueryIndex !== -1) {
      params = new URLSearchParams(hash.slice(hashQueryIndex));
      setControlledModeUnlocked(params.get('controlled') === '1');
    }
  }, []);
  
  // Person Edit State
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", dept: "", phone: "", mustWinPrizeId: "none", bannedPrizes: [] as string[], weight: 1 });

  // Prize Edit State
  const [editingPrize, setEditingPrize] = useState<any>(null);
  const [isPrizeDialogOpen, setIsPrizeDialogOpen] = useState(false);
  const [prizeForm, setPrizeForm] = useState({ name: "", count: 1, description: "", deptQuotas: {} as Record<string, number> });
  const [countInput, setCountInput] = useState("1");
  const [deptSearch, setDeptSearch] = useState("");
  const [deptPopoverOpen, setDeptPopoverOpen] = useState(false);
  const [quotaInputs, setQuotaInputs] = useState<Record<string, string>>({});
  const deptSelectLockRef = useRef(false);

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState({
    title: settings.title,
    welcomeTitle: settings.welcomeTitle,
    welcomeSubtitle: settings.welcomeSubtitle,
    prizePageTitle: settings.prizePageTitle || '',
    password: settings.password,
    logo: settings.logo || '',
    showDept: settings.showDept || false,
    scrollMode: settings.scrollMode || 'none',
    winnersPerPage: settings.winnersPerPage || 24,
  });

  // 当 settings 变化时同步到表单（首次加载或外部变化）
  useEffect(() => {
    setSettingsForm({
      title: settings.title,
      welcomeTitle: settings.welcomeTitle,
      welcomeSubtitle: settings.welcomeSubtitle,
      prizePageTitle: settings.prizePageTitle || '',
      password: settings.password,
      logo: settings.logo || '',
      showDept: settings.showDept || false,
      scrollMode: settings.scrollMode || 'none',
      winnersPerPage: settings.winnersPerPage || 24,
    });
  }, [settings.title, settings.welcomeTitle, settings.welcomeSubtitle, settings.prizePageTitle, settings.password, settings.logo, settings.showDept, settings.scrollMode, settings.winnersPerPage]);

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  const handleLogin = () => {
    if (password === settings.password) {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_authenticated', 'true');
      toast.success("已解锁控制台");
    } else {
      toast.error("密码错误");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('admin_authenticated');
    toast.success("已退出登录");
  };

  const handleSaveSettings = () => {
    setSettings(settingsForm);
    toast.success("设置已保存");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件大小（限制 500KB）
    if (file.size > 500 * 1024) {
      toast.error("图片大小不能超过 500KB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSettingsForm({ ...settingsForm, logo: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSettingsForm({ ...settingsForm, logo: '' });
  };

  const handleImport = () => {
    if (!csvText.trim()) {
      toast.error("请粘贴数据后再点击执行导入");
      return;
    }
    const res = importParticipants(csvText, controlledModeUnlocked);
    if (res.success) {
      toast.success(`成功导入 ${res.count} 人`);
      setCsvText("");
    } else {
      toast.error(res.error);
    }
  };

  const handleDownloadTemplate = () => {
    const bom = "\uFEFF";
    const blob = new Blob([bom + SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'import_template.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleExportWinnersImage = () => {
    if (winners.length === 0) {
      toast.error("暂无中奖记录");
      return;
    }

    const prizeNameMap = new Map(prizes.map(p => [p.id, p.name]));
    const sortedWinners = [...winners].sort((a, b) => a.wonAt - b.wonAt);
    const rows = sortedWinners;

    const width = 1080;
    const rowHeight = 48;
    const headerHeight = 260;
    const footerHeight = 80;
    const tableHeaderHeight = 56;
    const height = headerHeight + tableHeaderHeight + rows.length * rowHeight + footerHeight;

    const canvas = document.createElement("canvas");
    const scale = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0b0b0f");
    gradient.addColorStop(1, "#1a0f0a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255, 215, 0, 0.08)";
    for (let i = 0; i < 80; i++) {
      const x = (i * 137) % width;
      const y = (i * 83) % height;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#f5d76e";
    ctx.font = "700 44px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(settings.title || "Lucky Draw", 64, 88);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 56px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("中奖记录", 64, 150);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "16px system-ui, -apple-system, Segoe UI, sans-serif";
    const nowText = new Date().toLocaleString();
    ctx.fillText(`导出时间：${nowText}`, 64, 190);
    ctx.fillText(`记录总数：${winners.length}`, 64, 216);

    const tableTop = headerHeight;
    ctx.fillStyle = "rgba(255, 215, 0, 0.12)";
    ctx.fillRect(48, tableTop, width - 96, tableHeaderHeight);

    ctx.fillStyle = "#f5d76e";
    ctx.font = "600 18px system-ui, -apple-system, Segoe UI, sans-serif";
    const colXs = {
      idx: 72,
      name: 150,
      dept: 280,
      phone: 420,
      prize: 560,
      time: 740,
    };
    ctx.fillText("序号", colXs.idx, tableTop + 34);
    ctx.fillText("姓名", colXs.name, tableTop + 34);
    ctx.fillText("部门", colXs.dept, tableTop + 34);
    ctx.fillText("手机号", colXs.phone, tableTop + 34);
    ctx.fillText("奖项", colXs.prize, tableTop + 34);
    ctx.fillText("时间", colXs.time, tableTop + 34);

    ctx.font = "16px system-ui, -apple-system, Segoe UI, sans-serif";
    rows.forEach((w, i) => {
      const y = tableTop + tableHeaderHeight + i * rowHeight;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)";
      ctx.fillRect(48, y, width - 96, rowHeight);

      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(i + 1), colXs.idx, y + 30);
      ctx.fillText(w.name, colXs.name, y + 30);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(w.dept || "-", colXs.dept, y + 30);
      ctx.fillText(w.phone || "-", colXs.phone, y + 30);
      ctx.fillStyle = "#f5d76e";
      ctx.fillText(prizeNameMap.get(w.prizeId) || "-", colXs.prize, y + 30);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(new Date(w.wonAt).toLocaleString(), colXs.time, y + 30);
    });

    let footerTop = tableTop + tableHeaderHeight + rows.length * rowHeight;

    ctx.strokeStyle = "rgba(255,215,0,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(48, tableTop, width - 96, footerTop - tableTop);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `winners-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    });
  };

  const openAddDialog = () => {
    setEditingPerson(null);
    setEditForm({ name: "", dept: "", phone: "", mustWinPrizeId: "none", bannedPrizes: [], weight: 1 });
    setIsDialogOpen(true);
  };

  const openEditDialog = (person: any) => {
    setEditingPerson(person);
    setEditForm({
        name: person.name,
        dept: person.dept,
        phone: person.phone || "",
        mustWinPrizeId: person.mustWinPrizeId || "none",
        bannedPrizes: person.bannedPrizes || [],
        weight: person.weight
    });
    setIsDialogOpen(true);
  };

  const savePerson = () => {
    if (!editForm.name) {
        toast.error("姓名不能为空");
        return;
    }
    const payload = {
        ...editForm,
        mustWinPrizeId: editForm.mustWinPrizeId === "none" ? null : editForm.mustWinPrizeId
    };

    if (editingPerson) {
        updateParticipant(editingPerson.id, payload);
        toast.success("更新成功");
    } else {
        addParticipant(payload);
        toast.success("添加成功");
    }
    setIsDialogOpen(false);
  };

  // Prize edit functions
  const openAddPrizeDialog = () => {
    setEditingPrize(null);
    setPrizeForm({ name: "", count: 1, description: "", deptQuotas: {} });
    setCountInput("1");
    setQuotaInputs({});
    setIsPrizeDialogOpen(true);
  };

  const openEditPrizeDialog = (prize: any) => {
    setEditingPrize(prize);
    setPrizeForm({
      name: prize.name,
      count: prize.count,
      description: prize.description || "",
      deptQuotas: prize.deptQuotas ? { ...prize.deptQuotas } : {}
    });
    setCountInput(String(prize.count));
    setQuotaInputs({});
    setIsPrizeDialogOpen(true);
  };

  const savePrize = () => {
    if (!prizeForm.name) {
      toast.error("奖项名称不能为空");
      return;
    }
    if (prizeForm.count < 1) {
      toast.error("中奖人数至少为1");
      return;
    }

    // 过滤掉配额为0的部门
    const filteredQuotas: Record<string, number> = {};
    for (const [dept, quota] of Object.entries(prizeForm.deptQuotas)) {
      if (quota > 0) filteredQuotas[dept] = quota;
    }
    const hasDeptQuotas = Object.keys(filteredQuotas).length > 0;

    // 中奖人数不低于配额总和，不足时自动调整
    let finalCount = prizeForm.count;
    if (hasDeptQuotas) {
      const quotaSum = Object.values(filteredQuotas).reduce((s, q) => s + q, 0);
      if (finalCount < quotaSum) {
        finalCount = quotaSum;
      }
    }

    const prizeData = {
      name: prizeForm.name,
      count: finalCount,
      description: prizeForm.description,
      deptQuotas: hasDeptQuotas ? filteredQuotas : undefined,
    };

    if (editingPrize) {
      updatePrize(editingPrize.id, prizeData);
      toast.success("奖项更新成功");
    } else {
      addPrize(prizeForm.name, finalCount);
      const newPrizes = useLotteryStore.getState().prizes;
      const newPrize = newPrizes[newPrizes.length - 1];
      if (newPrize) {
        const updates: Record<string, any> = {};
        if (prizeForm.description) updates.description = prizeForm.description;
        if (hasDeptQuotas) updates.deptQuotas = filteredQuotas;
        if (Object.keys(updates).length > 0) {
          updatePrize(newPrize.id, updates);
        }
      }
      toast.success("奖项添加成功");
    }
    setIsPrizeDialogOpen(false);
  };

  const handleDeletePrize = (id: string) => {
    if (confirm("确定要删除此奖项吗？")) {
      removePrize(id);
      toast.success("奖项已删除");
    }
  };

  // 强制轮询同步
  useEffect(() => {
    const timer = setInterval(() => {
      useLotteryStore.persist.rehydrate();
    }, 1000); 
    return () => clearInterval(timer);
  }, []);

  // 快捷键支持
  useEffect(() => {
    if (!isAuthenticated) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        isRolling ? stopRolling() : startRolling();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, isRolling]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader className="text-center">
            <CardTitle>后台管理系统</CardTitle>
            <CardDescription>请输入管理员密码</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input 
              type="password" 
              placeholder="密码" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <Button className="w-full" onClick={handleLogin}>登录</Button>
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <div>默认密码：appinn</div>
              <div>数据保存在本地浏览器（localStorage），清理缓存会丢失。</div>
              <div>如需大屏展示，请先登录后打开右上角“打开大屏端”。</div>
            </div>
            <div className="text-center text-xs text-muted-foreground mt-4">
              <a href="#/" target="_blank" className="hover:underline flex items-center justify-center gap-1">
                <MonitorPlay className="w-3 h-3"/> 打开大屏显示端
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPrize = prizes.find(p => p.id === currentPrizeId);
  const filteredParticipants = participants.filter(p => 
    p.name.includes(searchTerm) || p.dept.includes(searchTerm) || (p.phone || '').includes(searchTerm)
  );
  const winnerIds = new Set(winners.map(w => w.id));
  const validPool = participants.filter(p => !winnerIds.has(p.id) && (currentPrizeId ? !(p.bannedPrizes || []).includes(currentPrizeId) : true));
  const finalPool = currentPrizeId
    ? validPool.filter(p => !p.mustWinPrizeId || p.mustWinPrizeId === currentPrizeId)
    : [];

  // canStart 判断：支持部门配额校验
  let canStart = Boolean(currentPrize) && finalPool.length > 0;
  if (canStart && currentPrize?.deptQuotas && Object.keys(currentPrize.deptQuotas).length > 0) {
    // 检查总候选池是否足够
    if (finalPool.length < (currentPrize?.count || 0)) {
      canStart = false;
    } else {
      // 检查每个部门候选人数是否足够配额
      const deptCounts: Record<string, number> = {};
      for (const p of finalPool) {
        const dept = p.dept || "未分组";
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      }
      for (const [dept, quota] of Object.entries(currentPrize.deptQuotas)) {
        if (quota > 0 && (deptCounts[dept] || 0) < quota) {
          canStart = false;
          break;
        }
      }
    }
  }

  const startDisabled = !isRolling && !canStart;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2 font-bold text-lg">
          <ShieldAlert className="w-5 h-5 text-primary"/>
          {settings.title}
        </div>
        <div className="flex items-center gap-3">

           <Button variant="ghost" size="icon" onClick={toggleTheme} title="切换主题" className="w-8 h-8 group">
             <span className="[&>svg]:transition-transform [&>svg]:duration-300 group-hover:[&>svg]:rotate-12">
               {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
             </span>
           </Button>
           <Button variant="outline" size="sm" asChild>
             <a href="#/" target="_blank"><MonitorPlay className="w-4 h-4 mr-2"/> 打开大屏端</a>
           </Button>
           <a
             href="https://github.com/song0001/LuckyDraw"
             target="_blank"
             rel="noreferrer"
             className="text-sm text-muted-foreground hover:text-foreground hover:underline"
           >
             GitHub
           </a>
           <Badge variant={isRolling ? "destructive" : "secondary"}>
             {isRolling ? "抽奖进行中..." : "等待指令"}
           </Badge>
           <Button variant="ghost" size="sm" onClick={handleLogout} title="退出登录">
             <LogOut className="w-4 h-4"/>
           </Button>
        </div>
      </header>

      <main className="flex-1 p-6 flex flex-col gap-6">
        
        {/* 核心控制区 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-shrink-0">
          {/* 左侧：奖项选择与控制 */}
          <Card className="lg:col-span-2 border-primary/20 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle>现场控制 (Live Control)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* 场景切换 */}
              <div className="space-y-2">
                <Label>大屏场景</Label>
                <div className="flex gap-3 p-2 bg-muted/30 rounded-xl w-fit border-2 border-dashed border-muted-foreground/20">
                   <Button
                     variant={viewMode === 'welcome' ? 'default' : 'outline'}
                     onClick={() => setViewMode('welcome')}
                     disabled={isRolling}
                     className={cn(
                       "w-24 h-24 flex flex-col gap-2 text-base",
                       viewMode === 'welcome' && "ring-2 ring-primary ring-offset-2"
                     )}
                   >
                     <span className="text-3xl">🎉</span>
                     <span>欢迎页</span>
                   </Button>
                   <Button
                     variant={viewMode === 'prize' ? 'default' : 'outline'}
                     onClick={() => setViewMode('prize')}
                     disabled={isRolling}
                     className={cn(
                       "w-24 h-24 flex flex-col gap-2 text-base",
                       viewMode === 'prize' && "ring-2 ring-primary ring-offset-2"
                     )}
                   >
                     <span className="text-3xl">🎁</span>
                     <span>奖项页</span>
                   </Button>
                   <Button
                     variant={viewMode === 'lottery' ? 'default' : 'outline'}
                     onClick={() => setViewMode('lottery')}
                     disabled={isRolling}
                     className={cn(
                       "w-24 h-24 flex flex-col gap-2 text-base",
                       viewMode === 'lottery' && "ring-2 ring-primary ring-offset-2"
                     )}
                   >
                     <span className="text-3xl">🎰</span>
                     <span>抽奖页</span>
                   </Button>
                </div>
              </div>
              
              {/* 奖项切换 */}
              <div className="space-y-2">
                <Label>当前抽取的奖项 <span className="text-xs text-muted-foreground">(点击选择，双击编辑)</span></Label>
                <div className="flex flex-wrap gap-2 items-center">
                  {prizes.map(p => (
                    <Button
                      key={p.id}
                      variant={currentPrizeId === p.id ? "default" : "outline"}
                      onClick={() => selectPrize(p.id)}
                      onDoubleClick={() => !isRolling && openEditPrizeDialog(p)}
                      className="min-w-[100px] relative group flex-col gap-0.5 py-1.5 h-auto"
                      disabled={isRolling}
                    >
                      <span>{p.name} ({p.count}人)</span>
                      {p.deptQuotas && Object.keys(p.deptQuotas).length > 0 && (
                        <span className="text-[10px] opacity-70 font-normal">
                          {Object.entries(p.deptQuotas).map(([d, q]) => `${d}×${q}`).join(' ')}
                        </span>
                      )}
                      {!isRolling && (
                        <span
                          className="absolute -top-1 -right-1 hidden group-hover:flex w-4 h-4 bg-destructive text-destructive-foreground rounded-full items-center justify-center text-xs cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); handleDeletePrize(p.id); }}
                        >
                          ×
                        </span>
                      )}
                    </Button>
                  ))}
                  <Button variant="ghost" size="icon" onClick={openAddPrizeDialog} title="添加奖项" disabled={isRolling}><Plus className="w-4 h-4"/></Button>
                </div>
              </div>

              {/* 大按钮控制 */}
              <div className="flex items-center gap-4 py-4 bg-muted/30 rounded-lg justify-center border border-dashed">
                <div className="text-center space-y-2">
                  <div className="text-sm text-muted-foreground">当前奖项</div>
                  <div className="text-2xl font-bold">{currentPrize?.name || "未选择"}</div>
                </div>
                <div className="h-10 w-px bg-border mx-4"></div>
                <Button 
                  size="lg" 
                  className={cn("h-20 text-2xl px-12 transition-all", isRolling ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700")}
                  onClick={() => isRolling ? stopRolling() : startRolling()}
                  disabled={startDisabled}
                >
                  {isRolling ? (
                    <><Square className="w-6 h-6 mr-3 fill-current"/> 停止 (STOP)</>
                  ) : (
                    <><Play className="w-6 h-6 mr-3 fill-current"/> 开始 (START)</>
                  )}
                </Button>
                <div className="h-10 w-px bg-border mx-4"></div>
                <div className="text-center space-y-2">
                   <div className="text-sm text-muted-foreground">本轮结果</div>
                   <div className="text-xl font-mono">{roundWinners.length > 0 ? `${roundWinners.length} 人` : "-"}</div>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* 右侧：本轮结果预览 */}
          <Card className="gap-3 py-3 max-h-[480px] overflow-hidden">
            <CardHeader className="pb-2 px-4"><CardTitle className="text-base">本轮结果预览</CardTitle></CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4">
               {roundWinners.length === 0 ? (
                 <div className="text-center text-muted-foreground py-8">等待开奖...</div>
               ) : (
                 <Table>
                   <TableBody>
                     {roundWinners.map(w => (
                       <TableRow key={w.id}>
                         <TableCell className="font-bold">{w.name}</TableCell>
                         <TableCell className="text-xs text-muted-foreground">{w.dept}</TableCell>
                         {controlledModeUnlocked && (
                           <TableCell className="text-xs">
                              {w.mustWinPrizeId && (
                                  <Badge variant="secondary" className="scale-75">内定</Badge>
                              )}
                           </TableCell>
                         )}
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               )}
            </CardContent>
          </Card>
        </div>

        {/* 数据管理区 */}
        <Tabs defaultValue="participants" className="flex flex-col">
          <TabsList>
            <TabsTrigger value="participants">人员名单管理</TabsTrigger>
            <TabsTrigger value="import">批量导入</TabsTrigger>
            <TabsTrigger value="winners">中奖记录</TabsTrigger>
            <TabsTrigger value="settings">系统设置</TabsTrigger>
          </TabsList>
          
          <div className="border rounded-md mt-2 bg-card flex flex-col">
            {/* Tab: 人员名单列表 */}
            <TabsContent value="participants" className="flex flex-col p-4 m-0">
                <div className="flex gap-4 items-center justify-between mb-4 flex-wrap">
                    <div className="flex gap-2 items-center flex-1">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="搜索姓名、部门或手机号..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <Button onClick={openAddDialog}><Plus className="w-4 h-4 mr-2"/>添加人员</Button>
                    </div>
                    {controlledModeUnlocked && (
                      <div className="flex gap-4 items-center bg-muted/50 p-2 rounded-md border">
                          <div className="text-sm flex items-center gap-2">
                              <span>必中: </span>
                              <span className="font-mono font-bold px-2 rounded min-w-[30px] text-center">
                                  {participants.filter(p=>p.mustWinPrizeId).length}
                              </span>
                          </div>
                          <div className="w-px h-4 bg-border"></div>
                          <div className="text-sm flex items-center gap-2">
                              <span>禁中: </span>
                              <span className="font-mono font-bold px-2 rounded min-w-[30px] text-center">
                                  {participants.filter(p=>(p.bannedPrizes || []).length > 0).length}
                              </span>
                          </div>
                      </div>
                    )}
                </div>

                <div className="max-h-[55vh] overflow-auto border rounded-md scrollbar-thin">
                    <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead>姓名</TableHead>
                                <TableHead>部门</TableHead>
                                <TableHead>手机号</TableHead>
                                {controlledModeUnlocked && (
                                  <>
                                    <TableHead className="text-center w-[120px]">必中设置</TableHead>
                                    <TableHead className="text-center w-[80px]">禁中</TableHead>
                                    <TableHead className="text-center w-[60px]">权重</TableHead>
                                  </>
                                )}
                                <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredParticipants.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={controlledModeUnlocked ? 7 : 4} className="text-center py-8 text-muted-foreground">
                                        无匹配数据，请先导入或添加人员
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredParticipants.map(p => {
                                    const prizeName = prizes.find(prize => prize.id === p.mustWinPrizeId)?.name;
                                    return (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-medium">{p.name}</TableCell>
                                            <TableCell>{p.dept}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground font-mono">{p.phone || '-'}</TableCell>
                                            {controlledModeUnlocked && (
                                              <>
                                                <TableCell className="text-center">
                                                    {p.mustWinPrizeId ? <Badge variant="secondary">{prizeName || '未知奖项'}</Badge> : <span className="text-muted-foreground">-</span>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {(p.bannedPrizes || []).length > 0 ? (
                                                        <div className="flex flex-wrap justify-center gap-1">
                                                            {(p.bannedPrizes || []).map(id => {
                                                                const prize = prizes.find(pr => pr.id === id);
                                                                return prize ? <Badge key={id} variant="destructive" className="text-xs">{prize.name}</Badge> : null;
                                                            })}
                                                        </div>
                                                    ) : <span className="text-muted-foreground">-</span>}
                                                </TableCell>
                                                <TableCell className="text-center text-xs font-mono text-muted-foreground">{p.weight}</TableCell>
                                              </>
                                            )}
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(p)}><Pencil className="w-4 h-4"/></Button>
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeParticipant(p.id)}><Trash className="w-4 h-4"/></Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>

            {/* Tab: 批量导入 */}
            <TabsContent value="import" className="mt-0 p-4 space-y-4">
               <div className="flex gap-4 items-start">
                 <div className="flex-1 space-y-2">
                    <Label>粘贴 CSV 数据</Label>
                    <Textarea
                      placeholder={controlledModeUnlocked
                        ? "姓名,部门,必中奖项(奖项名称),禁止中奖(是/否),权重(1-10)..."
                        : "姓名,部门..."
                      }
                      value={csvText}
                      onChange={e => setCsvText(e.target.value)}
                      className="font-mono text-xs min-h-[300px]"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleImport}><Upload className="w-4 h-4 mr-2"/> 执行导入</Button>
                      {controlledModeUnlocked && (
                        <Button variant="outline" onClick={handleDownloadTemplate}><Download className="w-4 h-4 mr-2"/> 下载 CSV 模板</Button>
                      )}
                    </div>
                 </div>
                 <div className="w-[300px] border-l pl-4 space-y-4">
                    <div className="p-4 bg-muted rounded text-sm space-y-2">
                        <div className="font-bold mb-2">数据统计</div>
                        <div>总人数: {participants.length}</div>
                        <div>已中奖: {winners.length}</div>
                        <div>剩余: {participants.length - winners.length}</div>
                    </div>
                    <Button variant="destructive" className="w-full" onClick={() => { if(confirm("确定要清空所有人员数据吗？不可恢复！")) fullReset(); }}>
                      <Trash className="w-4 h-4 mr-2"/> 清空数据库
                    </Button>
                 </div>
               </div>
            </TabsContent>

            {/* Tab: 中奖记录 */}
            <TabsContent value="winners" className="mt-0 p-4">
               <div className="flex justify-between mb-4">
                 <h3 className="font-bold text-lg">历史中奖记录</h3>
                 <div className="flex gap-2">
                   <Button variant="outline" size="sm" onClick={handleExportWinnersImage}>导出图片</Button>
                   <Button variant="outline" size="sm" onClick={() => { if(confirm("清空历史记录？")) resetWinners(); }}>重置记录</Button>
                 </div>
               </div>
               <div className="max-h-[55vh] overflow-auto scrollbar-thin">
               <Table>
                 <TableHeader><TableRow><TableHead>姓名</TableHead><TableHead>部门</TableHead><TableHead>手机号</TableHead><TableHead>奖项</TableHead><TableHead>时间</TableHead></TableRow></TableHeader>
                 <TableBody>
                   {winners.map(w => (
                     <TableRow key={w.id}>
                       <TableCell className="font-medium">{w.name}</TableCell>
                       <TableCell>{w.dept}</TableCell>
                       <TableCell className="text-xs text-muted-foreground font-mono">{w.phone || '-'}</TableCell>
                       <TableCell><Badge variant="outline">{prizes.find(p=>p.id===w.prizeId)?.name}</Badge></TableCell>
                       <TableCell className="font-mono text-muted-foreground">{new Date(w.wonAt).toLocaleTimeString()}</TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
               </div>
            </TabsContent>

            {/* Tab: 设置 */}
            <TabsContent value="settings" className="mt-0 p-6 max-w-lg space-y-6">
               <div className="space-y-2">
                 <Label>抽奖页主标题</Label>
                 <Input value={settingsForm.title} onChange={e => setSettingsForm({...settingsForm, title: e.target.value})} />
               </div>
               <div className="space-y-2">
                 <Label>欢迎页主标题</Label>
                 <Input value={settingsForm.welcomeTitle} onChange={e => setSettingsForm({...settingsForm, welcomeTitle: e.target.value})} />
               </div>
               <div className="space-y-2">
                 <Label>欢迎页副标题</Label>
                 <Input value={settingsForm.welcomeSubtitle} onChange={e => setSettingsForm({...settingsForm, welcomeSubtitle: e.target.value})} />
               </div>
               <div className="space-y-2">
                 <Label>公司 Logo（欢迎页显示）</Label>
                 <div className="flex items-center gap-4">
                   {settingsForm.logo ? (
                     <div className="relative">
                       <img src={settingsForm.logo} alt="Logo" className="h-16 max-w-[200px] object-contain border rounded p-1 bg-white" />
                       <button
                         type="button"
                         onClick={handleRemoveLogo}
                         className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center hover:bg-destructive/80"
                       >
                         ×
                       </button>
                     </div>
                   ) : (
                     <label className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                       <Upload className="w-4 h-4" />
                       <span className="text-sm">上传 Logo</span>
                       <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                     </label>
                   )}
                 </div>
                 <p className="text-xs text-muted-foreground">建议使用透明背景 PNG，大小不超过 500KB</p>
               </div>
               <div className="space-y-2">
                 <Label>奖项页标题</Label>
                 <Input value={settingsForm.prizePageTitle} onChange={e => setSettingsForm({...settingsForm, prizePageTitle: e.target.value})} />
               </div>
                <div className="space-y-4 border p-4 rounded-xl bg-muted/20">
                  <div className="space-y-2">
                    <Label>大屏多中奖者展示模式</Label>
                    <p className="text-xs text-muted-foreground">当单轮抽取的获奖人数较多溢出屏幕时的呈现方式。</p>
                    <Select 
                      value={settingsForm.scrollMode} 
                      onValueChange={value => setSettingsForm({...settingsForm, scrollMode: value as any})}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择展示模式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">常规平铺布局 (溢出时支持鼠标滚动)</SelectItem>
                        <SelectItem value="scroll">谢幕式自动滚动 (平缓匀速，自动循环)</SelectItem>
                        <SelectItem value="page">演示翻页模式 (支持键盘/翻页笔手动切页)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {settingsForm.scrollMode === 'page' && (
                    <div className="space-y-2 pt-3 border-t border-dashed">
                      <Label>每页最多显示人数</Label>
                      <Select 
                        value={String(settingsForm.winnersPerPage)} 
                        onValueChange={value => setSettingsForm({...settingsForm, winnersPerPage: parseInt(value, 10)})}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="选择每页显示人数" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12">每页 12 人 (推荐，字号超大清晰)</SelectItem>
                          <SelectItem value="24">每页 24 人 (标准网格布局)</SelectItem>
                          <SelectItem value="36">每页 36 人 (较紧凑布局)</SelectItem>
                          <SelectItem value="48">每页 48 人 (多人数大屏展现)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
               <div className="flex items-center justify-between border p-3 rounded-lg bg-muted/20">
                 <div className="space-y-0.5">
                   <Label>显示部门名称</Label>
                   <p className="text-xs text-muted-foreground">在抽奖滚动和大屏中奖展示时，显示参与者的所属部门。</p>
                 </div>
                 <Switch
                   checked={settingsForm.showDept}
                   onCheckedChange={checked => setSettingsForm({...settingsForm, showDept: checked})}
                 />
               </div>
                <div className="space-y-2">
                  <Label>后台管理密码</Label>
                 <Input value={settingsForm.password} onChange={e => setSettingsForm({...settingsForm, password: e.target.value})} />
                 <p className="text-xs text-muted-foreground">建议设置为复杂的密码以防误入。</p>
               </div>
               <Button onClick={handleSaveSettings} className="w-full">保存设置</Button>
               <div className="mt-6 p-3 bg-muted/50 rounded-lg border text-xs text-muted-foreground">
                 <p className="font-medium mb-1">免责声明</p>
                 <p>本项目仅用于展示 AI 编程效果，开发者不对使用本项目产生的任何后果承担责任。使用者需自行承担使用风险。</p>
               </div>
            </TabsContent>
          </div>
        </Tabs>
      </main>

      {/* Edit/Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingPerson ? "编辑人员" : "添加新人员"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">姓名</Label>
                    <Input className="col-span-3" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">部门</Label>
                    <Input className="col-span-3" value={editForm.dept} onChange={e => setEditForm({...editForm, dept: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">手机号</Label>
                    <Input className="col-span-3" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                </div>
                {controlledModeUnlocked && (
                  <>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">权重</Label>
                        <Input type="number" className="col-span-3" value={editForm.weight} onChange={e => setEditForm({...editForm, weight: parseInt(e.target.value)||1})} />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">内定奖项</Label>
                        <div className="col-span-3">
                            <Select value={editForm.mustWinPrizeId} onValueChange={v => setEditForm({...editForm, mustWinPrizeId: v})}>
                                <SelectTrigger>
                                    <SelectValue placeholder="选择内定奖项（可选）" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">无 (公平抽取)</SelectItem>
                                    {prizes.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">奖项黑名单</Label>
                        <div className="col-span-3">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-between"
                                    >
                                        <span>
                                            {editForm.bannedPrizes.length === 0
                                                ? "选择禁止奖项..."
                                                : editForm.bannedPrizes.length === prizes.length
                                                ? "全选"
                                                : `已选择 ${editForm.bannedPrizes.length} 项`}
                                        </span>
                                        <span className="text-xs">▼</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-0" align="start">
                                    <div className="p-3 space-y-2 bg-zinc-950/95 border border-zinc-800 text-white rounded-lg backdrop-blur">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-start h-8 text-xs hover:bg-zinc-800"
                                            onClick={() => {
                                                if (editForm.bannedPrizes.length === prizes.length) {
                                                    setEditForm({...editForm, bannedPrizes: []});
                                                } else {
                                                    setEditForm({...editForm, bannedPrizes: prizes.map(p => p.id)});
                                                }
                                            }}
                                        >
                                            {editForm.bannedPrizes.length === prizes.length ? "取消全选" : "全选"}
                                        </Button>
                                        <div className="border-t border-zinc-800 pt-2 space-y-1">
                                            {prizes.map(prize => (
                                                <div key={prize.id} className="flex items-center space-x-2 p-1.5 hover:bg-zinc-800 rounded">
                                                    <Checkbox
                                                        id={`banned-popover-${prize.id}`}
                                                        checked={editForm.bannedPrizes.includes(prize.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setEditForm({...editForm, bannedPrizes: [...editForm.bannedPrizes, prize.id]});
                                                            } else {
                                                                setEditForm({...editForm, bannedPrizes: editForm.bannedPrizes.filter(id => id !== prize.id)});
                                                            }
                                                        }}
                                                    />
                                                    <Label htmlFor={`banned-popover-${prize.id}`} className="text-sm cursor-pointer select-none text-zinc-300">{prize.name}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                  </>
                )}
            </div>
            <DialogFooter>
                <Button onClick={savePerson}>保存</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prize Edit/Add Dialog */}
      <Dialog open={isPrizeDialogOpen} onOpenChange={setIsPrizeDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{editingPrize ? "编辑奖项" : "添加新奖项"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">奖项名称</Label>
                    <Input className="col-span-3" placeholder="如：一等奖" value={prizeForm.name} onChange={e => setPrizeForm({...prizeForm, name: e.target.value})} />
                </div>

                {/* 部门配额区域 */}
                {participants.length > 0 && (() => {
                  const allDepts = Array.from(new Set(participants.map(p => p.dept).filter(Boolean)));
                  const addedDepts = Object.keys(prizeForm.deptQuotas).filter(d => prizeForm.deptQuotas[d] >= 1);
                  const availableDepts = allDepts.filter(d => !addedDepts.includes(d));
                  const filteredDepts = deptSearch
                    ? availableDepts.filter(d => d.toLowerCase().includes(deptSearch.toLowerCase()))
                    : availableDepts;
                  const hasQuotas = addedDepts.length > 0;
                  const totalQuota = addedDepts.reduce((s, d) => s + (prizeForm.deptQuotas[d] || 0), 0);
                  return allDepts.length > 0 ? (
                    <div className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">部门配额</Label>
                        <span className="text-xs text-muted-foreground">设置后，该部门将获得指定名额</span>
                      </div>

                      {/* 已添加的部门 */}
                      <div className="max-h-[200px] overflow-y-auto space-y-1.5 scrollbar-thin">
                      {addedDepts.map(dept => {
                        const deptCount = participants.filter(p => p.dept === dept && !winnerIds.has(p.id)).length;
                        const quota = prizeForm.deptQuotas[dept] || 0;
                        const displayVal = quotaInputs[dept] ?? String(quota);
                        return (
                          <div key={dept} className="grid grid-cols-[1fr_80px_60px_28px] items-center gap-2">
                            <span className="text-sm truncate">{dept}</span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              className="h-8 text-center"
                              value={displayVal}
                              onChange={e => {
                                const v = e.target.value;
                                setQuotaInputs(prev => ({ ...prev, [dept]: v }));
                                const n = parseInt(v);
                                if (!isNaN(n) && n >= 1) {
                                  setPrizeForm(prev => ({
                                    ...prev,
                                    deptQuotas: { ...prev.deptQuotas, [dept]: Math.min(n, deptCount) }
                                  }));
                                }
                              }}
                              onBlur={() => {
                                const n = parseInt(quotaInputs[dept] ?? "");
                                const finalVal = isNaN(n) || n < 1 ? 1 : Math.min(n, deptCount);
                                setPrizeForm(prev => ({
                                  ...prev,
                                  deptQuotas: { ...prev.deptQuotas, [dept]: finalVal }
                                }));
                                setQuotaInputs(prev => ({ ...prev, [dept]: String(finalVal) }));
                              }}
                            />
                            <span className="text-xs text-muted-foreground text-right">/{deptCount}人</span>
                            <button
                              type="button"
                              className="h-7 w-7 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                              onClick={() => {
                                setPrizeForm(prev => {
                                  const next = { ...prev.deptQuotas };
                                  delete next[dept];
                                  return { ...prev, deptQuotas: next };
                                });
                                setQuotaInputs(prev => {
                                  const next = { ...prev };
                                  delete next[dept];
                                  return next;
                                });
                              }}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                      </div>

                      {/* 添加部门按钮 + 搜索弹出框 */}
                      {availableDepts.length > 0 && (
                        <Popover open={deptPopoverOpen} onOpenChange={setDeptPopoverOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="w-full h-8 border border-dashed rounded-md text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> 添加部门
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[260px] p-2" align="start" onWheel={e => e.stopPropagation()}>
                            <Input
                              placeholder="搜索部门..."
                              className="h-8 mb-2"
                              value={deptSearch}
                              onChange={e => setDeptSearch(e.target.value)}
                              autoFocus
                            />
                            <div className="max-h-[160px] overflow-y-auto space-y-0.5 scrollbar-thin">
                              {filteredDepts.length === 0 ? (
                                <div className="text-xs text-muted-foreground text-center py-2">无匹配部门</div>
                              ) : (
                                filteredDepts.map(dept => {
                                  const deptCount = participants.filter(p => p.dept === dept && !winnerIds.has(p.id)).length;
                                  return (
                                    <button
                                      key={dept}
                                      type="button"
                                      className="w-full text-left px-2.5 py-1.5 rounded text-sm hover:bg-accent flex items-center justify-between"
                                      onClick={() => {
                                        if (deptSelectLockRef.current) return;
                                        deptSelectLockRef.current = true;
                                        setPrizeForm(prev => ({
                                          ...prev,
                                          deptQuotas: { ...prev.deptQuotas, [dept]: 1 }
                                        }));
                                        setDeptSearch("");
                                        setDeptPopoverOpen(false);
                                        setTimeout(() => { deptSelectLockRef.current = false; }, 300);
                                      }}
                                    >
                                      <span>{dept}</span>
                                      <span className="text-xs text-muted-foreground">{deptCount}人</span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}

                      {/* 总中奖人数汇总 */}
                      {hasQuotas && (
                        <div className="pt-2 border-t flex items-center justify-between">
                          <span className="text-sm font-medium">部门配额合计</span>
                          <Badge variant="secondary" className="text-base px-3 py-1">{totalQuota} 人</Badge>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}

                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">中奖人数</Label>
                    <div className="col-span-3 space-y-1">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={countInput}
                        onChange={e => {
                          const v = e.target.value;
                          setCountInput(v);
                          const n = parseInt(v);
                          if (!isNaN(n) && n >= 1) setPrizeForm(prev => ({ ...prev, count: n }));
                        }}
                        onBlur={() => {
                          const n = parseInt(countInput);
                          if (isNaN(n) || n < 1) {
                            setPrizeForm(prev => ({ ...prev, count: 1 }));
                            setCountInput("1");
                          } else {
                            setPrizeForm(prev => ({ ...prev, count: n }));
                            setCountInput(String(n));
                          }
                        }}
                      />
                      {(() => {
                        const quotaSum = Object.values(prizeForm.deptQuotas).reduce((s, q) => s + (q > 0 ? q : 0), 0);
                        const hasQuotas = quotaSum > 0;
                        if (!hasQuotas) return null;
                        const currentCount = parseInt(countInput) || prizeForm.count;
                        const leftover = currentCount - quotaSum;
                        return (
                          <div className="text-xs text-muted-foreground">
                            部门配额已占 <span className="text-foreground font-medium">{quotaSum}</span> 人
                            {leftover > 0 && <>，剩余 <span className="text-foreground font-medium">{leftover}</span> 个名额将在全体参与者中随机抽取</>}
                            {leftover < 0 && <span className="text-amber-500"> — 保存时将自动调整为 {quotaSum} 人</span>}
                            {leftover === 0 && <span className="text-green-500"> — 已分配完毕</span>}
                          </div>
                        );
                      })()}
                    </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">奖品描述</Label>
                    <Textarea className="col-span-3" placeholder="如：iPhone 16 Pro Max 256GB" value={prizeForm.description} onChange={e => setPrizeForm({...prizeForm, description: e.target.value})} />
                </div>
            </div>
            <DialogFooter>
                <Button onClick={savePrize}>保存</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}