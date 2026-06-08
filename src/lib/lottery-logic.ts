import type { Participant } from "./types";

/**
 * Fisher-Yates 洗牌算法
 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 从候选池中按权重抽取指定人数
 */
function weightedDraw(candidates: Participant[], count: number): Participant[] {
  const drawn: Participant[] = [];
  const pool = [...candidates];

  while (drawn.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, p) => sum + (p.weight || 1), 0);
    let randomVal = Math.random() * totalWeight;

    let selectedIndex = -1;
    for (let i = 0; i < pool.length; i++) {
      randomVal -= (pool[i].weight || 1);
      if (randomVal <= 0) {
        selectedIndex = i;
        break;
      }
    }

    if (selectedIndex === -1) {
      selectedIndex = 0; // 防御性兜底
    }

    drawn.push(pool[selectedIndex]);
    pool.splice(selectedIndex, 1);
  }

  return drawn;
}

/**
 * 核心抽奖算法
 * @param pool 当前候选池（已排除已中奖和黑名单）
 * @param count 本轮抽取数量
 * @param mustWinList 必中奖名单（未中奖的，且必须匹配当前奖项）
 * @param deptQuotas 部门配额：{ "技术部": 3, "市场部": 2 }，设置后恰好中该人数
 */
export function drawWinners(
  pool: Participant[],
  count: number,
  mustWinList: Participant[],
  deptQuotas?: Record<string, number>
): Participant[] {
  // 如果有部门配额，走部门配额逻辑（剩余名额随机填充）
  if (deptQuotas && Object.keys(deptQuotas).length > 0) {
    return drawWithDeptQuotas(pool, count, mustWinList, deptQuotas);
  }

  // 否则走原有逻辑（向后兼容）
  return drawOriginal(pool, count, mustWinList);
}

/**
 * 部门配额模式：每个部门恰好中配额数量的人，剩余名额从全部候选池随机抽取
 */
function drawWithDeptQuotas(
  pool: Participant[],
  totalCount: number,
  mustWinList: Participant[],
  deptQuotas: Record<string, number>
): Participant[] {
  const winners: Participant[] = [];
  const winnerIds = new Set<string>();

  // 按部门分组
  const deptGroups: Record<string, Participant[]> = {};
  for (const p of pool) {
    const dept = p.dept || "未分组";
    if (!deptGroups[dept]) deptGroups[dept] = [];
    deptGroups[dept].push(p);
  }

  // 1. 按部门配额抽取（恰好该人数）
  for (const [dept, quota] of Object.entries(deptQuotas)) {
    if (quota <= 0) continue;

    const deptCandidates = deptGroups[dept] || [];

    // 该部门的内定者（优先占用配额名额）
    const deptMustWin = shuffle(mustWinList.filter(p => (p.dept || "未分组") === dept && !winnerIds.has(p.id)));
    const mustWinTake = Math.min(quota, deptMustWin.length);

    for (let i = 0; i < mustWinTake; i++) {
      winners.push(deptMustWin[i]);
      winnerIds.add(deptMustWin[i].id);
    }

    // 剩余名额从该部门候选池中随机抽取
    const remaining = quota - mustWinTake;
    if (remaining > 0) {
      const available = deptCandidates.filter(p => !winnerIds.has(p.id));
      const drawn = weightedDraw(available, remaining);
      for (const p of drawn) {
        winners.push(p);
        winnerIds.add(p.id);
      }
    }
  }

  // 2. 填充剩余名额：从全部候选池中随机抽取（不限部门）
  const quotaSum = Object.values(deptQuotas).reduce((s, q) => s + q, 0);
  const leftover = totalCount - quotaSum;
  if (leftover > 0) {
    const remaining = pool.filter(p => !winnerIds.has(p.id));
    const drawn = weightedDraw(remaining, leftover);
    for (const p of drawn) {
      winners.push(p);
      winnerIds.add(p.id);
    }
  }

  return winners;
}

/**
 * 原有抽奖逻辑（无部门配额时使用，向后兼容）
 */
function drawOriginal(
  pool: Participant[],
  count: number,
  mustWinList: Participant[]
): Participant[] {
  const winners: Participant[] = [];
  let remainingCount = count;

  // 1. 优先处理必中奖名单
  if (mustWinList.length > 0) {
    const mustWinCandidates = shuffle(mustWinList);
    const takeCount = Math.min(remainingCount, mustWinCandidates.length);
    for (let i = 0; i < takeCount; i++) {
      winners.push(mustWinCandidates[i]);
    }
    remainingCount -= takeCount;
  }

  // 2. 如果名额还没满，从普通池中按权重抽取
  if (remainingCount > 0) {
    let candidates = pool.filter(p => !winners.some(w => w.id === p.id));
    const drawn = weightedDraw(candidates, remainingCount);
    winners.push(...drawn);
  }

  return winners;
}
