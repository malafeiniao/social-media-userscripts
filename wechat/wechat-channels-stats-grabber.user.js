// ==UserScript==
// @name         视频号数据一站抓取
// @namespace    https://github.com/malafeiniao/mp-stats-grabber
// @version      1.2.7
// @description  在视频号助手后台一站抓齐视频数据：一个列表请求拿 20 条的播放/推荐/评论/转发/喜欢/涨粉/完播率/平均播放时长。本地视频库 + 增量更新 + 当前累计数据导出，可只刷选中的几条，列可勾选拖动排序、可存模板。
// @author       malafeiniao
// @homepageURL  https://github.com/malafeiniao/social-media-userscripts
// @supportURL   https://github.com/malafeiniao/social-media-userscripts/issues
// @updateURL    https://raw.githubusercontent.com/malafeiniao/social-media-userscripts/main/wechat/wechat-channels-stats-grabber.user.js
// @downloadURL  https://raw.githubusercontent.com/malafeiniao/social-media-userscripts/main/wechat/wechat-channels-stats-grabber.user.js
// @match        *://channels.weixin.qq.com/*
// @run-at       document-start
// @grant        GM_setClipboardText
// @grant        GM_setValue
// @grant        GM_getValue
// @noframes
// ==/UserScript==

/* ============================================================================
 * 使用说明
 * ----------------------------------------------------------------------------
 * 打开视频号助手「内容管理」，等待视频列表出现。面板的列表请求模板就绪后即可抓取。
 * 只获取每条视频当前的累计指标、完播率和平均播放时长，保存在本地视频库中。
 *
 * 「抓取」提供三种模式：
 *   · 增量更新：从第 1 页开始，直到一整页没有新视频。日常获取新视频使用。
 *   · 补抓更早：从上次连续覆盖到的页码继续，补全尚未入库的更早视频。
 *   · 全量刷新：从第 1 页翻到底，更新全部视频当前指标，保留手工标签。
 * 要更新已有视频的数字，使用「全量刷新」，或在「视频」页勾选后「刷新选中」。
 *
 * 「视频」页集中提供搜索、标签和状态筛选、批量标签、复制与 CSV 导出。
 * 导出范围：有勾选时取当前筛选范围内的勾选，否则取筛选结果，没有筛选则取全库。
 * 标签输入用逗号分隔；-标签 表示移除，-* 表示清空目标视频的标签。
 * 「列设置」决定导出列，支持拖动排序、互动量口径、时长单位及模板保存。
 * 标题栏「−」收起为图标；图标和标题栏均可拖动，并记住位置、开合和所选页签。
 * 清空本地视频库会删除本地记录及标签，不影响视频号后台。
 *
 * 请求模板
 * ----------------------------------------------------------------------------
 * 内容管理的列表接口位于 /micro/content/... iframe，通过 POST JSON 请求。
 * 需要页面生成的会话头和参数，因此脚本捕获真实 post_list 请求，再修改分页重放。
 * 使用发出请求的 iframe 的原始 fetch，并保持 same-origin，避免改变来源上下文。
 * 本脚本使用 @noframes，由顶层扫描同源 iframe 并挂接 fetch/XHR。
 * 模板仅保存在当前页面内存中；打开内容管理并等列表显示后，状态会变为就绪。
 *
 * 列表字段来源（2026-08-06 实测，保留历史依据）
 * ----------------------------------------------------------------------------
 * POST /micro/content/cgi-bin/mmfinderassistant-bin/post/post_list
 * 请求 currentPage 从 1 开始，pageSize 沿用页面模板，通常为 20。
 * stickyOrder:true 会把置顶视频排在前面，不能遇到一条已知或过期视频就停止。
 * _rid 前缀为当前 unix 秒的十六进制，后缀为 8 位随机十六进制。
 *
 * data.list[]：
 *   exportId          稳定主键；定时待发转为发布后仍保持不变
 *   objectId          平台视频标识；部分状态下可能为 export/ 开头的字符串
 *   createTime        发布时间戳（秒）
 *   desc.description  文案；标题取首行并截短展示
 *   desc.media[0]     coverUrl 封面、videoPlayLen 视频时长（秒）
 *   readCount         播放量
 *   likeCount         推荐/在看
 *   favCount          喜欢/点赞
 *   commentCount      评论
 *   forwardCount      转发/分享
 *   followCount       涨粉
 *   avgPlayTimeSec    平均播放时长（秒）
 *   fullPlayRate      完播率（0—1）
 *   fastFlipRate      快划率（0—1）
 * 其他互动项仍按字段映射分别保留，UV、次数和比例不互换。
 *
 * 主库和列模板保留旧列名迁移；主库合并保留手工标签与未返回字段。
 * 数字零必须保留，无效字段不假填零。日期筛选包含所选当天，兼容置顶和非严格时间排序。
 * 请求间隔为 2—5 秒随机，每 15 次请求休息 8—15 秒。失败保存抓取进度供继续。
 * ============================================================================ */

(function () {
  'use strict';

  /* ==========================================================================
   * 1. 节奏与开关
   * ========================================================================== */
  const PAGE_SIZE = 20;        // 跟页面自己用的一致，别乱调
  const DELAY_MIN = 2000;      // 请求间隔下限（随机，别改成固定值）
  const DELAY_MAX = 5000;
  const REST_EVERY = 15;       // 每这么多个请求歇一次长的
  const REST_MIN = 8000;
  const REST_MAX = 15000;
  const MAX_PAGES = 400;       // 保险丝
  /* 连续这么多页「整页都早于日期下限」才认为真到底了。
   * 不能只看一页 —— 列表不是严格按日期倒序的（置顶会顶到最前，补发/存档内容
   * 也会让日期在中间跳），只看一页就收工会把后面的内容整段漏掉。 */
  const CUTOFF_DRY_PAGES = 3;
  const PREVIEW_LIMIT = 200;   // 每批显示的行数，可继续加载后续视频
  const FRAME_SCAN_MS = 800;   // 多久重扫一次 iframe

  const LIST_PATH_RE = /\/cgi-bin\/mmfinderassistant-bin\/post\/post_list$/;

  /* ==========================================================================
   * 2. 列名迁移
   * --------------------------------------------------------------------------
   * 1.1.0 把三个列名改成了视频号自己的叫法。这三个名字同时也是库里行上的字段键、
   * 列设置里的勾选/排序键、模板里存的键 —— 直接改常量会让已有的库和模板一起散掉。
   * 所以读库、读列设置、读模板的时候都过一遍这张表，只迁一次，用户无感。
   * ========================================================================== */
  const RENAMED = {
    点赞: '推荐/在看',      // likeCount —— 👍 那个键，早年叫「在看」，现在叫「推荐」
    转发: '转发/分享',      // forwardCount
    收藏: '喜欢/点赞',      // favCount —— ♡ 那个键，官方叫「喜欢」，口语叫点赞
  };

  /** 迁移一个名字 */
  const mapName = n => (Object.prototype.hasOwnProperty.call(RENAMED, n) ? RENAMED[n] : n);
  /** 迁移一串名字（列顺序、勾选、口径都是名字数组） */
  const mapNames = a => (Array.isArray(a) ? a.map(mapName) : a);
  /** 迁移一行数据的字段键 */
  function mapRow(r) {
    if (!r || typeof r !== 'object') return r;
    let touched = false;
    for (const old of Object.keys(RENAMED)) {
      if (Object.prototype.hasOwnProperty.call(r, old)) {
        if (!Object.prototype.hasOwnProperty.call(r, RENAMED[old])) r[RENAMED[old]] = r[old];
        delete r[old];
        touched = true;
      }
    }
    return touched ? r : r;
  }

  /* ==========================================================================
   * 3. 导出列
   * ========================================================================== */
  const EXPORT_SCHEMA = [
    { col: '标题',       from: '标题' },
    { col: '发布日期',   from: '发布日期' },
    { col: '发布时间',   from: '发布时间' },
    {
      col: '视频时长',
      header: () => `视频时长(${lenUnit()})`,
      value: row => fmtDur(row['时长秒'], lenUnit()),
    },
    { col: '播放量',     from: '播放量', num: true },
    { col: '推荐/在看',  from: '推荐/在看', num: true, sumable: true },
    { col: '评论',       from: '评论', num: true, sumable: true },
    { col: '喜欢/点赞',  from: '喜欢/点赞', num: true, sumable: true },
    { col: '转发/分享',  from: '转发/分享', num: true, sumable: true },
    { col: '涨粉',       from: '涨粉', num: true, sumable: true },
    { col: '推荐给朋友', from: '推荐给朋友', num: true, sumable: true, off: true },
    { col: '转发到私聊', from: '转发到私聊', num: true, sumable: true, off: true },
    { col: '朋友圈转发', from: '朋友圈转发', num: true, sumable: true, off: true },
    { col: '朋友圈封面', from: '朋友圈封面', num: true, sumable: true, off: true },
    { col: '设为铃声',   from: '设为铃声', num: true, sumable: true, off: true },
    { col: '状态引用',   from: '状态引用', num: true, sumable: true, off: true },
    {
      col: '互动量',
      calc: true,
      deps: () => sumCols(),
      value: row => sumValue(row),
    },
    {
      col: '互动率',
      calc: true,
      value: row => {
        const read = num(row['播放量']);
        if (!read) return '';
        return (sumValue(row) / read * 100).toFixed(2) + '%';
      },
    },
    {
      col: '完播率',
      value: row => {
        const r = row['_fullPlayRate'];
        if (r === '' || r == null) return '';
        return (num(r) * 100).toFixed(2) + '%';
      },
    },
    {
      col: '平均播放时长',
      // 原始值就是秒，其它单位都在 fmtDur 里换算。表头跟着单位走。
      header: () => `平均播放时长(${durUnit()})`,
      value: row => fmtDur(row['_avgPlaySec'], durUnit()),
    },
    {
      // 平均播放时长 ÷ 视频时长。跟完播率互补：完播率只算「看到底」的比例，
      // 这个是「平均看了多大比例」，短视频和长视频的对比全靠它
      col: '平均完成度',
      calc: true,
      value: row => {
        const s = num(row['_avgPlaySec']);
        const len = num(row['时长秒']);
        if (!s || !len) return '';
        return (s / len * 100).toFixed(2) + '%';
      },
    },
    {
      col: '快划率',
      off: true,
      value: row => {
        const r = row['_fastFlipRate'];
        if (r === '' || r == null) return '';
        return (num(r) * 100).toFixed(2) + '%';
      },
    },
    { col: '状态',     from: '状态' },
    { col: '标签',     value: row => (row._tags || []).join(' ') },
    { col: '文案全文', from: '文案', off: true },
    { col: '封面图',   from: '封面图', off: true },
    // 兼容旧库已保存的视频 ID，仅用于导出，不发起额外请求。
    { col: '视频ID',   value: row => cell(row._feedId || row._oid), off: true },
    { col: '状态码',   from: '_statusCode', off: true },
    { col: '数据时间', from: '数据时间' },
  ];

  const DEFAULT_SUM = ['推荐/在看', '评论', '喜欢/点赞', '转发/分享', '涨粉'];
  const DEFAULT_OFF = EXPORT_SCHEMA.filter(c => c.off).map(c => c.col);

  // 时长单位。视频时长默认 mm:ss（一眼能读），平均播放时长默认秒（要小数精度）
  const DUR_UNITS = ['秒', '分钟', 'mm:ss', 'hh:mm:ss'];
  const DEFAULT_LEN_UNIT = 'mm:ss';
  const DEFAULT_DUR_UNIT = '秒';

  // 这些会随时间变化，重抓到就覆盖
  const VOLATILE = ['标题', '文案', '封面图', '播放量', '推荐/在看', '评论',
    '喜欢/点赞', '转发/分享', '涨粉', '推荐给朋友', '转发到私聊', '朋友圈转发', '朋友圈封面',
    '设为铃声', '状态引用', '状态', '_statusCode', '_avgPlaySec', '_fullPlayRate',
    '_fastFlipRate', '数据时间'];

  const PANEL_ID = 'ch-video-data-panel';
  const LIB_KEY = 'ch_video_lib_v1';
  const PROGRESS_KEY = 'ch_video_progress_v1';
  const CFG_KEY = 'ch_video_cols_v1';
  const PRESET_KEY = 'ch_video_presets_v1';

  /* ==========================================================================
   * 3. 小工具
   * ========================================================================== */
  function num(v) {
    if (v == null || v === '') return 0;
    const n = parseFloat(String(v).replace(/,/g, '').replace(/[^\d.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  const pad = n => String(n).padStart(2, '0');
  const fmtDate = d => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  const fmtTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const stampNow = () => { const d = new Date(); return `${fmtDate(d)} ${fmtTime(d)}`; };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const cell = v => String(v == null ? '' : v);
  const esc = s => String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const hex8 = () => {
    let s = '';
    for (let i = 0; i < 8; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  };

  /**
   * 秒 → 各种时长写法。原始值一律是秒，只在显示时换。
   *   秒        74      （平均播放时长这种小数要留两位，整数就不留）
   *   分钟      1.23
   *   mm:ss     01:14   （超过 60 分钟就自动变成 mm:ss 的分钟部分继续涨，如 75:03）
   *   hh:mm:ss  00:01:14
   * mm:ss / hh:mm:ss 这两种粘进 Excel 会被识别成时间，正好能直接做平均。
   */
  function fmtDur(v, unit) {
    if (v === '' || v == null) return '';
    const s = num(v);
    if (!isFinite(s)) return '';
    if (unit === '分钟') return (s / 60).toFixed(2);
    if (unit === 'mm:ss') {
      const t = Math.round(s);
      return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
    }
    if (unit === 'hh:mm:ss') {
      const t = Math.round(s);
      return `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t % 3600 / 60))}:${pad(t % 60)}`;
    }
    // 秒：整数就不带小数点，小数留两位
    return Number.isInteger(s) ? String(s) : s.toFixed(2);
  }

  /** 文案首行、截到 40 字，当「标题」用。视频号没有独立标题字段。 */
  function titleOf(desc) {
    const first = String(desc || '').split(/[\r\n]/).find(x => x.trim()) || '';
    const t = first.trim();
    return t.length > 40 ? t.slice(0, 40) + '…' : t;
  }

  /* ==========================================================================
   * 4. 存储
   * ========================================================================== */
  function rawRead(key, dflt) {
    try {
      return (typeof GM_getValue === 'function')
        ? GM_getValue(key, dflt) : (localStorage.getItem(key) || dflt);
    } catch (e) { return dflt; }
  }
  let storeErr = '';        // 最近一次写盘失败的原因，面板上要显示出来
  let storeErrVersion = 0;  // 区分新失败与同一错误的重复渲染
  let latestStorageFailure = null; // 后续成功写入不能抹去尚未报告的失败

  /**
   * 写盘。以前这里是 catch 了什么都不做（注释还写着「存不下就算了」）——
   * 那是个坏主意：配额满了的话，库看着还在、其实没落盘，下次打开数据就少了一截，
   * 而且完全没有线索。现在把失败记下来，面板上红字报出来。
   */
  function rawWrite(key, val) {
    try {
      if (typeof GM_setValue === 'function') GM_setValue(key, val);
      else localStorage.setItem(key, val);
      storeErr = '';
      return true;
    } catch (e) {
      const kb = Math.round(String(val).length / 1024);
      storeErr = `存盘失败（${key}，约 ${kb} KB）：${(e && e.name) || ''} ${(e && e.message) || e}`;
      storeErrVersion++;
      latestStorageFailure = { version: storeErrVersion, message: storeErr };
      return false;
    }
  }

  /**
   * 主键用 exportId，不用 objectId。
   * 实测：定时待发的视频，objectId 就等于 exportId（都是 export/ 开头的长串）；
   * 发布之后 objectId 变成纯数字，exportId 不变。拿 objectId 当键的话，
   * 一条视频从「定时待发」转到「已发布」会在库里变成两行。
   */
  const keyOf = r => cell(r && (r._exportId || r._oid));

  /** 有没有哪个值真变了。只比较新数据里确实带了的字段。 */
  function bumped(a, b) {
    return VOLATILE.some(k => k !== '数据时间' && (k in b) && cell(a[k]) !== cell(b[k]));
  }

  /**
   * 视频库。donePages = 从第 1 页往下已经连续覆盖了多少页，
   * 「补抓更早」靠它知道从第几页接着请求，而不是从头重翻。
   */
  const lib = {
    read() {
      try {
        const v = JSON.parse(rawRead(LIB_KEY, '') || 'null');
        if (!v || !Array.isArray(v.rows)) return { rows: [], donePages: 0, total: 0, at: 0 };
        return {
          rows: v.rows.map(mapRow),          // 1.1.0 的列名迁移，读的时候顺手做
          donePages: Number(v.donePages) || 0,
          total: Number(v.total) || 0,
          at: v.at || 0,
        };
      } catch (e) { return { rows: [], donePages: 0, total: 0, at: 0 }; }
    },
    write(v) {
      rawWrite(LIB_KEY, JSON.stringify({
        rows: v.rows, donePages: v.donePages, total: v.total || 0, at: Date.now(),
      }));
    },
    clear() { rawWrite(LIB_KEY, ''); },

    /**
     * @param newRows   新抓到的行
     * @param donePages 连续覆盖到第几页，null = 不动
     * @param total     接口报的总数，null = 不动
     */
    merge(newRows, donePages, total) {
      const cur = lib.read();
      const byKey = new Map(cur.rows.map(r => [keyOf(r), r]));
      /**
       * objectId → 键，只给「当初没拿到 exportId、退而用 objectId 当键」的那些行建索引。
       * 它是用来接住一种情况：某行入库时接口没给 exportId，后来给了，主键就从
       * objectId 变成 exportId，会在库里裂成两行。
       * 只收 _exportId 为空的行是关键 —— 要是把所有行都按 objectId 索引，
       * 两条各自都有 exportId 的视频万一 objectId 撞上，就会被错误合并成一条。
       */
      const byOid = new Map(cur.rows
        .filter(r => r._oid && !r._exportId)
        .map(r => [cell(r._oid), keyOf(r)]));
      let added = 0, updated = 0;

      for (const r of newRows || []) {
        const k = keyOf(r);
        let old = byKey.get(k);
        if (!old && r._oid && byOid.has(cell(r._oid))) old = byKey.get(byOid.get(cell(r._oid)));
        if (old) {
          if (bumped(old, r)) updated++;
          const merged = Object.assign({}, old, r);
          byKey.delete(keyOf(old));
          byKey.set(keyOf(merged), merged);
        } else {
          byKey.set(k, r); added++;
        }
      }

      const rows = [...byKey.values()].sort((a, b) => (b._ts || 0) - (a._ts || 0));
      lib.write({
        rows,
        donePages: donePages == null ? cur.donePages : donePages,
        total: total == null ? cur.total : total,
      });
      return { added, updated, total: rows.length };
    },

    /**
     * 从本地库删掉几行。只动本地，不碰视频号那边。
     */
    remove(keys) {
      const cur = lib.read();
      const set = new Set(keys);
      const before = cur.rows.length;
      cur.rows = cur.rows.filter(r => !set.has(keyOf(r)));
      lib.write(cur);
      return before - cur.rows.length;
    },

    newestTs() { const r = lib.read().rows; return r.length ? (r[0]._ts || 0) : 0; },
    keys() { return new Set(lib.read().rows.map(keyOf)); },

    allTags() {
      const s = new Set();
      for (const r of lib.read().rows) for (const t of r._tags || []) s.add(t);
      return [...s].sort();
    },

    /** 批量改标签。del 里出现 '*' 表示清空该行标签。 */
    tag(keys, add, del) {
      const cur = lib.read();
      const set = new Set(keys);
      let n = 0;
      for (const r of cur.rows) {
        if (!set.has(keyOf(r))) continue;
        let t = (r._tags || []).slice();
        if (del.indexOf('*') >= 0) t = [];
        else t = t.filter(x => del.indexOf(x) < 0);
        for (const a of add) if (t.indexOf(a) < 0) t.push(a);
        r._tags = t;
        n++;
      }
      lib.write(cur);
      return n;
    },
  };

  const progress = {
    read() {
      try {
        const v = JSON.parse(rawRead(PROGRESS_KEY, '') || 'null');
        return (v && Array.isArray(v.rows)) ? v : null;
      } catch (e) { return null; }
    },
    write(v) { rawWrite(PROGRESS_KEY, JSON.stringify(v)); },
    clear() { rawWrite(PROGRESS_KEY, ''); },
  };

  /* ---- 列配置 + 模板 ---- */
  const cfg = {
    read() {
      let v = {};
      try { v = JSON.parse(rawRead(CFG_KEY, '{}')) || {}; } catch (e) { v = {}; }
      return {
        order: mapNames(Array.isArray(v.order) ? v.order : []),
        off: mapNames(Array.isArray(v.off) ? v.off : DEFAULT_OFF.slice()),
        sum: mapNames(Array.isArray(v.sum) ? v.sum : DEFAULT_SUM.slice()),
        durUnit: DUR_UNITS.indexOf(v.durUnit) >= 0 ? v.durUnit : DEFAULT_DUR_UNIT,
        lenUnit: DUR_UNITS.indexOf(v.lenUnit) >= 0 ? v.lenUnit : DEFAULT_LEN_UNIT,
        preset: typeof v.preset === 'string' ? v.preset : '',
      };
    },
    write(v) { rawWrite(CFG_KEY, JSON.stringify(v)); },
    patch(kv) { cfg.write(Object.assign(cfg.read(), kv)); },
    reset() { rawWrite(CFG_KEY, '{}'); },
  };

  const SHAPE = ['order', 'off', 'sum', 'durUnit', 'lenUnit'];
  const shapeOf = c => { const o = {}; SHAPE.forEach(k => { o[k] = c[k]; }); return o; };
  const sameShape = (a, b) => JSON.stringify(shapeOf(a)) === JSON.stringify(shapeOf(b));

  const presets = {
    read() {
      try {
        const v = JSON.parse(rawRead(PRESET_KEY, '{}'));
        if (!v || typeof v !== 'object') return {};
        // 存的是列名，1.1.0 改过名，读的时候一并迁移，老模板照样能用
        for (const name of Object.keys(v)) {
          const p = v[name];
          if (!p || typeof p !== 'object') continue;
          p.order = mapNames(p.order);
          p.off = mapNames(p.off);
          p.sum = mapNames(p.sum);
        }
        return v;
      } catch (e) { return {}; }
    },
    write(v) { rawWrite(PRESET_KEY, JSON.stringify(v)); },
    names() { return Object.keys(presets.read()); },
    save(name) {
      const all = presets.read();
      // 存完整顺序，并写回 cfg，否则存完立刻会被判成「已改动」
      const full = orderedSchema().map(x => x.c.col);
      cfg.patch({ order: full });
      all[name] = Object.assign(shapeOf(cfg.read()), { order: full });
      presets.write(all);
    },
    apply(name) {
      const p = presets.read()[name];
      if (!p) return false;
      cfg.write(Object.assign(shapeOf(p), { preset: name }));
      return true;
    },
    remove(name) { const all = presets.read(); delete all[name]; presets.write(all); },
    rename(from, to) {
      const all = presets.read();
      if (!(from in all)) return false;
      const out = {};
      for (const k of Object.keys(all)) out[k === from ? to : k] = all[k];
      presets.write(out);
      return true;
    },
  };

  function presetDirty() {
    const c = cfg.read();
    if (!c.preset) return false;
    const p = presets.read()[c.preset];
    return !p || !sameShape(c, Object.assign({ order: [], off: [], sum: [], durUnit: DUR_UNITS[0] }, p));
  }

  /* ==========================================================================
   * 5. 列的顺序 / 勾选 / 派生
   * ========================================================================== */
  /**
   * 列的最终顺序。两步：
   *   1) 先按存下来的 order 排，order 里没提到的（比如以后新增的列）排最后
   *   2) 再把勾上的整体浮到前面，没勾的沉到后面，各组内部保持相对顺序
   *
   * 第 2 步既管显示也管导出，所以看到的顺序就是导出的顺序。
   * 副作用：把没勾的列拖到勾上的列中间，松手后它会弹回下面那组的顶部 ——
   * 这是有意的，没勾的列不导出，它待在中间没有意义。
   */
  function orderedSchema() {
    const { order, off } = cfg.read();
    const left = new Map(EXPORT_SCHEMA.map(c => [c.col, c]));
    const seq = [];
    for (const name of order) if (left.has(name)) { seq.push(left.get(name)); left.delete(name); }
    for (const c of left.values()) seq.push(c);      // 以后新增的列排最后
    const marked = seq.map(c => ({ c, on: off.indexOf(c.col) < 0 }));
    return marked.filter(x => x.on).concat(marked.filter(x => !x.on));
  }
  const activeSchema = () => orderedSchema().filter(x => x.on).map(x => x.c);

  const headerName = c => (typeof c.header === 'function' ? c.header() : c.col);
  const durUnit = () => cfg.read().durUnit;      // 平均播放时长的单位
  const lenUnit = () => cfg.read().lenUnit;      // 视频时长的单位

  function sumCols() {
    const picked = cfg.read().sum;
    return EXPORT_SCHEMA.filter(c => c.sumable && picked.indexOf(c.col) >= 0).map(c => c.col);
  }
  function sumValue(row) {
    const field = {};
    EXPORT_SCHEMA.forEach(c => { if (c.from) field[c.col] = c.from; });
    return sumCols().reduce((s, col) => s + num(row[field[col]]), 0);
  }

  function cellOf(r, c) {
    if (c.value) return cell(c.value(r));
    let v = cell(r[c.from]);
    if (c.num) v = v.replace(/,/g, '');
    return v;
  }

  /* ==========================================================================
   * 6. 请求模板 —— 这版的地基
   * --------------------------------------------------------------------------
   * 脚本在顶层跑（@noframes），内容管理的接口住在 /micro/content/... 的 iframe 里。
   * 那种 iframe 是先塞 empty.html 再由前端路由换成真页面的，脚本管理器不给注入，
   * 所以只能由顶层主动伸手：iframe 同源，contentWindow 摸得到，把它的 fetch/XHR
   * 换掉就能看见里面的请求。定时重扫，后出现的 iframe 照挂。
   *
   * 抄到 post_list 请求后存成模板。之后翻页拿模板改 currentPage 重放，
   * 并且用发出它的那个 window 的原始 fetch —— referrer 才跟页面自己发的一致。
   * ========================================================================== */
  const HOOK_FLAG = '__chGrabHooked';

  const tpl = {
    ready: false,
    url: '', headers: null, body: null,
    win: null, fetch: null, at: 0,
  };

  // fetch 不让手动设的头，抄来了也得剔掉
  const FORBIDDEN_H = /^(host|origin|referer|cookie|content-length|connection|user-agent|accept-encoding)$/i;

  /**
   * 抄请求头。键一律转小写 —— 这是 1.0.1 修的坑：
   * 页面若发的是 'Content-Type'（大写 C、T），而重放时又固定补了一个小写
   * 'content-type'，Object.assign 会当成两个不同的键都留下，fetch 组装时
   * 合并成 "application/json, application/json"，服务端解析请求体就废了。
   * HTTP 头本来不区分大小写，统一小写才是对的。
   */
  function headersToObj(h) {
    const out = {};
    if (!h) return out;
    const put = (k, v) => {
      const key = String(k).toLowerCase();
      if (FORBIDDEN_H.test(key)) return;
      out[key] = v;
    };
    try {
      if (typeof Headers !== 'undefined' && h instanceof Headers) h.forEach((v, k) => put(k, v));
      else if (Array.isArray(h)) h.forEach(p => put(p[0], p[1]));
      else Object.keys(h).forEach(k => put(k, h[k]));
    } catch (e) { /* noop */ }
    return out;
  }

  function captureTemplate(win, origFetch, url, headers, body) {
    let u;
    try { u = new URL(url, location.href); } catch (e) { return; }

    if (!LIST_PATH_RE.test(u.pathname)) return;

    let parsed = null;
    try { parsed = JSON.parse(typeof body === 'string' ? body : ''); } catch (e) { return; }
    if (!parsed || typeof parsed !== 'object') return;

    tpl.url = u.toString();
    tpl.headers = headersToObj(headers);
    tpl.body = parsed;
    tpl.win = win;
    tpl.fetch = origFetch;
    tpl.at = Date.now();
    tpl.ready = true;
    if (ui) refresh();
  }

  function patchWindow(win, tag) {
    if (!win) return;
    try { if (win[HOOK_FLAG]) return; } catch (e) { return; }   // 跨域，摸不到

    let ok = false;
    let origFetch = null;              // 留住没被我们包过的那个，重放时用它
    try {
      const of = win.fetch;
      if (typeof of === 'function') {
        origFetch = of;
        win.fetch = function (input, init) {
          try {
            init = init || {};
            let url = '', headers = null, body = null, method = 'GET';
            if (win.Request && input instanceof win.Request) {
              url = input.url; method = (init.method || input.method || 'GET').toUpperCase();
              headers = init.headers || input.headers;
            } else {
              url = String(input); method = (init.method || 'GET').toUpperCase();
              headers = init.headers;
            }
            body = init.body;
            if (method === 'POST') captureTemplate(win, of, url, headers, body);
          } catch (e) { /* 抄不到就抄不到，别挡着请求 */ }
          return of.apply(this, arguments);
        };
        ok = true;
      }
    } catch (e) { /* noop */ }

    // 页面万一走 XHR，也得能抄到
    try {
      const XP = win.XMLHttpRequest && win.XMLHttpRequest.prototype;
      if (XP && !XP[HOOK_FLAG]) {
        const oOpen = XP.open, oSend = XP.send, oSet = XP.setRequestHeader;
        XP.open = function (m, u2) {
          try { this.__g = { method: String(m || '').toUpperCase(), url: String(u2 || ''), headers: {} }; }
          catch (e) { /* noop */ }
          return oOpen.apply(this, arguments);
        };
        XP.setRequestHeader = function (k, v) {
          try { if (this.__g) this.__g.headers[k] = v; } catch (e) { /* noop */ }
          return oSet.apply(this, arguments);
        };
        XP.send = function (body) {
          try {
            const i = this.__g;
            // XHR 抄到的只有头和体，重放还是走 fetch —— 用上面留住的原始 fetch，
            // 不能用 win.fetch，那个已经被我们包过一层了
            if (i && i.method === 'POST') captureTemplate(win, origFetch || win.fetch, i.url, i.headers, body);
          } catch (e) { /* noop */ }
          return oSend.apply(this, arguments);
        };
        try { XP[HOOK_FLAG] = true; } catch (e) { /* noop */ }
        ok = true;
      }
    } catch (e) { /* noop */ }

    if (ok) { try { win[HOOK_FLAG] = true; } catch (e) { /* noop */ } }
  }

  function scanFrames(win, depth) {
    if (depth > 4) return;
    let n = 0;
    try { n = win.frames.length; } catch (e) { return; }
    for (let i = 0; i < n; i++) {
      let child = null;
      try { child = win.frames[i]; } catch (e) { continue; }
      if (!child) continue;
      patchWindow(child, 'iframe');
      scanFrames(child, depth + 1);
    }
  }

  patchWindow(window, '顶层');
  setInterval(() => { try { scanFrames(window, 0); } catch (e) { /* noop */ } }, FRAME_SCAN_MS);

  /**
   * 换一个新鲜的 _rid。实测前缀就是 unix 秒的十六进制，后缀 8 位随机十六进制。
   * 复用模板里那个固定值也能通，但十几个请求带同一个 _rid 本身就是特征。
   */
  // urlWith / newRid 定义在下面的自检那节，调用时早就就位了
  function freshUrl() { return urlWith({ _rid: newRid() }); }

  /* ==========================================================================
   * 7. 抓取
   * ========================================================================== */
  let aborted = false;

  async function pace(i, onTip) {
    const long = i > 0 && i % REST_EVERY === 0;
    const wait = long ? rand(REST_MIN, REST_MAX) : rand(DELAY_MIN, DELAY_MAX);
    if (onTip) onTip(long ? `歇 ${Math.round(wait / 1000)} 秒…` : `等 ${(wait / 1000).toFixed(1)} 秒…`);
    await sleep(wait);
  }

  /**
   * 最底层的一发。不抛异常，把结果原样返回，好让上层既能报错也能做自检对照。
   * @param urlStr 完整 URL
   * @param bodyObj 请求体对象
   */
  async function fetchRaw(urlStr, bodyObj) {
    const headers = Object.assign({}, tpl.headers || {});
    // 键已经统一小写了，所以这里只在页面确实没带的时候才补
    if (!headers['content-type']) headers['content-type'] = 'application/json';

    let res;
    try {
      res = await tpl.fetch.call(tpl.win, urlStr, {
        method: 'POST',
        credentials: 'same-origin',      // 同源，跟页面自己发的行为一致
        headers,
        body: JSON.stringify(bodyObj),
      });
    } catch (e) {
      return { netErr: (e && e.message) || String(e) };
    }

    let text = '';
    try { text = await res.text(); } catch (e) { /* noop */ }
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* 不是 JSON */ }
    return { status: res.status, ok: res.ok, json, text };
  }

  /** 按模板拼一份请求体，只动该动的 */
  function bodyFor(page) {
    return Object.assign({}, tpl.body, {
      currentPage: page,
      // 用模板自己的 pageSize，少一处跟页面不一样的地方
      pageSize: (tpl.body && tpl.body.pageSize) || PAGE_SIZE,
      timestamp: String(Date.now()),
    });
  }

  /** 拿模板重放一页 */
  async function fetchPage(page) {
    if (!tpl.ready || !tpl.fetch) {
      throw new Error('还没抄到请求模板 —— 先点开左侧「内容管理」，等视频列表显示出来');
    }
    const r = await fetchRaw(freshUrl(), bodyFor(page));

    if (r.netErr) throw new Error('网络请求失败：' + r.netErr);
    if (r.status === 429 || r.status === 503) throw new Error(`被限流了（HTTP ${r.status}）`);
    if (!r.ok) throw new Error(`请求失败：HTTP ${r.status}`);
    if (!r.json) throw new Error('返回的不是 JSON —— 登录可能已过期，刷新页面重新登录后再来');

    // errCode 的取值没有实测样本，所以不硬映射，原样报出来让人看得见
    if (r.json.errCode !== 0) {
      const msg = (r.json.errMsg || '').toString();
      throw new Error(`接口报错 errCode=${r.json.errCode}${msg ? '：' + msg : ''}`
        + ' —— 点「自检」能定位是哪一步出的问题');
    }
    if (!r.json.data || !Array.isArray(r.json.data.list)) {
      throw new Error('没解析出 data.list —— 接口结构可能变了');
    }
    return r.json.data;
  }

  /* --------------------------------------------------------------------------
   * 自检：二分定位「页面自己发能通、脚本重放不通」到底差在哪
   * --------------------------------------------------------------------------
   * 一路加码，看从哪一步开始挂：
   *   1 原样重放     URL 和请求体一个字不改（连模板里那个旧 timestamp 都留着）
   *   2 只换 _rid
   *   3 只换 timestamp
   *   4 换 _rid + timestamp（也就是正式抓取第 1 页的样子）
   *   5 再把 currentPage 改成 2
   * 第 1 步就挂 → 问题在请求通道或请求头，跟我改的参数无关；
   * 第 n 步开始挂 → 就是第 n 步引入的那个改动的锅。
   * ------------------------------------------------------------------------ */
  function urlWith(kv) {
    try {
      const u = new URL(tpl.url);
      Object.keys(kv).forEach(k => u.searchParams.set(k, kv[k]));
      return u.toString();
    } catch (e) { return tpl.url; }
  }
  const newRid = () => Math.floor(Date.now() / 1000).toString(16) + '-' + hex8();

  async function selfCheck(onStep) {
    const tplPage = (tpl.body && tpl.body.currentPage) || 1;
    const steps = [
      { name: '1 原样重放（一个字不改）', url: () => tpl.url, body: () => Object.assign({}, tpl.body) },
      { name: '2 只换 _rid', url: () => urlWith({ _rid: newRid() }), body: () => Object.assign({}, tpl.body) },
      {
        name: '3 只换 timestamp',
        url: () => tpl.url,
        body: () => Object.assign({}, tpl.body, { timestamp: String(Date.now()) }),
      },
      {
        name: '4 换 _rid + timestamp',
        url: () => urlWith({ _rid: newRid() }),
        body: () => Object.assign({}, tpl.body, { timestamp: String(Date.now()) }),
      },
      {
        name: '5 再翻到第 ' + (tplPage + 1) + ' 页',
        url: () => urlWith({ _rid: newRid() }),
        body: () => Object.assign({}, tpl.body,
          { timestamp: String(Date.now()), currentPage: tplPage + 1 }),
      },
    ];

    const out = [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (onStep) onStep(`自检 ${i + 1}/${steps.length}：${s.name}…`);
      const r = await fetchRaw(s.url(), s.body());
      let verdict;
      if (r.netErr) verdict = '网络错误：' + r.netErr;
      else if (!r.ok) verdict = `HTTP ${r.status}`;
      else if (!r.json) verdict = '返回不是 JSON：' + String(r.text || '').slice(0, 80);
      else if (r.json.errCode === 0) {
        const n = (r.json.data && Array.isArray(r.json.data.list)) ? r.json.data.list.length : '?';
        verdict = `通过，拿到 ${n} 条`;
      } else verdict = `errCode=${r.json.errCode}${r.json.errMsg ? ' ' + r.json.errMsg : ''}`;

      out.push({ name: s.name, ok: !!(r.json && r.json.errCode === 0), verdict });
      if (i < steps.length - 1) await pace(i + 1, tip => onStep && onStep(`自检 ${i + 1} 完，${tip}`));
    }

    // 顺手把模板本身的形状记下来，好判断是不是抄错了东西
    let shape = '';
    try {
      shape = '模板 URL 路径：' + new URL(tpl.url).pathname
        + '\n模板请求头：' + Object.keys(tpl.headers || {}).join(', ')
        + '\n模板请求体字段：' + Object.keys(tpl.body || {}).sort().join(', ')
        + '\n模板里的 currentPage/pageSize：' + tplPage + '/' + ((tpl.body || {}).pageSize);
    } catch (e) { /* noop */ }

    return { steps: out, shape };
  }

  /** data.list[] → 库里的行 */
  function rowsFrom(data, stat) {
    const at = stampNow();
    const now = Math.floor(Date.now() / 1000);
    const out = [];

    for (const it of data.list || []) {
      if (!it) continue;
      const ts = Number(it.createTime) || 0;
      const d = ts ? new Date(ts * 1000) : null;
      const media = (it.desc && Array.isArray(it.desc.media) && it.desc.media[0]) || {};
      const descTxt = String((it.desc && it.desc.description) || '');
      const n = v => (typeof v === 'number' ? String(v) : '');

      const eff = Number(it.effectiveTime) || 0;
      let state = '已发布';
      if (it.disableInfo && it.disableInfo.isDisabled) state = '受限/已下架';
      else if (eff && eff > now) state = '定时待发';
      if (state !== '已发布') stat.notLive++;

      out.push({
        发布日期: d ? fmtDate(d) : '',
        发布时间: d ? fmtTime(d) : '',
        标题: titleOf(descTxt),
        文案: descTxt,
        封面图: String(media.coverUrl || ''),
        时长秒: n(media.videoPlayLen),
        播放量: n(it.readCount),
        // 键名就是列名，1.1.0 改过，这里必须同步改 —— 只靠读库时的 mapRow 迁移不够，
        // 那样新抓的行会带旧键、老行带新键，一行里两套键并存
        '推荐/在看': n(it.likeCount),
        评论: n(it.commentCount),
        '喜欢/点赞': n(it.favCount),
        '转发/分享': n(it.forwardCount),
        涨粉: n(it.followCount),
        推荐给朋友: n(it.forwardAggregationCount),
        转发到私聊: n(it.forwardAllChatCount),
        朋友圈转发: n(it.forwardSnsCount),
        朋友圈封面: n(it.snscoverCount),
        设为铃声: n(it.ringsetCount),
        状态引用: n(it.statusrefCount),
        状态: state,
        数据时间: at,
        _ts: ts,
        _oid: String(it.objectId || ''),
        _exportId: String(it.exportId || ''),
        _nonce: String(it.objectNonce || ''),
        _avgPlaySec: n(it.avgPlayTimeSec),
        _fullPlayRate: n(it.fullPlayRate),
        _fastFlipRate: n(it.fastFlipRate),
        // status / handleStatus 的取值没摸全，原样留着，以后有样本了再翻译
        _statusCode: `status=${it.status}/handle=${it.handleStatus}`,
      });
    }
    return out;
  }

  /**
   * 翻页。
   * 停止条件用「一整页都没有新视频」而不是「遇到第一条已知的就停」——
   * 页面传 stickyOrder:true，置顶视频会插到最前面，按时间戳判会提早收工。
   */
  async function crawl(opts, onProgress) {
    const resume = opts.resume || null;
    const rows = resume ? resume.rows.slice() : [];
    const seen = new Set(rows.map(keyOf));
    const known = opts.mode === 'all' ? new Set() : lib.keys();
    const stat = Object.assign({ pages: 0, notLive: 0, total: 0, reached: '' },
      (resume && resume.stat) || {});
    const startPage = resume ? resume.startPage : (opts.startPage || 1);
    let page = resume ? resume.page : startPage;
    let contiguous = resume ? (resume.contiguous || 0) : (startPage - 1);
    let trimmed = resume ? !!resume.trimmed : false;   // 这一轮有没有页被下限砍过
    let dry = 0;                 // 连续几页「整页都在下限之外」
    let dryTotal = 0;            // 一共跳过了几页这样的
    let reason = '';

    const save = () => progress.write({
      kind: 'list', mode: opts.mode, startPage, page, contiguous, rows, stat,
      trimmed, cutoffTs: opts.cutoffTs || 0, at: Date.now(),
    });

    for (let loop = 0; loop < MAX_PAGES; loop++) {
      if (aborted) { reason = 'stopped'; save(); break; }

      let data;
      try { data = await fetchPage(page); }
      catch (e) { save(); throw new Error(e.message + '（进度已保存，可「继续上次」）'); }

      stat.total = Number(data.totalCount) || stat.total;
      stat.pages++;

      const got = rowsFrom(data, stat);
      if (!got.length) { reason = 'end'; break; }

      let freshOnPage = 0, tooOld = 0;
      for (const r of got) {
        const k = keyOf(r);
        if (opts.cutoffTs && r._ts && r._ts < opts.cutoffTs) { tooOld++; continue; }
        if (!seen.has(k)) { seen.add(k); rows.push(r); }
        if (!known.has(k)) freshOnPage++;
      }

      if (rows.length) stat.reached = rows[rows.length - 1].发布日期;
      /* 覆盖进度：一旦有页被下限砍过，这一轮之后就不再前进。
       * 原来写的是 `if (!tooOld) contiguous = page`，那样后面一个没被砍的页
       * 会把 contiguous 顶上去、跨过中间那个被砍的页，「补抓更早」下次就从它
       * 后面接着翻，被砍掉的那些永远补不回来。 */
      if (tooOld) trimmed = true;
      if (!trimmed) contiguous = page;
      page++;
      save();

      // 增量：一整页都没新东西 → 追平了（被下限砍过的页不算，否则会误判）
      if (opts.mode === 'inc' && freshOnPage === 0 && tooOld === 0) {
        reason = 'caught-up'; break;
      }

      /* 整页都在下限之外 —— 不能就此收工。列表不是严格按日期倒序的，
       * 中间可能夹着一页很老的补发内容，后面还有大量在范围内的。
       * 实测就是这样漏掉 40 条的。所以要连续 CUTOFF_DRY_PAGES 页都这样才停。 */
      if (got.length && tooOld === got.length) {
        dry++; dryTotal++;
        if (dry >= CUTOFF_DRY_PAGES) { reason = 'cutoff'; break; }
      } else {
        dry = 0;
      }
      if (data.continueFlag === false) { reason = 'end'; break; }
      if (stat.total && (page - 1) * PAGE_SIZE >= stat.total) { reason = 'end'; break; }

      onProgress(rows.length, stat, '');
      await pace(stat.pages, tip => onProgress(rows.length, stat, tip));
    }

    if (reason && reason !== 'stopped') progress.clear();
    onProgress(rows.length, stat, '');
    return { rows, stat, contiguous, startPage, reason, trimmed, dryTotal,
      stopped: reason === 'stopped' };
  }

  /**
   * 刷新指定的几条视频。
   * --------------------------------------------------------------------------
   * 接口只能按页拉（一页 20 条），拿不了单条。所以：
   *   1) 库是按发布时间倒序的，跟接口返回的顺序一致，所以第 i 条大致在
   *      第 floor(i / 20) + 1 页 —— 由此算出「要拉哪几页」，去重
   *   2) 拉回来的整页都拿去更新库（反正已经下载了，白捡）
   *   3) 按主键对账；某条没在猜的页里出现，就往相邻页找一圈（置顶、删除会让位置偏移）
   *   4) 还是没找到的，如实报出来，不假装刷新了
   *
   * 选 3 条都在第 1 页 → 只发 1 个请求。这是能做到的最省的做法。
   */
  async function refreshKeys(keys, onProgress) {
    const want = new Set(keys);
    const L = lib.read();
    const all = L.rows;
    const byKey = new Map(all.map(r => [keyOf(r), r]));

    const totalPages = Math.max(1, Math.ceil((L.total || all.length) / PAGE_SIZE));
    const cache = new Map();        // 页码 → 解析好的行，二分和对账共用，别重复请求
    const got = new Map();
    const done = new Set();
    let reqs = 0;

    const pull = async (p) => {
      if (cache.has(p)) return cache.get(p);
      if (reqs > 0) await pace(reqs, tip => onProgress(done.size, want.size, reqs, tip));
      const data = await fetchPage(p);
      reqs++;
      const rows = rowsFrom(data, { notLive: 0 });
      cache.set(p, rows);
      for (const r of rows) {
        got.set(keyOf(r), r);
        if (want.has(keyOf(r))) done.add(keyOf(r));
      }
      onProgress(done.size, want.size, reqs, '');
      return rows;
    };

    /**
     * 按发布时间二分找页码。
     * ------------------------------------------------------------------------
     * 1.2.4 之前是「这条在库里排第几 ÷ 20」推算页码 —— 那只在库是服务器列表的
     * 完整前缀时才成立。实测库里 63 条、服务器 266 条、只连续覆盖了 1 页时，
     * 库里的名次跟服务器的名次完全对不上，推算出的页数自然全错，
     * 表现就是「0/1 条，没在预期页里找到」。
     *
     * 现在改成看日期：抓一页，看这页的时间范围，比目标新就往前翻、比目标旧就往后翻。
     * 266 条最多 4 个请求定位，而且跟库完不完整无关。
     *
     * ⚠ 页面传 stickyOrder:true，置顶视频会插到第 1 页最前面，破坏单调性。
     * 所以比较边界时用「这页时间的中位数附近」而不是最大最小值，并且不管二分
     * 落到哪一页，最后都是按主键在所有抓到的页里对账 —— 二分只负责少抓几页，
     * 对不对得上不由它说了算。
     */
    const findPage = async (ts) => {
      let lo = 1, hi = totalPages;
      while (lo <= hi && !aborted) {
        const mid = (lo + hi) >> 1;
        const rows = await pull(mid);
        if (!rows.length) { hi = mid - 1; continue; }
        const tss = rows.map(r => r._ts || 0).filter(Boolean).sort((a, b) => b - a);
        if (!tss.length) { hi = mid - 1; continue; }
        // 去掉可能被置顶顶上来的头部，用剩下的做边界
        const body = tss.length > 2 ? tss.slice(1) : tss;
        const newest = body[0], oldest = body[body.length - 1];
        if (ts > newest && mid > lo) hi = mid - 1;
        else if (ts < oldest && mid < hi) lo = mid + 1;
        else return mid;
      }
      return -1;
    };

    /**
     * 定位之前先看一眼有没有便宜可占。
     * donePages 的含义正是「从第 1 页往下，已经连续完整覆盖了几页」——
     * 落在这个范围内的行，库里的名次就等于服务器的名次，页码能直接算出来，
     * 一个请求都不用浪费在二分上。超出这个范围的才走二分。
     *
     * 不做这一步的话，最常见的场景（刷新最新那几条，全在第 1 页）会从
     * 1 个请求变成 2 个 —— 二分总是从中间那页开始试。
     */
    const verified = (L.donePages || 0) * PAGE_SIZE;
    const idx = new Map(all.map((r, i) => [keyOf(r), i]));
    const exact = [];
    for (const k of want) {
      const i = idx.get(k);
      if (i == null || i >= verified) continue;
      const p = Math.floor(i / PAGE_SIZE) + 1;
      if (exact.indexOf(p) < 0) exact.push(p);
    }
    exact.sort((a, b) => a - b);
    for (const p of exact) {
      if (aborted) break;
      await pull(p);
    }

    // 剩下的逐个二分。已经在缓存页里对上的就不用再找了（多选时常常一页盖住好几条）
    for (const k of want) {
      if (aborted || done.has(k)) continue;
      const row = byKey.get(k);
      if (!row || !row._ts) continue;
      await findPage(row._ts);
    }

    // 还没对上的，把已抓页的相邻页扫一圈兜底
    const missing = [...want].filter(k => !done.has(k));
    if (missing.length && !aborted) {
      const seen = [...cache.keys()];
      const extra = [];
      seen.forEach(p => [p - 1, p + 1].forEach(q => {
        if (q >= 1 && q <= totalPages && !cache.has(q) && extra.indexOf(q) < 0) extra.push(q);
      }));
      extra.sort((a, b) => a - b);
      for (const q of extra) {
        if (aborted || [...want].every(k => done.has(k))) break;
        await pull(q);
      }
    }

    const rows = [...got.values()];
    // donePages 不动 —— 这是定点刷新，不代表覆盖进度前进了
    const res = rows.length ? lib.merge(rows, null, null) : { added: 0, updated: 0, total: all.length };

    return {
      reqs,
      hit: done.size,
      want: want.size,
      touched: rows.length,
      pages: [...cache.keys()].sort((a, b) => a - b),
      miss: [...want].filter(k => !done.has(k)),
      merged: res,
      stopped: aborted,
    };
  }

  /* ==========================================================================
   * 8. 导出
   * ========================================================================== */
  function toTSV(rows) {
    const sc = activeSchema();
    return [sc.map(headerName).join('\t')]
      .concat(rows.map(r => sc.map(c => cellOf(r, c).replace(/[\t\r\n]/g, ' ')).join('\t')))
      .join('\n');
  }

  function toCSV(rows) {
    const sc = activeSchema();
    const q = v => {
      const s = cell(v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    // 开头拼的 \ufeff 是 BOM，少了它 Excel 打开中文会乱码。
    // 写成转义而不是直接放一个不可见字符，免得哪天被编辑器顺手清掉。
    return '\ufeff' + [sc.map(c => q(headerName(c))).join(',')]
      .concat(rows.map(r => sc.map(c => q(cellOf(r, c))).join(',')))
      .join('\r\n');
  }

  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => {
      try { URL.revokeObjectURL(a.href); } catch (e) { /* noop */ }
      a.remove();
    }, 1000);
  }

  function copyText(text) {
    if (typeof GM_setClipboardText === 'function') { GM_setClipboardText(text); return true; }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  /* ==========================================================================
   * 9. 面板
   * ========================================================================== */
  // 内联本地视频号标识，保持用户脚本单文件安装。
  const LAUNCHER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 658 658" aria-hidden="true" focusable="false">

<g transform="translate(0.000000,658.000000) scale(0.100000,-0.100000)"
fill="#f79c3b" stroke="none">
<path d="M960 6235 c-309 -66 -550 -309 -614 -618 -14 -68 -16 -315 -16 -2327
0 -2463 -3 -2316 57 -2468 75 -186 249 -360 436 -435 151 -60 5 -57 2467 -57
2463 0 2316 -3 2468 57 186 75 360 249 435 436 60 151 57 5 57 2467 0 2462 3
2316 -57 2467 -75 187 -249 361 -435 436 -152 60 -3 57 -2475 56 -1884 0
-2269 -3 -2323 -14z m1028 -1290 c103 -49 201 -125 324 -254 249 -260 558
-692 918 -1283 29 -49 56 -88 61 -88 5 0 14 10 20 23 63 119 440 696 582 891
200 275 412 514 550 620 205 157 392 176 558 57 282 -202 335 -721 158 -1556
-97 -461 -249 -923 -418 -1270 -228 -467 -437 -587 -741 -424 -193 105 -425
346 -622 651 -46 70 -85 127 -88 127 -3 0 -42 -57 -87 -127 -198 -304 -429
-546 -623 -651 -306 -165 -514 -43 -745 434 -217 448 -396 1058 -485 1650 -28
181 -38 526 -20 658 15 110 51 239 86 310 122 243 352 337 572 232z M1788
4558 c-92 -141 -89 -546 8 -1033 94 -474 253 -964 421 -1297 62 -122 129 -228
146 -228 23 0 132 84 212 165 172 173 367 453 465 669 l27 59 -64 111 c-433
742 -892 1372 -1124 1542 -55 40 -71 42 -91 12z M4690 4537 c-73 -58 -206
-198 -307 -323 -211 -261 -544 -761 -801 -1201 l-71 -123 58 -112 c163 -319
398 -614 593 -746 26 -18 50 -32 55 -32 17 0 84 106 147 228 202 398 387 1020
467 1572 31 207 34 540 6 640 -23 85 -49 134 -73 138 -10 1 -44 -17 -74 -41z"/>
</g>
</svg>`;

  const CSS = `
    :host { all:initial; }
    .wrap { --accent:#ed8a23; --accent-dark:#ac5a10; --soft:#fff5e9; --line:#e9e5df;
      position:fixed; right:20px; bottom:20px; z-index:2147483600; box-sizing:border-box;
      width:min(380px, calc(100vw - 16px)); max-height:calc(100dvh - 16px);
      display:flex; flex-direction:column; color:#272b30; background:#fff;
      font:13px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
      border:1px solid var(--line); border-radius:16px; overflow:hidden;
      box-shadow:0 14px 38px #47301724,0 2px 8px #4730170d; }
    *, *::before, *::after { box-sizing:border-box; }
    button, input, select { font:inherit; }
    button { cursor:pointer; }
    button:focus-visible, summary:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    button:disabled { cursor:default; }
    [hidden], .view.hide { display:none !important; }
    .hd { flex:none; display:flex; align-items:center; gap:5px; padding:10px 12px;
      background:#fa9d3b; color:#fff; cursor:move; user-select:none; touch-action:none; }
    .hd-title { flex:1; min-width:0; display:flex; align-items:center; gap:7px; }
    .hd-title b { font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .version { font-size:10px; opacity:.85; }
    .hd button { all:unset; display:grid; place-items:center; flex:none; width:25px; height:25px;
      border-radius:6px; font-size:19px; line-height:1; cursor:pointer; }
    .hd button:hover { background:#ffffff30; }
    .hd button:focus-visible { outline:2px solid #fff; outline-offset:1px; }
    .hd svg { width:15px; height:15px; fill:none; stroke:currentColor; stroke-width:1.7; }
    .tabs { flex:none; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px;
      padding:8px 10px; background:#fbfaf8; border-bottom:1px solid var(--line); }
    .tabs button { all:unset; box-sizing:border-box; display:flex; flex-direction:column; align-items:center;
      justify-content:center; gap:3px; min-width:0; height:53px; cursor:pointer; font-size:11px;
      line-height:1.3; border:1px solid var(--line); border-radius:10px; background:#fff; color:#737069; }
    .tabs svg { width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:1.8;
      stroke-linecap:round; stroke-linejoin:round; }
    .tabs button:hover { background:var(--soft); }
    .tabs button.on { border-color:#f5d4b2; color:var(--accent-dark); background:#fffaf4;
      font-weight:600; box-shadow:0 2px 7px #663c1110; }
    .tabs button.on svg { stroke:var(--accent); }
    .tabs button:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
    .tab-count { display:inline-block; padding:0 4px; margin-left:2px; border-radius:4px;
      background:#f4eee7; font-size:10px; font-variant-numeric:tabular-nums; }
    .bd { flex:0 1 470px; min-height:0; height:470px; padding:12px; overflow-y:auto;
      overscroll-behavior:contain; scrollbar-gutter:stable; }
    .bd.cols-active,.bd.rows-active { display:flex; flex-direction:column; overflow:hidden; scrollbar-gutter:auto; }
    .view { min-width:0; }
    .cols-active [data-view=cols],.rows-active [data-view=rows] { display:flex; flex-direction:column;
      flex:1; min-height:0; }
    .rows-active [data-view=rows] > *, .cols-active [data-view=cols] > * { flex:none; }
    .rows-active [data-view=rows] > .list, .cols-active [data-view=cols] > .cols {
      flex:1; min-height:0; max-height:none; }
    .tpl,.libbar,.resume { display:flex; align-items:center; gap:7px; padding:8px 9px;
      margin-bottom:10px; border:1px solid var(--line); border-radius:8px; font-size:11px; line-height:1.55; }
    .tpl span,.libbar span,.resume span { flex:1; min-width:0; overflow-wrap:anywhere; }
    .tpl.no,.resume { background:#fff8e8; border-color:#f3dfb4; color:#956f2e; }
    .tpl.ok { background:#f1faf5; border-color:#d3eadd; color:#3f7958; }
    .tpl button { all:unset; display:grid; place-items:center; flex:none; width:22px; height:22px;
      border-radius:5px; cursor:pointer; font-size:17px; opacity:.7; }
    .tpl button:hover { background:#00000008; opacity:1; }
    .tpl::before { content:""; width:6px; height:6px; border-radius:50%; flex:none; background:currentColor; }
    .libbar { margin:8px 0; background:#f8f8f7; border-color:#eeebe7; color:#8b8278; }
    .libbar.empty { color:#8f959e; }
    .resume button,.cbar button,.pacts button,.diaglink button { all:unset;
      cursor:pointer; flex:none; color:#82786c; font-size:11px; }
    .resume button:hover,.cbar button:hover,.pacts button:hover,.diaglink button:hover { color:var(--accent-dark); }
    .modes { display:flex; gap:5px; margin-bottom:8px; }
    .modes button { all:unset; flex:1; text-align:center; cursor:pointer; padding:7px 2px; font-size:11.5px;
      border:1px solid #e0dfdc; border-radius:7px; color:#72706c; }
    .modes button.on { background:var(--soft); color:var(--accent-dark); border-color:#f0bf89; font-weight:600; }
    .hint { margin:0 0 10px; font-size:11px; line-height:1.6; color:#92908c; overflow-wrap:anywhere; }
    .grab-date-line { display:flex; align-items:center; gap:8px; font-size:11.5px; color:#737069; }
    .grab-date-line span { flex:none; }
    input[type=date],input[type=number],select,input[type=search] { min-width:0; padding:6px 7px;
      border:1px solid #dedfdf; border-radius:6px; background:#fff; color:#272b30; font-size:11.5px; }
    input[type=date] { flex:1; width:100%; }
    input:focus,select:focus { outline:1px solid var(--accent); border-color:var(--accent); }
    .quick { display:flex; gap:6px; margin:7px 0 12px; }
    .quick button { all:unset; cursor:pointer; padding:2px 9px; border:1px solid #e8e3dd;
      border-radius:12px; color:#898178; font-size:11px; }
    .quick button:hover { background:var(--soft); color:var(--accent-dark); border-color:#edc397; }
    .btns { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }
    .btns.one { grid-template-columns:1fr; }
    .btns button { all:unset; box-sizing:border-box; text-align:center; cursor:pointer; min-width:0;
      padding:7px 4px; border:1px solid #dedfdf; border-radius:7px; background:#fff; font-size:12px; }
    .btns button:hover { color:var(--accent-dark); border-color:#edb87e; background:#fffbf6; }
    .btns button.p { background:#fa9d3b; border-color:#fa9d3b; color:#fff; font-weight:600; }
    .btns button.p:hover { background:#ed8d27; }
    .btns button:disabled,.btns button:disabled:hover { background:#f5f6f7; border-color:#eceeef;
      color:#b4b8bd; cursor:default; }
    .btns button.danger { color:#b36358; }
    .btns button.danger:disabled { color:#b4b8bd; }
    .btns button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    .grab-run { margin-top:12px; }
    .grab-run button { padding:9px; }
    .sect { margin-top:12px; padding-top:10px; border-top:1px solid var(--line); }
    .row { margin-bottom:8px; font-size:11px; line-height:1.65; color:#878078; }
    .section-title { margin:0 0 9px; color:#62594e; font-size:11.5px; font-weight:600; }
    .diaglink { text-align:center; }
    .diaglink button.hot { color:#c44c40; }
    .maintenance { margin-top:12px; border-top:1px solid var(--line); padding-top:10px; }
    .maintenance summary { cursor:pointer; color:#8b8278; font-size:11px; }
    .maintenance .btns { margin-top:8px; }
    .cols { margin:0 0 8px; overflow:auto; overscroll-behavior:contain; }
    .crow { display:flex; align-items:center; gap:6px; padding:7px 3px; border-bottom:1px solid #f2f1ef;
      background:#fff; font-size:12px; }
    .crow.calc { background:#fffaf4; }
    .crow.drag { opacity:.45; }
    .grip { cursor:grab; color:#c7c2bc; user-select:none; padding:2px 1px; font-size:12px; }
    .grip:active { cursor:grabbing; }
    .ck,.it input.rk { flex:none; margin:0; width:14px; height:14px; cursor:pointer; accent-color:var(--accent); }
    .cn { flex:1; color:#686662; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .crow.calc .cn,.crow.calc .cv { color:var(--accent-dark); }
    .crow.off .cn,.crow.off .cv { color:#c4c3c0; }
    .cv { max-width:42%; text-align:right; font-weight:600; font-variant-numeric:tabular-nums;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .cv.miss { color:#be766a; font-weight:400; }
    .cn .tag { color:#c1b9af; font-size:9px; margin-left:3px; }
    .chip { all:unset; flex:none; cursor:pointer; font-size:10px; padding:1px 5px; line-height:1.5;
      border:1px solid #e4d9cb; border-radius:9px; color:#a17b50; background:#fff; }
    .sub { padding:7px 8px 8px 26px; background:#fffaf4; border-bottom:1px solid #f2f1ef; }
    .sub .h,.sub .eq { color:#9b886f; font-size:10.5px; margin-bottom:5px; overflow-wrap:anywhere; }
    .sub .eq { margin:6px 0 0; }
    .sub .ops { display:flex; flex-wrap:wrap; gap:5px 10px; }
    .sub label { display:inline-flex; align-items:center; gap:4px; font-size:11.5px; color:#76716a; cursor:pointer; }
    .sub input { margin:0; accent-color:var(--accent); }
    .cbar { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin:0 0 7px; color:#8d8983; font-size:11px; }
    .cbar > span { flex:1; }
    .cbar b { font-weight:600; color:#686662; }
    .cbar button:disabled,.pacts button:disabled { color:#c4c3c0; cursor:default; }
    .template-footer { display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding-top:9px;
      border-top:1px solid var(--line); }
    .pbar { display:flex; align-items:center; flex:1; min-width:100px; gap:6px; color:#8b8278; font-size:11px; }
    .pbar select { flex:1; width:0; padding:5px 2px; }
    .pacts { display:flex; flex-wrap:wrap; gap:6px; }
    .pacts button.hot { color:var(--accent-dark); font-weight:600; }
    .filt { display:grid; grid-template-columns:minmax(0,1fr) 84px 86px; gap:5px; margin-bottom:8px; }
    .filt input,.filt select { width:100%; }
    .selection-bar { min-height:22px; }
    .list { overflow:auto; overscroll-behavior:contain; border-top:1px solid #eeebe7; border-bottom:1px solid #eeebe7; }
    .it { display:flex; gap:7px; align-items:center; padding:9px 3px; border-bottom:1px solid #f2f1ef; font-size:11.5px; }
    .it.new { background:#fff9f0; }
    .it.sel { background:#fff0db; }
    .it-content { flex:1; min-width:0; }
    .it .t { display:block; color:#33312e; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .it-meta { display:flex; align-items:center; gap:6px; margin-top:2px; min-height:15px; font-size:10px; color:#a09a93; }
    .it .d { flex:none; font-variant-numeric:tabular-nums; }
    .it .tags { color:#ac7d44; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .it .flag { flex:none; padding:0 4px; background:#f1eeea; border-radius:4px; font-size:9px; }
    .it .flag.wait { color:#b18737; background:#fff4d9; }
    .it .flag.bad { color:#c15d50; background:#fff0ed; }
    .it-metric { flex:none; text-align:right; font-variant-numeric:tabular-nums; color:#6b6359; }
    .it-metric small { display:block; font-size:9px; color:#aaa198; }
    .more { padding:16px 8px; text-align:center; color:#a29a90; font-size:11px; }
    .more b { display:block; font-weight:500; color:#7c7369; margin-bottom:3px; }
    .more button { all:unset; cursor:pointer; color:var(--accent-dark); padding:5px 10px;
      border:1px solid #ecd0ae; border-radius:6px; }
    .rows-actions { margin-top:8px; }
    .rows-secondary { display:flex; align-items:center; gap:6px; margin-top:6px; min-height:22px; }
    .rows-secondary .hint { flex:1; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; margin:0; font-size:10px; }
    .text-danger { all:unset; flex:none; cursor:pointer; color:#b77469; font-size:10.5px; }
    .text-danger:disabled { color:#b4b8bd; cursor:default; }
    .rows-export { padding-top:9px; margin-top:7px; border-top:1px solid var(--line); }
    .scope { font-size:10px; color:#a39788; text-align:center; margin-top:5px; }
    .diag { margin-top:8px; font-size:11px; line-height:1.7; overflow-wrap:anywhere; }
    .diag .r { display:flex; gap:6px; align-items:flex-start; }
    .diag .r .n { flex:none; width:14px; }
    .diag .r.ok { color:#2ba471; }
    .diag .r.no { color:#d33; }
    .diag pre { margin:6px 0 0; padding:7px; background:#f7f8fa; border-radius:6px;
      font:11px/1.6 ui-monospace,Menlo,Consolas,monospace; white-space:pre-wrap; overflow-wrap:anywhere; color:#77716a; }
    .diag .cc { margin-top:6px; color:#a8641b; }
    .status-stack { flex:none; min-height:0; }
    .st,.run-status { display:flex; align-items:center; gap:7px; min-height:42px; padding:7px 10px;
      border-top:1px solid var(--line); background:#fcfaf7; font-size:11px; line-height:1.5; color:#8b7b67; }
    .st-icon { display:grid; place-items:center; flex:none; width:17px; height:17px;
      border-radius:50%; background:#f0e6d9; font-size:10px; }
    .st.ok { color:#487758; } .st.ok .st-icon { background:#e6f5eb; }
    .st.err { color:#b34e43; background:#fff8f6; } .st.err .st-icon { background:#ffede9; }
    .st.warn { color:#9e762d; } .st.warn .st-icon { background:#fff0cf; }
    .run-icon { flex:none; width:17px; height:17px; border:2px solid #f0d7b9;
      border-top-color:var(--accent); border-radius:50%; animation:ch-spin .9s linear infinite; }
    @keyframes ch-spin { to { transform:rotate(360deg); } }
    .st-copy,.run-copy { flex:1; min-width:0; display:-webkit-box; -webkit-box-orient:vertical;
      -webkit-line-clamp:2; overflow:hidden; overflow-wrap:anywhere; }
    .st.expanded { align-items:flex-start; }
    .st.expanded .st-copy { display:block; -webkit-line-clamp:unset; max-height:min(150px,22vh);
      overflow-y:auto; overscroll-behavior:contain; white-space:pre-wrap; }
    .st button { all:unset; display:grid; place-items:center; flex:none; width:22px; height:22px;
      border-radius:5px; cursor:pointer; font-size:16px; color:inherit; opacity:.7; }
    .st button:hover { background:#00000008; opacity:1; }
    .launcher { display:none; }
    .wrap.is-collapsed { width:64px; height:64px; border:0; border-radius:22px;
      overflow:visible; background:transparent; box-shadow:none; }
    .wrap.is-collapsed > :not(.launcher) { display:none; }
    .wrap.is-collapsed .launcher { all:unset; box-sizing:border-box; display:grid; place-items:center;
      width:64px; height:64px; border-radius:22px; border:1px solid #fffffff0; cursor:pointer; touch-action:none;
      background:linear-gradient(145deg,#ffffffed,#fff2dfb8); -webkit-backdrop-filter:blur(18px) saturate(160%);
      backdrop-filter:blur(18px) saturate(160%); box-shadow:inset 0 1px 2px #fff,0 12px 30px #683a122b,0 2px 6px #63390d14; }
    .launcher svg { width:43px; height:43px; }
    .wrap.is-collapsed .launcher:hover { transform:translateY(-2px); }
    .wrap.is-collapsed .launcher:focus-visible { outline:3px solid var(--accent); outline-offset:3px; }
    .wrap button { transition:background .18s,color .18s,border-color .18s,transform .18s; }
    .wrap button:active:not(:disabled) { transform:translateY(1px); }
    @media (max-width:350px) { .bd { padding:9px; } .filt { grid-template-columns:minmax(0,1fr) 73px 78px; gap:4px; }
      .filt input,.filt select { font-size:10.5px; padding:5px 4px; } .version { display:none; }
      .pacts { width:100%; justify-content:space-between; } }
    @media (max-height:550px) { .hd { padding:4px 9px; } .tabs { padding:5px 8px; }
      .tabs button { height:32px; flex-direction:row; gap:5px; } .tabs svg { width:16px; height:16px; }
      .st,.run-status { min-height:34px; padding:5px 8px; } .bd { padding:8px 10px; } .rows-secondary .hint { display:none; }
      .rows-secondary { justify-content:flex-end; min-height:17px; margin-top:2px; }
      .rows-export { margin-top:5px; padding-top:5px; } .btns button { padding:5px 3px; }
      .scope { margin-top:3px; } .it { padding:6px 3px; } }
    @media (max-height:360px) { .bd.rows-active,.bd.cols-active { display:block; overflow:auto; }
      .rows-active [data-view=rows] > .list { flex:none; min-height:100px; max-height:150px; }
      .cols-active [data-view=cols] > .cols { flex:none; min-height:100px; max-height:150px; } }
    .wrap button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    .wrap .hd button:focus-visible { outline-color:#fff; }
    @media (prefers-reduced-motion:reduce) { .wrap button { transition:none; }
      .wrap button:active:not(:disabled),.wrap.is-collapsed .launcher:hover { transform:none; }
      .run-icon { animation:none; } }
  `;

  let ui = null;
  let mode = 'inc';
  let previewCount = PREVIEW_LIMIT;
  let statusNotice = null;
  let storageNotice = null;
  let observedStorageError = 0;
  let acknowledgedStorageError = 0;
  let statusExpanded = false;
  let taskMessage = '';
  let runWasActive = false;
  const templateNotice = { seen: false, dismissed: false, clock: null };
  let running = false;
  let dragLock = false;
  let sumOpen = false;
  let fresh = new Set();
  let sel = new Set();     // 勾选的视频（按主键），只在本次会话内有效
  let lastCheck = null;    // 上次自检的结果，供「复制自检结果」用
  let diagOpen = false;    // 自检那一块展开了没（只在本次会话内有效）
  let lastErr = false;     // 这次会话里请求挂过没 —— 挂过才把自检入口写显眼

  const MODE_HINT = {
    inc: '从第 1 页翻，直到一整页都没有新视频为止。日常就用这个。',
    older: '从上次连续覆盖到的那页接着往下翻，用来分几次补全历史。',
    all: '从第 1 页翻到底，覆盖所有数字。不清库、标签不会丢。全量约十几个请求。',
  };

  function build() {
    const host = document.createElement('div');
    host.id = PANEL_ID;
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${CSS}</style>
      <div class="wrap">
        <button type="button" class="launcher" data-act="toggle" aria-label="展开视频号视频数据"
          aria-expanded="true" aria-controls="ch-data-tabs ch-data-body" title="展开视频号视频数据">${LAUNCHER_ICON}</button>
        <div class="hd" data-drag>
          <div class="hd-title"><b>视频号视频数据</b><span class="version">1.2.7</span></div>
          <button type="button" data-act="home" title="回到右下角（双击标题栏也可）" aria-label="回到右下角">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7M4 4v7M4 4l16 16M13 20h7v-7"/></svg>
          </button>
          <button type="button" data-act="toggle" title="收起为图标" aria-label="收起为图标"
            aria-expanded="true" aria-controls="ch-data-tabs ch-data-body">−</button>
        </div>
        <div class="tabs" id="ch-data-tabs" role="tablist" aria-label="功能区">
          <button type="button" id="ch-tab-grab" data-tab="grab" class="on" role="tab" aria-controls="ch-panel-grab" aria-selected="true" tabindex="0">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m-4-4 4 4 4-4M5 16v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/></svg>
            <span>抓取</span>
          </button>
          <button type="button" id="ch-tab-cols" data-tab="cols" role="tab" aria-controls="ch-panel-cols" aria-selected="false" tabindex="-1">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18"/></svg>
            <span>列设置</span>
          </button>
          <button type="button" id="ch-tab-rows" data-tab="rows" role="tab" aria-controls="ch-panel-rows" aria-selected="false" tabindex="-1">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4Z"/></svg>
            <span>视频<span class="tab-count" data-cnt>0</span></span>
          </button>
        </div>
        <div class="bd" id="ch-data-body">
          <div class="view" id="ch-panel-grab" data-view="grab" role="tabpanel" aria-labelledby="ch-tab-grab">
            <div class="tpl no" data-tpl role="status" aria-live="polite">
              <span data-tpl-txt></span><button type="button" data-act="tpl-dismiss" data-tpl-dismiss
                aria-label="关闭就绪提示" title="关闭就绪提示" hidden>×</button>
            </div>
            <div class="modes">
              <button data-mode="inc" class="on" aria-pressed="true">增量更新</button>
              <button data-mode="older" aria-pressed="false">补抓更早</button>
              <button data-mode="all" aria-pressed="false">全量刷新</button>
            </div>
            <div class="hint" data-hint></div>
            <div data-daterow>
              <label class="grab-date-line"><span>抓取到</span><input type="date" data-since title="包含所选日期当天"></label>
              <div class="quick">
                <button data-days="30">近 30 天</button><button data-days="90">近 90 天</button>
                <button data-days="365">近一年</button><button data-days="0">不限</button>
              </div>
            </div>
            <div class="resume" data-resume style="display:none">
              <span data-resume-txt></span><button data-act="resume">继续上次</button><button data-act="drop">丢弃</button>
            </div>
            <div class="btns one grab-run"><button class="p" data-act="go">开始抓取</button></div>
            <div class="sect">
              <div class="diaglink"><button data-act="diag-toggle" data-diaglink aria-expanded="false" aria-controls="ch-diag"></button></div>
              <div id="ch-diag" data-diagbox style="display:none">
                <div class="row">检查请求模板与接口连接，定位抓取失败的步骤。</div>
                <div class="btns"><button data-act="check">开始自检</button><button data-act="check-copy">复制自检结果</button></div>
                <div class="diag" data-diag></div>
              </div>
            </div>
            <details class="maintenance">
              <summary>本地数据管理</summary>
              <div class="libbar" data-lib><span data-lib-txt></span></div>
              <div class="btns one"><button class="danger" data-act="lib-clear">清空视频库</button></div>
            </details>
          </div>

          <div class="view hide" id="ch-panel-cols" data-view="cols" role="tabpanel" aria-labelledby="ch-tab-cols">
            <div class="hint" data-colshint></div>
            <div class="cols" data-cols></div>
            <div class="cbar">
              <span>导出 <b data-on>0</b> 列 · 拖 ⠿ 排序</span>
              <button data-act="col-all" data-allbtn>全选</button><button data-act="col-reset">恢复默认</button>
            </div>
            <div class="template-footer">
              <label class="pbar"><span>模板</span><select data-preset aria-label="列模板"></select></label>
              <div class="pacts">
                <button data-act="preset-saveas">另存为</button><button data-act="preset-overwrite" data-ov>覆盖</button>
                <button data-act="preset-rename" data-ren>改名</button><button data-act="preset-del" data-del>删除</button>
              </div>
            </div>
          </div>

          <div class="view hide" id="ch-panel-rows" data-view="rows" role="tabpanel" aria-labelledby="ch-tab-rows">
            <div class="filt">
              <input type="search" data-q placeholder="搜索文案…" aria-label="搜索视频文案">
              <select data-tagf aria-label="按标签筛选"></select>
              <select data-stf aria-label="按状态筛选"><option value="">状态不限</option><option value="live">已发布</option>
                <option value="wait">定时待发</option><option value="bad">受限/已下架</option></select>
            </div>
            <div class="cbar selection-bar">
              <span data-selinfo></span><button data-act="sel-all">全选</button>
              <button data-act="sel-none">清空</button><button data-act="sel-inv">反选</button>
            </div>
            <div class="list" data-list aria-label="本地视频列表" tabindex="0"></div>
            <div class="btns rows-actions"><button data-act="refresh-sel">刷新选中</button><button data-act="tag-sel">标签…</button></div>
            <div class="rows-secondary"><div class="hint" data-refhint></div><button class="text-danger" data-act="del-sel">删除选中</button></div>
            <div class="rows-export">
              <div class="btns"><button class="p" data-act="copy">复制</button><button data-act="csv">导出 CSV</button></div>
              <div class="scope" data-scope></div>
            </div>
          </div>
        </div>
        <div class="status-stack">
          <div class="run-status" data-run-status role="status" aria-live="off" hidden>
            <span class="run-icon" aria-hidden="true"></span><span class="run-copy" data-run-copy></span>
          </div>
          <div class="st empty" data-st role="status" aria-live="polite" aria-atomic="true" hidden>
            <span class="st-icon" data-st-icon aria-hidden="true"></span><span class="st-copy" id="ch-status-copy" data-st-copy></span>
            <button type="button" data-act="status-expand" data-st-expand aria-controls="ch-status-copy"
              aria-expanded="false" aria-label="展开完整提示" title="展开完整提示" hidden>…</button>
            <button type="button" data-act="status-dismiss" aria-label="关闭提示" title="关闭提示">×</button>
          </div>
        </div>
      </div>
`;
    document.body.appendChild(host);

    const $ = s => root.querySelector(s);
    ui = {
      host, root, body: $('.bd'), wrap: $('.wrap'), launcher: $('.launcher'),
      statusCopy: $('[data-st-copy]'), statusIcon: $('[data-st-icon]'), statusExpand: $('[data-st-expand]'),
      runStatus: $('[data-run-status]'), runCopy: $('[data-run-copy]'), tplDismiss: $('[data-tpl-dismiss]'),
      tpl: $('[data-tpl]'), tplTxt: $('[data-tpl-txt]'),
      libBar: $('[data-lib]'), libTxt: $('[data-lib-txt]'),
      hint: $('[data-hint]'), dateRow: $('[data-daterow]'), since: $('[data-since]'),
      resume: $('[data-resume]'), resumeTxt: $('[data-resume-txt]'),
      goBtn: $('[data-act="go"]'),
      checkBtn: $('[data-act="check"]'), checkCopyBtn: $('[data-act="check-copy"]'),
      diag: $('[data-diag]'), diagBox: $('[data-diagbox]'), diagLink: $('[data-diaglink]'),
      cols: $('[data-cols]'), onCount: $('[data-on]'), allBtn: $('[data-allbtn]'),
      colsHint: $('[data-colshint]'),
      preset: $('[data-preset]'), ovBtn: $('[data-ov]'), renBtn: $('[data-ren]'), delBtn: $('[data-del]'),
      copy: $('[data-act="copy"]'), csv: $('[data-act="csv"]'),
      status: $('[data-st]'), list: $('[data-list]'), count: $('[data-cnt]'),
      q: $('[data-q]'), tagF: $('[data-tagf]'), stF: $('[data-stf]'),
      selInfo: $('[data-selinfo]'), scope: $('[data-scope]'),
      tagBtn: $('[data-act="tag-sel"]'),
      refBtn: $('[data-act="refresh-sel"]'), refHint: $('[data-refhint]'),
      delBtn2: $('[data-act="del-sel"]'),
      tabs: [...root.querySelectorAll('[data-tab]')],
      views: [...root.querySelectorAll('.view')],
      modeBtns: [...root.querySelectorAll('[data-mode]')],
    };
    const filterChanged = () => { previewCount = PREVIEW_LIMIT; ui.list.scrollTop = 0; refresh(); };
    ui.q.addEventListener('input', filterChanged);
    ui.tagF.addEventListener('change', filterChanged);
    ui.stF.addEventListener('change', filterChanged);
    ui.list.addEventListener('change', onRowCheck);

    const d = new Date();
    d.setDate(d.getDate() - 90);
    ui.since.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    ui.cols.addEventListener('change', onColToggle);
    ui.preset.addEventListener('change', onPresetPick);
    root.addEventListener('click', onClick);
    initDrag(ui.cols);
    ui.disposeDrag = makeDraggable(ui.wrap, $('[data-drag]'), ui.launcher);
    initTabKeyboard(root.querySelector('.tabs'), '[data-tab]', name => selectTab(name));
    selectTab(readUiPreference('active_tab', 'grab'), false);
    restorePanelPosition(ui.wrap);
    ui.disposeNotices = initNotifications();

    if (!lib.read().rows.length) mode = 'all';
    refresh();
  }

  // UI 偏好单独写入，不经过 rawWrite，避免清除或覆盖业务数据的 storeErr。
  function readUiPreference(name, fallback) {
    return rawRead(`channels_ui_v1_${name}`, fallback);
  }

  function writeUiPreference(name, value) {
    try {
      const key = `channels_ui_v1_${name}`;
      if (typeof GM_setValue === 'function') GM_setValue(key, value);
      else localStorage.setItem(key, value);
      return true;
    } catch (_) {
      // 偏好写入失败不影响面板操作，也不冒充业务数据保存成功。
      return false;
    }
  }

  function panelPoint(rect) {
    return rect && Number.isFinite(rect.left) && Number.isFinite(rect.top)
      ? { left: Math.round(rect.left), top: Math.round(rect.top) }
      : null;
  }

  function readPanelPosition(collapsed) {
    try {
      const saved = JSON.parse(readUiPreference(collapsed ? 'icon_position' : 'open_position', 'null'));
      const point = panelPoint(saved);
      if (point && collapsed) point.openPosition = panelPoint(saved.openPosition);
      return point;
    } catch (_) {
      return null;
    }
  }

  function positionPanel(box, left, top) {
    const rect = box.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    box.style.left = Math.max(margin, Math.min(maxLeft, left)) + 'px';
    box.style.top = Math.max(margin, Math.min(maxTop, top)) + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';
  }

  function savePanelPosition(collapsed, rect, openRect) {
    const point = panelPoint(rect);
    if (!point) return;
    if (collapsed) {
      // 拖过图标后丢弃旧展开位置，下一次从图标的新位置就近展开。
      point.openPosition = panelPoint(openRect);
      if (ui) ui.iconAnchor = point;
    }
    writeUiPreference(collapsed ? 'icon_position' : 'open_position', JSON.stringify(point));
  }

  function syncPanelToggle(collapsed) {
    if (!ui) return;
    ui.root.querySelectorAll('[data-act="toggle"]').forEach(button => {
      button.setAttribute('aria-expanded', String(!collapsed));
      const label = button === ui.launcher ? '展开视频号数据' : '收起为图标';
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  }

  function restorePanelPosition(box) {
    const collapsed = readUiPreference('collapsed', '0') === '1';
    box.classList.toggle('is-collapsed', collapsed);
    ui.iconAnchor = readPanelPosition(true);
    const saved = collapsed ? ui.iconAnchor : readPanelPosition(false);
    const current = box.getBoundingClientRect();
    positionPanel(box, saved ? saved.left : current.left, saved ? saved.top : current.top);
    syncPanelToggle(collapsed);
  }

  function homePanel(box) {
    const rect = box.getBoundingClientRect();
    positionPanel(box, window.innerWidth - rect.width - 20, window.innerHeight - rect.height - 20);
    savePanelPosition(box.classList.contains('is-collapsed'), box.getBoundingClientRect());
  }

  function makeDraggable(box, handle, launcher) {
    let drag = null;
    let lastLauncherDrag = -Infinity;
    const start = e => {
      if (e.button !== 0 || (e.currentTarget === handle && e.target.closest('button'))) return;
      const rect = box.getBoundingClientRect();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY,
        left: rect.left, top: rect.top, moved: false, target: e.currentTarget };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* 浏览器已取消指针 */ }
    };
    const move = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      positionPanel(box, drag.left + dx, drag.top + dy);
      e.preventDefault();
    };
    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const done = drag;
      drag = null;
      if (done.moved) {
        savePanelPosition(box.classList.contains('is-collapsed'), box.getBoundingClientRect());
        if (done.target === launcher) lastLauncherDrag = performance.now();
      }
      try {
        if (done.target.hasPointerCapture(done.id)) done.target.releasePointerCapture(done.id);
      } catch (_) { /* 已丢失指针捕获 */ }
    };
    const preventDragClick = e => {
      // 键盘触发的 click.detail=0 始终允许；拖动释放产生的 click 则忽略。
      if (e.detail === 0 || performance.now() - lastLauncherDrag >= 250) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const resetHome = e => {
      if (e.target.closest('button')) return;
      homePanel(box);
    };
    const resize = () => {
      if (!box.isConnected) return;
      const rect = box.getBoundingClientRect();
      positionPanel(box, rect.left, rect.top);
      const collapsed = box.classList.contains('is-collapsed');
      // 缩窗夹边不算主动拖动图标，保留它与展开面板的配对信息。
      savePanelPosition(collapsed, box.getBoundingClientRect(), collapsed ? ui?.iconAnchor?.openPosition : null);
    };
    for (const el of [handle, launcher]) {
      el.addEventListener('pointerdown', start);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('lostpointercapture', end);
    }
    handle.addEventListener('dblclick', resetHome);
    launcher.addEventListener('click', preventDragClick, true);
    window.addEventListener('resize', resize);
    return () => {
      if (drag) end({ pointerId: drag.id });
      for (const el of [handle, launcher]) {
        el.removeEventListener('pointerdown', start);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', end);
        el.removeEventListener('pointercancel', end);
        el.removeEventListener('lostpointercapture', end);
      }
      handle.removeEventListener('dblclick', resetHome);
      launcher.removeEventListener('click', preventDragClick, true);
      window.removeEventListener('resize', resize);
    };
  }

  function togglePanel() {
    if (!ui) return;
    const box = ui.wrap;
    const from = box.getBoundingClientRect();
    const collapsed = !box.classList.contains('is-collapsed');
    const anchor = ui.iconAnchor;
    box.classList.toggle('is-collapsed', collapsed);
    const size = box.getBoundingClientRect();
    if (collapsed) {
      // 面板拖动后，沿用图标相对于上次展开面板的偏移，并夹在新面板内。
      const origin = anchor?.openPosition || from;
      const left = anchor ? from.left + anchor.left - origin.left : from.right - size.width;
      const top = anchor ? from.top + anchor.top - origin.top : from.bottom - size.height;
      positionPanel(box,
        Math.max(from.left, Math.min(from.right - size.width, left)),
        Math.max(from.top, Math.min(from.bottom - size.height, top)));
      savePanelPosition(true, box.getBoundingClientRect(), from);
    } else {
      const sameAnchor = anchor && anchor.left === Math.round(from.left) && anchor.top === Math.round(from.top);
      const remembered = sameAnchor && anchor.openPosition;
      const fits = remembered && from.left >= remembered.left - 1 && from.top >= remembered.top - 1 &&
        from.right <= remembered.left + size.width + 1 && from.bottom <= remembered.top + size.height + 1;
      const target = fits ? remembered : {
        left: from.left <= window.innerWidth - from.right ? from.left : from.right - size.width,
        top: from.top <= window.innerHeight - from.bottom ? from.top : from.bottom - size.height,
      };
      positionPanel(box, target.left, target.top);
      const expanded = box.getBoundingClientRect();
      savePanelPosition(true, from, expanded);
      savePanelPosition(false, expanded);
    }
    writeUiPreference('collapsed', collapsed ? '1' : '0');
    syncPanelToggle(collapsed);
    const focusTarget = collapsed ? ui.launcher : ui.root.querySelector('[data-tab].on');
    focusTarget?.focus({ preventScroll: true });
    renderStatus(); // 展开后重新测量长消息，隐藏时无法取得真实文字高度
  }


  function selectTab(name, save = true) {
    if (!['grab', 'cols', 'rows'].includes(name)) name = 'grab';
    ui.tabs.forEach(button => {
      const active = button.dataset.tab === name;
      button.classList.toggle('on', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    ui.views.forEach(view => view.classList.toggle('hide', view.dataset.view !== name));
    ui.body.classList.toggle('cols-active', name === 'cols');
    ui.body.classList.toggle('rows-active', name === 'rows');
    ui.body.scrollTop = 0;
    if (save) writeUiPreference('active_tab', name);
    syncNotificationClocks();
  }

  function initTabKeyboard(container, selector, choose) {
    container.addEventListener('keydown', event => {
      const current = event.target.closest(selector);
      if (!current || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const buttons = [...container.querySelectorAll(selector)];
      const index = buttons.indexOf(current);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      event.preventDefault();
      choose(buttons[next].dataset.tab);
      buttons[next].focus();
    });
  }

  const MESSAGE_DURATION = { info: 4000, ok: 4000, warn: 6000 };

  function newNotice(message, kind) {
    return {
      message, kind, origin: ui?.root.activeElement,
      clock: MESSAGE_DURATION[kind] ? {
        remaining: MESSAGE_DURATION[kind], deadline: null, timer: null, revision: 0,
      } : null,
    };
  }

  function pauseNoticeClock(clock) {
    if (!clock) return;
    if (clock.deadline != null) clock.remaining = Math.max(0, clock.deadline - Date.now());
    if (clock.timer != null) clearTimeout(clock.timer);
    clock.timer = null;
    clock.deadline = null;
    clock.revision++;
  }

  function syncNoticeClock(clock, active, expire) {
    if (!clock) return;
    if (!active) { pauseNoticeClock(clock); return; }
    if (clock.timer != null) return;
    if (clock.remaining <= 0) { expire(); return; }
    const owner = ui;
    const revision = ++clock.revision;
    clock.deadline = Date.now() + clock.remaining;
    clock.timer = setTimeout(() => {
      if (revision !== clock.revision) return;
      clock.timer = null;
      clock.deadline = null;
      clock.remaining = 0;
      if (ui === owner && owner.host.isConnected) expire();
    }, clock.remaining);
  }

  function noticesVisible() {
    return ui && ui.host.isConnected && !document.hidden && !ui.wrap.classList.contains('is-collapsed');
  }

  function noticeIsBeingRead(element) {
    return element.matches(':hover') || element.contains(ui.root.activeElement);
  }

  function syncNotificationClocks() {
    if (!ui) return;
    const visible = noticesVisible();
    const notice = statusNotice;
    syncNoticeClock(notice?.clock,
      visible && !storageNotice && !statusExpanded && !noticeIsBeingRead(ui.status), () => {
        if (statusNotice !== notice) return;
        statusNotice = null;
        renderStatus();
      });
    syncNoticeClock(templateNotice.clock,
      visible && !templateNotice.dismissed && !ui.tpl.hidden &&
      ui.root.querySelector('[data-tab="grab"]').classList.contains('on') && !noticeIsBeingRead(ui.tpl), () => {
        templateNotice.dismissed = true;
        renderTemplateNotice();
      });
  }

  function pauseNotificationClocks() {
    pauseNoticeClock(statusNotice?.clock);
    pauseNoticeClock(templateNotice.clock);
  }

  function initNotifications() {
    const owner = ui;
    const sync = () => { if (ui === owner) syncNotificationClocks(); };
    const listeners = [];
    const listen = (target, type, callback) => {
      target.addEventListener(type, callback);
      listeners.push(() => target.removeEventListener(type, callback));
    };
    for (const element of [owner.status, owner.tpl]) {
      listen(element, 'mouseenter', sync);
      listen(element, 'mouseleave', sync);
      listen(element, 'focusin', sync);
      listen(element, 'focusout', () => queueMicrotask(sync));
    }
    listen(document, 'visibilitychange', sync);
    listen(window, 'resize', () => { if (ui === owner) renderStatus(); });
    return () => {
      pauseNotificationClocks();
      listeners.forEach(remove => remove());
    };
  }

  // 提示展开或出现时只纠正越界，不改变用户保存的拖动位置。
  function fitNotificationLayout() {
    if (!ui || !ui.host.isConnected || ui.wrap.classList.contains('is-collapsed')) return;
    const r = ui.wrap.getBoundingClientRect();
    if (r.left < 8 || r.top < 8 || r.right > innerWidth - 8 || r.bottom > innerHeight - 8) {
      positionPanel(ui.wrap, r.left, r.top);
    }
  }

  function setNoticeText(element, text) {
    // 不反复重建相同文字，避免常规 refresh 让读屏重新播报。
    if (element.textContent !== text) element.textContent = text;
  }

  function renderTemplateNotice() {
    if (!ui) return;
    if (tpl.ready && !templateNotice.seen) {
      templateNotice.seen = true;
      templateNotice.clock = { remaining: 4000, deadline: null, timer: null, revision: 0 };
    }
    ui.tpl.className = tpl.ready ? 'tpl ok' : 'tpl no';
    ui.tpl.hidden = tpl.ready && templateNotice.dismissed;
    ui.tplDismiss.hidden = !tpl.ready;
    setNoticeText(ui.tplTxt, tpl.ready
      ? '列表模板已就绪，可以开始抓取'
      : '先打开左侧「内容管理」，等待视频列表显示');
    ui.tpl.title = tpl.ready ? `最近捕获：${new Date(tpl.at).toLocaleTimeString('zh-CN')}` : '';
    ui.goBtn.title = tpl.ready ? '使用内容管理列表的当前模板抓取数据' : '等待内容管理的列表请求模板';
    syncNotificationClocks();
    fitNotificationLayout();
  }

  function renderStatus() {
    if (!ui) return;
    if (running && !runWasActive) {
      pauseNoticeClock(statusNotice?.clock);
      statusNotice = null;
      statusExpanded = false;
      taskMessage = '正在处理…';
    }
    runWasActive = running;
    if (!running) taskMessage = '';
    ui.runStatus.hidden = !running;
    setNoticeText(ui.runCopy, taskMessage);
    ui.runCopy.title = taskMessage;

    // 写库失败单独保留。普通成功消息、配置写入和界面刷新都不能将它覆盖。
    if (latestStorageFailure && observedStorageError !== latestStorageFailure.version) {
      observedStorageError = latestStorageFailure.version;
      storageNotice = newNotice(latestStorageFailure.message, 'err');
      storageNotice.version = latestStorageFailure.version;
      pauseNoticeClock(statusNotice?.clock);
      statusNotice = null;
      statusExpanded = false;
    }
    const notice = storageNotice || statusNotice;
    ui.status.hidden = !notice;
    ui.status.className = 'st' + (notice ? ' ' + notice.kind : ' empty') + (statusExpanded ? ' expanded' : '');
    ui.status.setAttribute('role', notice?.kind === 'err' ? 'alert' : 'status');
    ui.status.setAttribute('aria-live', notice?.kind === 'err' ? 'assertive' : 'polite');
    setNoticeText(ui.statusCopy, notice?.message || '');
    ui.statusCopy.title = notice?.message || '';
    setNoticeText(ui.statusIcon, notice?.kind === 'ok' ? '✓' : notice?.kind === 'err' ? '!' : 'i');
    ui.statusExpand.hidden = !notice || (!statusExpanded && ui.statusCopy.scrollHeight <= ui.statusCopy.clientHeight + 1);
    ui.statusExpand.setAttribute('aria-expanded', String(statusExpanded));
    ui.statusExpand.setAttribute('aria-label', statusExpanded ? '收起完整提示' : '展开完整提示');
    ui.statusExpand.title = statusExpanded ? '收起完整提示' : '展开完整提示';
    ui.statusExpand.textContent = statusExpanded ? '−' : '…';
    syncNotificationClocks();
    fitNotificationLayout();
  }

  function say(msg, kind) {
    if (running && !kind) {
      taskMessage = msg || '正在处理…';
    } else {
      // 保存失败时不显示误导性的“成功”，错误通过独立通道呈现。
      if (kind === 'ok' && latestStorageFailure && latestStorageFailure.version > acknowledgedStorageError) {
        renderStatus(); return;
      }
      pauseNoticeClock(statusNotice?.clock);
      statusNotice = msg ? newNotice(String(msg), kind || 'info') : null;
      statusExpanded = false;
    }
    renderStatus();
  }

  function dismissStatus() {
    const notice = storageNotice || statusNotice;
    if (!notice) return;
    pauseNoticeClock(notice.clock);
    if (storageNotice) {
      acknowledgedStorageError = storageNotice.version;
      storageNotice = null;
    } else statusNotice = null;
    statusExpanded = false;
    renderStatus();
    const origin = notice.origin;
    const target = origin?.isConnected && !origin.disabled && origin.getClientRects().length
      ? origin : ui.root.querySelector('[data-tab].on');
    target?.focus({ preventScroll: true });
  }


  function initDrag(box) {
    let dragging = null;
    box.addEventListener('mousedown', e => {
      const grip = e.target.closest('.grip');
      if (!grip) return;
      dragging = grip.closest('.crow');
      if (!dragging) return;
      dragging.classList.add('drag');
      dragLock = true;
      e.preventDefault();
    });
    box.addEventListener('mousemove', e => {
      if (!dragging) return;
      const rows = [...box.querySelectorAll('.crow')].filter(r => r !== dragging);
      for (const r of rows) {
        const b = r.getBoundingClientRect();
        if (e.clientY > b.top && e.clientY < b.top + b.height / 2) { box.insertBefore(dragging, r); break; }
        if (e.clientY > b.top + b.height / 2 && e.clientY < b.bottom) { box.insertBefore(dragging, r.nextSibling); break; }
      }
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging.classList.remove('drag');
      dragging = null;
      const order = [...box.querySelectorAll('.crow')].map(r => r.dataset.col);
      cfg.patch({ order });
      setTimeout(() => { dragLock = false; refresh(); }, 0);
    });
  }

  function onColToggle(e) {
    const t = e.target;
    if (t.classList.contains('ck')) {
      const col = t.closest('.crow').dataset.col;
      const c = cfg.read();
      const off = c.off.slice();
      const i = off.indexOf(col);
      if (t.checked) { if (i >= 0) off.splice(i, 1); } else if (i < 0) off.push(col);
      cfg.patch({ off });
      refresh();
      return;
    }
    if (t.dataset && t.dataset.sum) {
      const c = cfg.read();
      const s = c.sum.slice();
      const i = s.indexOf(t.dataset.sum);
      if (t.checked) { if (i < 0) s.push(t.dataset.sum); } else if (i >= 0) s.splice(i, 1);
      cfg.patch({ sum: s });
      refresh();
      return;
    }
    if (t.dataset && t.dataset.dur) { cfg.patch({ durUnit: t.dataset.dur }); refresh(); return; }
    if (t.dataset && t.dataset.len) { cfg.patch({ lenUnit: t.dataset.len }); refresh(); }
  }

  function renderPresets() {
    const c = cfg.read();
    const names = presets.names();
    const dirty = presetDirty();
    ui.preset.innerHTML = `<option value="">（不用模板）</option>`
      + names.map(n => `<option value="${esc(n)}"${n === c.preset ? ' selected' : ''}>${esc(n)}${n === c.preset && dirty ? ' ·已改动' : ''}</option>`).join('');
    const has = !!c.preset && names.indexOf(c.preset) >= 0;
    ui.ovBtn.disabled = !has;
    ui.renBtn.disabled = !has;
    ui.delBtn.disabled = !has;
    ui.ovBtn.classList.toggle('hot', has && dirty);
  }

  function onPresetPick() {
    const name = ui.preset.value;
    if (!name) { cfg.patch({ preset: '' }); refresh(); return; }
    if (presets.apply(name)) { say(`用上模板「${name}」`, 'ok'); refresh(); }
  }

  function askName(tip, dflt) {
    const s = prompt(tip, dflt || '');
    if (s == null) return null;
    const t = s.trim();
    if (!t) { say('名字不能为空', 'err'); return null; }
    return t;
  }

  /* ---- 刷新整个面板 ---- */
  function refresh() {
    if (!ui || dragLock) return;
    const L = lib.read();
    const rows = L.rows;
    renderStatus();

    renderTemplateNotice();

    // 库
    if (rows.length) {
      ui.libBar.className = 'libbar';
      const oldest = rows[rows.length - 1];
      const pageTxt = L.total ? `，共 ${L.total} 条` : '';
      ui.libTxt.textContent = `库里 ${rows.length} 条${pageTxt} · 最早到 ${oldest.发布日期 || '?'}`
        + (L.donePages ? ` · 已覆盖 ${L.donePages} 页` : '');
    } else {
      ui.libBar.className = 'libbar empty';
      ui.libTxt.textContent = '视频库还是空的';
    }

    ui.count.textContent = String(rows.length);
    ui.count.title = ui.libTxt.textContent;
    ui.hint.textContent = MODE_HINT[mode];
    ui.modeBtns.forEach(b => {
      b.classList.toggle('on', b.dataset.mode === mode);
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    });
    ui.dateRow.style.display = mode === 'inc' ? 'none' : '';
    ui.goBtn.disabled = running || !tpl.ready;
    ui.goBtn.textContent = running ? '抓取中…' : '开始抓取';
    ui.checkBtn.disabled = running || !tpl.ready;
    ui.checkCopyBtn.disabled = !lastCheck;
    // 自检默认藏起来，常规使用用不上。抓挂过一次才把入口写显眼点。
    ui.diagBox.style.display = diagOpen ? '' : 'none';
    ui.diagLink.setAttribute('aria-expanded', String(diagOpen));
    ui.diagLink.textContent = diagOpen ? '收起自检'
      : (lastErr ? '抓不动了？点开自检查一下' : '自检…');
    ui.diagLink.className = (!diagOpen && lastErr) ? 'hot' : '';

    renderResume();
    const smp = sampleRow();
    renderCols(smp);
    ui.colsHint.textContent = smp
      ? `值取自 ${smp.发布日期 || '?'}《${String(smp.标题 || '无文案').slice(0, 14)}》`
        + `${num(smp.播放量) > 0 ? '' : '（这条也还没有数据）'}，只是让你看清效果。`
      : '库还是空的，先去「抓取」页抓一次。';
    renderPresets();
    renderTagFilter();
    renderRows();

    const sc = scopeRows();
    ui.copy.disabled = !sc.length;
    ui.csv.disabled = !sc.length;
    ui.copy.textContent = sc.length ? `复制 ${sc.length} 条` : '复制';
    ui.csv.textContent = sc.length ? `导出 CSV（${sc.length}）` : '导出 CSV';
    ui.scope.textContent = scopeLabel();
    ui.tagBtn.disabled = running || !sc.length;

    // 刷新选中：把要发几个请求先算出来告诉人，别让人蒙着点
    const refTargets = sel.size ? filtered().filter(r => sel.has(keyOf(r))) : [];
    ui.refBtn.disabled = running || !tpl.ready || !refTargets.length;
    ui.refBtn.textContent = refTargets.length ? `刷新选中 ${refTargets.length} 条` : '刷新选中';
    /* 落在「已连续覆盖」范围内的，页码能算准，就报准数；
     * 超出的要二分，事先算不出确切次数，只能给上界 —— 报个错的准数更糟。 */
    const totalPages = Math.max(1, Math.ceil((L.total || rows.length) / PAGE_SIZE));
    const verifiedRows = (L.donePages || 0) * PAGE_SIZE;
    const idxMap = new Map(rows.map((r, i) => [keyOf(r), i]));
    const inPrefix = refTargets.filter(r => (idxMap.get(keyOf(r)) ?? 1e9) < verifiedRows);
    const needSearch = refTargets.length - inPrefix.length;
    const exactPages = pagesForKeys(inPrefix.map(keyOf));
    const worst = Math.ceil(Math.log2(totalPages + 1)) + 1;
    ui.refHint.textContent = !refTargets.length
      ? '勾几条再点。接口只能按页拉，脚本会算出它们在第几页，只拉那几页。'
      : (needSearch === 0
        ? `要拉第 ${exactPages.join('、')} 页，${exactPages.length} 个请求`
          + (exactPages.length < refTargets.length ? '（同一页的合并成一个）' : '')
        : `${exactPages.length ? `第 ${exactPages.join('、')} 页直接拉；` : ''}`
          + `另外 ${needSearch} 条超出已覆盖范围，要按发布时间二分找，`
          + `每条最多 ${worst} 个请求（共 ${totalPages} 页）`);
    ui.refHint.title = ui.refHint.textContent;
    ui.delBtn2.disabled = running || !refTargets.length;
    ui.delBtn2.textContent = '删除选中';
    ui.delBtn2.title = refTargets.length ? `从本地库删除选中的 ${refTargets.length} 条，不影响视频号后台` : '先勾选要删除的视频';
    ui.root.querySelectorAll('[data-act="lib-clear"]').forEach(b => { b.disabled = running; });

  }

  /**
   * 列设置里拿哪一条当样例。
   * 不能直接用最新一条 —— 刚发或定时待发的视频一个数字都没有，整列预览全是「（空）」，
   * 看着像脚本坏了。所以挑第一条真有数据的（播放量 > 0），挑不到再退回最新一条。
   */
  function sampleRow() {
    const rows = lib.read().rows;
    if (!rows.length) return null;
    const metrics = EXPORT_SCHEMA.filter(c => c.num).map(c => c.from)
      .concat(['_avgPlaySec', '_fullPlayRate', '_fastFlipRate']);
    const good = rows.find(r => num(r.播放量) > 0)
      || rows.find(r => metrics.some(field => num(r[field]) > 0));
    return good || rows[0];
  }

  function renderCols(sample) {
    const list = orderedSchema();
    ui.onCount.textContent = String(list.filter(x => x.on).length);
    const allOn = list.every(x => x.on);
    ui.allBtn.textContent = allOn ? '全不选' : '全选';

    ui.cols.innerHTML = list.map(({ c, on }) => {
      let v = '';
      let miss = false;
      if (sample) {
        try { v = cellOf(sample, c); } catch (e) { v = ''; }
        if (v === '') { v = '（空）'; miss = true; }
      } else { v = '（库是空的）'; miss = true; }

      const isSum = c.col === '互动量';
      const isDur = c.col === '平均播放时长';
      const isLen = c.col === '视频时长';
      let chip = '';
      if (isSum) chip = `<button class="chip" data-act="sum-toggle">口径</button>`;
      if (isDur) chip = `<button class="chip" data-act="dur-toggle">${esc(durUnit())}</button>`;
      if (isLen) chip = `<button class="chip" data-act="len-toggle">${esc(lenUnit())}</button>`;

      let sub = '';
      if (isSum && sumOpen === true) {
        const picked = cfg.read().sum;
        const opts = EXPORT_SCHEMA.filter(x => x.sumable);
        sub = `<div class="sub"><div class="h">互动量算哪几项</div><div class="ops">`
          + opts.map(o => `<label><input type="checkbox" data-sum="${esc(o.col)}"`
            + `${picked.indexOf(o.col) >= 0 ? ' checked' : ''}>${esc(o.col)}</label>`).join('')
          + `</div><div class="eq">互动量 = ${esc(sumCols().join(' + ')) || '（没选，恒为 0）'}</div></div>`;
      }
      // 两个时长各有各的单位：视频时长常看 mm:ss，平均播放时长要秒的小数精度
      if (isDur && sumOpen === 'dur') {
        sub = `<div class="sub"><div class="h">平均播放时长的单位</div><div class="ops">`
          + DUR_UNITS.map(u => `<label><input type="radio" name="du" data-dur="${esc(u)}"`
            + `${durUnit() === u ? ' checked' : ''}>${esc(u)}</label>`).join('')
          + `</div><div class="eq">现在会写成：${esc(fmtDur(74.5, durUnit()))}</div></div>`;
      }
      if (isLen && sumOpen === 'len') {
        sub = `<div class="sub"><div class="h">视频时长的单位</div><div class="ops">`
          + DUR_UNITS.map(u => `<label><input type="radio" name="lu" data-len="${esc(u)}"`
            + `${lenUnit() === u ? ' checked' : ''}>${esc(u)}</label>`).join('')
          + `</div><div class="eq">现在会写成：${esc(fmtDur(74, lenUnit()))}`
          + `　（mm:ss / hh:mm:ss 粘进 Excel 会被认成时间，可以直接求平均）</div></div>`;
      }

      return `<div class="crow${c.calc ? ' calc' : ''}${on ? '' : ' off'}" data-col="${esc(c.col)}">`
        + `<span class="grip">⠿</span>`
        + `<input type="checkbox" class="ck"${on ? ' checked' : ''}>`
        + `<span class="cn">${esc(headerName(c))}${c.calc ? '<span class="tag">算</span>' : ''}</span>`
        + `<span class="cv${miss ? ' miss' : ''}">${esc(v)}</span>${chip}</div>${sub}`;
    }).join('');
  }

  /* ---- 视频列表：筛选 / 选中 / 范围 ---- */
  function filtered() {
    const rows = lib.read().rows;
    const q = (ui.q.value || '').trim().toLowerCase();
    const tag = ui.tagF.value || '';
    const st = ui.stF.value || '';
    return rows.filter(r => {
      if (q && String(r.文案 || '').toLowerCase().indexOf(q) < 0
        && String(r.标题 || '').toLowerCase().indexOf(q) < 0) return false;
      if (tag && (r._tags || []).indexOf(tag) < 0) return false;
      if (st === 'live' && r.状态 !== '已发布') return false;
      if (st === 'wait' && r.状态 !== '定时待发') return false;
      if (st === 'bad' && r.状态 !== '受限/已下架') return false;
      return true;
    });
  }

  const isFiltering = () =>
    !!((ui.q.value || '').trim() || ui.tagF.value || ui.stF.value);

  function scopeRows() {
    const f = filtered();
    if (sel.size) return f.filter(r => sel.has(keyOf(r)));
    return f;
  }

  function scopeLabel() {
    const n = scopeRows().length;
    if (!n) return '没有可导出的行';
    if (sel.size) return `范围：勾选的 ${n} 条`;
    if (isFiltering()) return `范围：筛选结果 ${n} 条`;
    return `范围：全库 ${n} 条`;
  }

  function renderTagFilter() {
    const cur = ui.tagF.value;
    const tags = lib.allTags();
    ui.tagF.innerHTML = `<option value="">标签不限</option>`
      + tags.map(t => `<option value="${esc(t)}"${t === cur ? ' selected' : ''}>${esc(t)}</option>`).join('');
  }

  function renderRows() {
    const f = filtered();
    const shown = f.slice(0, previewCount);
    const visibleSelected = f.filter(r => sel.has(keyOf(r))).length;
    ui.selInfo.textContent = sel.size
      ? `已选 ${visibleSelected} 条` + (sel.size > visibleSelected ? ` · 筛选外 ${sel.size - visibleSelected} 条` : '')
      : (isFiltering() ? `筛出 ${f.length} 条` : `共 ${f.length} 条`);
    ui.selInfo.title = sel.size > visibleSelected ? '本次操作只包含当前筛选范围内的勾选；清空选择可移除全部勾选。' : '';

    ui.list.innerHTML = shown.map(r => {
      const k = keyOf(r);
      const flag = r.状态 === '定时待发' ? '<span class="flag wait">待发</span>'
        : (r.状态 === '受限/已下架' ? '<span class="flag bad">受限</span>' : '');
      const tags = (r._tags || []).length
        ? `<span class="tags">${esc((r._tags || []).join(' '))}</span>` : '';
      return `<div class="it${fresh.has(k) ? ' new' : ''}${sel.has(k) ? ' sel' : ''}">`
        + `<input type="checkbox" class="rk" data-k="${esc(k)}" aria-label="选择 ${esc(r.标题 || '无文案视频')}"${sel.has(k) ? ' checked' : ''}>`
        + `<div class="it-content"><span class="t" title="${esc(r.文案 || r.标题 || '')}">${esc(r.标题 || '（无文案）')}</span>`
        + `<div class="it-meta"><span class="d">${esc(r.发布日期 || '')}</span>${tags}${flag}</div></div>`
        + `<span class="it-metric">${esc(r.播放量 || '0')}<small>播放</small></span></div>`;
    }).join('') || (lib.read().rows.length
      ? '<div class="more"><b>没有符合条件的视频</b>试试其他文案、标签或状态</div>'
      : '<div class="more"><b>还没有视频数据</b>打开「内容管理」，在「抓取」页开始获取</div>');

    if (f.length > shown.length) {
      ui.list.insertAdjacentHTML('beforeend',
        `<div class="more"><button type="button" data-act="rows-more">加载更多（还有 ${f.length - shown.length} 条）</button></div>`);
    }
  }

  function onRowCheck(e) {
    const t = e.target;
    if (!t.classList.contains('rk')) return;
    const k = t.dataset.k;
    if (t.checked) sel.add(k); else sel.delete(k);
    refresh();
  }

  function renderDiag(r) {
    ui.diag.innerHTML = r.steps.map(s =>
      `<div class="r ${s.ok ? 'ok' : 'no'}"><span class="n">${s.ok ? '✓' : '✗'}</span>`
      + `<span>${esc(s.name)} —— ${esc(s.verdict)}</span></div>`
    ).join('')
      + `<pre>${esc(r.shape)}</pre>`
      + `<div class="cc">点「复制自检结果」把这些发给 Claude</div>`;
  }

  function checkReport(r) {
    return ['=== 视频号抓取脚本自检 ===',
      `时间：${new Date().toLocaleString('zh-CN')}`,
      `页面：${location.pathname}`,
      ''].concat(
      r.steps.map(s => `${s.ok ? '✓' : '✗'} ${s.name} —— ${s.verdict}`),
      ['', r.shape]).join('\n');
  }

  function renderResume() {
    const p = progress.read();
    if (!p || running) { ui.resume.style.display = 'none'; return; }
    ui.resume.style.display = '';
    const when = p.at ? new Date(p.at).toLocaleString('zh-CN') : '?';
    ui.resumeTxt.textContent = `上次没抓完：${p.rows.length} 条，停在第 ${p.page} 页（${when}）`;
  }

  function cutoffTs() {
    if (mode === 'inc') return 0;
    const v = ui.since.value;
    if (!v) return 0;
    const d = new Date(v + 'T00:00:00');
    return isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / 1000);
  }

  /** 这几条视频分别在第几页（去重、排序）。面板靠它提前告诉人要发几个请求 */
  function pagesForKeys(keys) {
    const all = lib.read().rows;
    const idx = new Map(all.map((r, i) => [keyOf(r), i]));
    const pages = [];
    for (const k of keys) {
      if (!idx.has(k)) continue;
      const p = Math.floor(idx.get(k) / PAGE_SIZE) + 1;
      if (pages.indexOf(p) < 0) pages.push(p);
    }
    return pages.sort((a, b) => a - b);
  }

  function planFor(m) {
    const L = lib.read();
    if (m === 'older') return { startPage: (L.donePages || 0) + 1 };
    return { startPage: 1 };
  }

  /* ==========================================================================
   * 10. 交互
   * ========================================================================== */
  async function onClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const act = btn.dataset.act;
    const tab = btn.dataset.tab;
    const md = btn.dataset.mode;
    const days = btn.dataset.days;

    if (tab) { selectTab(tab); return; }
    if (md) { mode = md; refresh(); return; }
    if (days != null) {
      const n = Number(days);
      if (!n) ui.since.value = '';
      else {
        const d = new Date();
        d.setDate(d.getDate() - n);
        ui.since.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
      return;
    }

    switch (act) {
      case 'home':
        homePanel(ui.root.querySelector('.wrap'));
        say('回到右下角了（双击标题栏也一样）', 'ok');
        return;
      case 'toggle': togglePanel(); return;
      case 'tpl-dismiss':
        templateNotice.dismissed = true;
        pauseNoticeClock(templateNotice.clock);
        renderTemplateNotice();
        (ui.goBtn.disabled ? ui.root.querySelector('[data-tab].on') : ui.goBtn).focus({ preventScroll: true });
        return;
      case 'status-dismiss': dismissStatus(); return;
      case 'status-expand':
        statusExpanded = !statusExpanded;
        renderStatus();
        return;
      case 'rows-more': {
        const top = ui.list.scrollTop;
        const firstNew = previewCount;
        previewCount += PREVIEW_LIMIT;
        renderRows();
        ui.list.scrollTop = top;
        ui.list.querySelectorAll('.rk')[firstNew]?.focus({ preventScroll: true });
        return;
      }
      case 'close':
        if (running) { say('抓取中，先等它停下来', 'err'); return; }
        ui.disposeNotices?.();
        ui.disposeDrag?.();
        ui.host.remove(); ui = null;
        return;

      case 'lib-clear':
        if (running) { say('抓取中，不能清库', 'err'); return; }
        if (!confirm('清空本地视频库？所有本地视频记录、标签和未完成抓取进度都会删除，不影响视频号后台。')) return;
        lib.clear(); progress.clear(); sel.clear(); fresh.clear();
        mode = 'all';
        say('库清空了', 'ok'); refresh();
        return;

      case 'diag-toggle': diagOpen = !diagOpen; refresh(); return;
      case 'sum-toggle': sumOpen = (sumOpen === true) ? false : true; refresh(); return;
      case 'dur-toggle': sumOpen = (sumOpen === 'dur') ? false : 'dur'; refresh(); return;
      case 'len-toggle': sumOpen = (sumOpen === 'len') ? false : 'len'; refresh(); return;

      case 'col-all': {
        const list = orderedSchema();
        cfg.patch({ off: list.every(x => x.on) ? EXPORT_SCHEMA.map(c => c.col) : [] });
        refresh(); return;
      }
      case 'col-reset': cfg.reset(); say('列设置恢复默认', 'ok'); refresh(); return;

      case 'preset-saveas': {
        const n = askName('模板叫什么名字？');
        if (!n) return;
        if (presets.names().indexOf(n) >= 0 && !confirm(`「${n}」已存在，覆盖它？`)) return;
        presets.save(n); cfg.patch({ preset: n });
        say(`存成模板「${n}」`, 'ok'); refresh(); return;
      }
      case 'preset-overwrite': {
        const n = cfg.read().preset;
        if (!n) return;
        presets.save(n); say(`「${n}」已更新`, 'ok'); refresh(); return;
      }
      case 'preset-rename': {
        const old = cfg.read().preset;
        if (!old) return;
        const n = askName('改成什么名字？', old);
        if (!n || n === old) return;
        if (presets.names().indexOf(n) >= 0) { say('这个名字已经有了', 'err'); return; }
        presets.rename(old, n); cfg.patch({ preset: n });
        say(`改名成「${n}」`, 'ok'); refresh(); return;
      }
      case 'preset-del': {
        const n = cfg.read().preset;
        if (!n || !confirm(`删掉模板「${n}」？`)) return;
        presets.remove(n); cfg.patch({ preset: '' });
        say(`删了「${n}」`, 'ok'); refresh(); return;
      }

      case 'sel-all': filtered().forEach(r => sel.add(keyOf(r))); refresh(); return;
      case 'sel-none': sel.clear(); refresh(); return;
      case 'sel-inv': {
        const f = filtered();
        const next = new Set();
        f.forEach(r => { const k = keyOf(r); if (!sel.has(k)) next.add(k); });
        sel = next; refresh(); return;
      }

      case 'del-sel': {
        if (running) { say('抓取中，先等它停下来', 'err'); return; }
        const target = filtered().filter(r => sel.has(keyOf(r)));
        if (!target.length) { say('先勾几条', 'err'); return; }
        const waits = target.filter(r => r.状态 !== '已发布').length;
        if (!confirm(
          `从本地库删掉 ${target.length} 条？\n\n`
          + `· 只删本地这份表，不会动视频号那边的任何东西\n`
          + `· 它们在视频号还在的话，下次「增量更新」会照样抓回来\n`
          + `  —— 想让某类视频不进导出，用上面的「状态」筛选更省事\n`
          + (waits ? `\n\n这批里有 ${waits} 条不是「已发布」状态。` : ''))) return;
        const n = lib.remove(target.map(keyOf));
        sel.clear();
        say(`删掉 ${n} 条 —— 注意「增量更新」会把还在视频号那边的抓回来`, 'ok');
        refresh();
        return;
      }

      case 'tag-sel': {
        const target = sel.size ? filtered().filter(r => sel.has(keyOf(r))) : filtered();
        if (!target.length) { say('没有要打标签的行', 'err'); return; }
        const s = prompt(
          `给 ${target.length} 条视频改标签。\n`
          + '逗号分隔；前面加减号表示移除，如 -旧标签；输入 -* 清空全部标签。',
          '');
        if (s == null) return;
        const add = [], del = [];
        for (const raw of s.split(/[,，]/)) {
          const t = raw.trim();
          if (!t) continue;
          if (t[0] === '-') del.push(t.slice(1).trim() || '*'); else add.push(t);
        }
        if (!add.length && !del.length) { say('没解析出标签', 'err'); return; }
        const n = lib.tag(target.map(keyOf), add, del);
        say(`${n} 条视频的标签更新了`, 'ok'); refresh(); return;
      }

      case 'refresh-sel': {
        if (running) { aborted = true; say('正在停…'); return; }
        if (!tpl.ready) { say('还没抄到模板，先打开「内容管理」', 'err'); return; }
        const target = filtered().filter(r => sel.has(keyOf(r)));
        if (!target.length) { say('先勾几条', 'err'); return; }

        running = true; aborted = false; refresh();
        try {
          const r = await refreshKeys(target.map(keyOf), (hit, want, reqs, tip) => {
            say(`刷新中：${hit}/${want} 条已对上，发了 ${reqs} 个请求${tip ? ' · ' + tip : ''}`);
          });
          let msg = `刷新完：${r.hit}/${r.want} 条，${r.reqs} 个请求`
            + `（拉了第 ${r.pages.join('、')} 页）`
            + `，顺带更新了 ${r.merged.updated} 条`;
          if (r.miss.length) {
            // 不假装刷新成功了
            const names = r.miss.map(k => {
              const row = lib.read().rows.find(x => keyOf(x) === k);
              return row ? String(row.标题 || k).slice(0, 10) : k.slice(0, 10);
            });
            msg += ` · ${r.miss.length} 条没找到（${names.slice(0, 3).join('、')}`
              + `${names.length > 3 ? '…' : ''}）—— 多半是它已经在视频号那边被删了，`
              + `或者刚被置顶挪了位置`;
          }
          say(msg, r.miss.length ? 'err' : 'ok');
        } catch (err) {
          lastErr = true;
          say((err && err.message) || String(err), 'err');
        } finally {
          running = false; refresh();
        }
        return;
      }

      case 'copy': {
        const rows = scopeRows();
        if (!rows.length) return;
        const copied = copyText(toTSV(rows));
        say(copied ? `复制了 ${rows.length} 条，直接粘到表格里` : '复制失败，用「导出 CSV」', copied ? 'ok' : 'err');
        return;
      }
      case 'csv': {
        const rows = scopeRows();
        if (!rows.length) return;
        const d = new Date();
        download(`视频号数据_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`,
          toCSV(rows), 'text/csv');
        say(`导出了 ${rows.length} 条`, 'ok');
        return;
      }

      case 'drop': progress.clear(); say('丢弃了上次的进度', 'ok'); refresh(); return;

      case 'check': {
        if (running) { say('抓取中，等它停下来再自检', 'err'); return; }
        if (!tpl.ready) { say('还没抄到模板，先打开「内容管理」', 'err'); return; }
        running = true; refresh();
        ui.diag.innerHTML = '';
        try {
          const r = await selfCheck(msg => say(msg));
          lastCheck = r;
          renderDiag(r);
          const firstBad = r.steps.findIndex(s => !s.ok);
          if (firstBad < 0) { lastErr = false; say('五步全通 —— 那问题多半是间歇性的，再抓一次试试', 'ok'); }
          else if (firstBad === 0) say('连原样重放都不通 —— 问题在通道或请求头，不是我改的参数', 'err');
          else say(`前 ${firstBad} 步通、第 ${firstBad + 1} 步挂 —— 就是这一步引入的改动有问题`, 'err');
        } catch (err) {
          say('自检本身出错了：' + ((err && err.message) || err), 'err');
        } finally {
          running = false; refresh();
        }
        return;
      }
      case 'check-copy': {
        if (!lastCheck) return;
        const copied = copyText(checkReport(lastCheck));
        say(copied ? '自检结果已复制' : '复制失败', copied ? 'ok' : 'err');
        return;
      }

      case 'resume':
      case 'go': {
        if (running) { aborted = true; say('正在停…'); return; }
        const resume = act === 'resume' ? progress.read() : null;
        if (act === 'resume' && !resume) { say('没有可续的进度', 'err'); refresh(); return; }
        if (act === 'go' && progress.read()
          && !confirm('上次还有没抓完的进度，重新开始会丢掉它。继续？')) return;
        if (act === 'go') progress.clear();

        const useMode = resume ? resume.mode : mode;
        const plan = planFor(useMode);
        running = true; aborted = false; fresh.clear();
        refresh();

        try {
          const r = await crawl({
            mode: useMode,
            startPage: plan.startPage,
            cutoffTs: resume ? (resume.cutoffTs || 0) : cutoffTs(),
            resume,
          }, (n, stat, tip) => {
            say(`第 ${stat.pages} 页 · 拿到 ${n} 条`
              + (stat.total ? ` / 共 ${stat.total}` : '')
              + (tip ? ' · ' + tip : ''));
          });

          const before = lib.keys();
          const donePages = (useMode === 'inc' && r.reason === 'caught-up')
            ? null                       // 增量没翻到底，覆盖进度不该往前推
            : r.contiguous;
          const res = lib.merge(r.rows, donePages, r.stat.total);
          r.rows.forEach(x => { if (!before.has(keyOf(x))) fresh.add(keyOf(x)); });

          const why = {
            'caught-up': '已追平最新',
            cutoff: '到了指定日期',
            end: '翻到底了',
            stopped: '手动停了',
          }[r.reason] || '结束';
          say(`${why}：新增 ${res.added} 条，更新 ${res.updated} 条，库里共 ${res.total} 条`
            // 中间夹着范围外的页时说清楚，别让人以为漏抓了
            + (r.dryTotal > 1 ? ` · 途中跨过 ${r.dryTotal} 页整页在下限之外的内容`
              + `（列表不是严格按日期排的，所以没提前收工）` : ''), 'ok');
        } catch (err) {
          lastErr = true;                 // 挂过一次，自检入口就写显眼点
          say((err && err.message) || String(err), 'err');
        } finally {
          running = false;
          refresh();
        }
        return;
      }
    }
  }

  /* ==========================================================================
   * 11. 起
   * ========================================================================== */
  function start() { if (document.body && !document.getElementById(PANEL_ID)) build(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
  // SPA 会重建 body，面板被抹掉就补回来；同时把模板状态刷新到面板上
  setInterval(() => {
    if (!document.getElementById(PANEL_ID)) {
      ui?.disposeNotices?.(); ui?.disposeDrag?.(); ui = null; start();
    }
    else if (ui && !running && !dragLock) {
      const wantTxt = tpl.ready ? 'ok' : 'no';
      if (ui.tpl.className.indexOf(wantTxt) < 0) refresh();
    }
  }, 1500);
})();
