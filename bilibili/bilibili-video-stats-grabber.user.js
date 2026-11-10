// ==UserScript==
// @name         B站稿件数据采集
// @namespace    https://github.com/malafeiniao/bili-stats-grabber
// @version      6.5.7
// @icon         data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-labelledby%3D%22bili-icon-title%22%3E%0A%20%20%3Ctitle%20id%3D%22bili-icon-title%22%3EB%E7%AB%99%E7%A8%BF%E4%BB%B6%E6%95%B0%E6%8D%AE%E9%87%87%E9%9B%86%3C%2Ftitle%3E%0A%20%20%3Cdefs%3E%3ClinearGradient%20id%3D%22bili-icon-bg%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23FFFFFF%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23E1F5FC%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%0A%20%20%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2262%22%20height%3D%2262%22%20rx%3D%2221%22%20fill%3D%22url%28%23bili-icon-bg%29%22%20stroke%3D%22%23B8E3F1%22%2F%3E%0A%20%20%3Cpath%20transform%3D%22translate%2812%2012%29%20scale%281.666666667%29%22%20fill%3D%22%2300A1D6%22%20d%3D%22M17.813%204.653h.854c1.51.054%202.769.578%203.773%201.574%201.004.995%201.524%202.249%201.56%203.76v7.36c-.036%201.51-.556%202.769-1.56%203.773s-2.262%201.524-3.773%201.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036%2018.858%200%2017.347v-7.36c.036-1.511.556-2.765%201.56-3.76%201.004-.996%202.262-1.52%203.773-1.574h.774l-1.174-1.12a1.234%201.234%200%200%201-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347%200%20.653.124.92.373L9.653%204.44c.071.071.134.142.187.213h4.267a.836.836%200%200%201%20.16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347%200%20.662.151.929.4.267.249.391.551.391.907%200%20.355-.124.657-.373.906zM5.333%207.24c-.746.018-1.373.276-1.88.773-.506.498-.769%201.13-.786%201.894v7.52c.017.764.28%201.395.786%201.893.507.498%201.134.756%201.88.773h13.334c.746-.017%201.373-.275%201.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8%2011.107c.373%200%20.684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8%200c.373%200%20.684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z%22%2F%3E%0A%3C%2Fsvg%3E
// @description  B站创作中心稿件数据：双接口列表与按需详情、按UID隔离的本地库、可停止与续抓、完整备份和缺失稿件补回；搜索多标签、连续滚动与Shift选择、三级导出范围、列设置与模板。
// @author       malafeiniao
// @homepageURL  https://github.com/malafeiniao/social-media-userscripts
// @supportURL   https://github.com/malafeiniao/social-media-userscripts/issues
// @updateURL    https://raw.githubusercontent.com/malafeiniao/social-media-userscripts/main/bilibili/bilibili-video-stats-grabber.user.js
// @downloadURL  https://raw.githubusercontent.com/malafeiniao/social-media-userscripts/main/bilibili/bilibili-video-stats-grabber.user.js
// @match        https://member.bilibili.com/*
// @run-at       document-idle
// @grant        GM_setClipboardText
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @noframes
// ==/UserScript==

/* ============================================================================
 * B站稿件数据采集 6.5.7
 * 主题色 #00A1D6，图标基于 images/bilibili.svg 内嵌；安装后不依赖外部图片。
 * 参考公众号 3.5.44：分区提示、详情速度、全部待补项连续获取。
 *
 * 使用：安装后刷新创作中心，核对面板显示的 UID。
 * 首次从 6.4.0 升级：点「认领旧库」，确认旧库归属；空库原样复制主库和断点。
 * 当前已有数据时补回缺稿、空字段并合并标签，保留当前非空数据和抓取进度。
 * 原始旧库及首次认领前保护副本保留；写入中断可重试，但不会覆盖中途修改的数据。
 * 主库和断点按 UID 隔离；账号不明时禁止采集写库。列设置与模板沿用旧设置。
 *
 * 抓列表：默认两个列表接口互补合并；关闭双接口后仅请求 archives，
 * 保留收藏/弹幕/投币/转发，少取完播率与涨粉。
 *   增量更新：各来源遇到已知 BV 后停止，当前页所有新 BV 都会保存。
 *   补抓更早：接着已覆盖页码翻；改变单双接口配置时从首页重建覆盖范围。
 *   刷新全部：从头翻页合并，不删除库内其他稿件。
 *   重新全抓：确认后暂存新列表，全部完成且保存成功才替换原库；中断可续。
 * 请求/存储失败保留恢复点；已抓完但未成功入库时可继续上次，免重新请求。
 *
 * 补详情：按 cid 请求 analyze/graph，缺 cid 时先用 BV 查询。
 * 勾选「同时补退粉和充电」会补尚未获取过的 overview；两组分别保存与记录状态。
 * 不限每批条数，随时停止后继续剩余项；接口未提供数值也如实记录，已有值保留。
 * 稿件页仅保留「获取实时数据」：固定处理点击时勾选的稿件，同时更新列表和全部详情指标。
 * 两来源分别查找目标，A 的有效核心指标跨页优先；每次重新查询 cid，不复用旧视频分 P。
 * 仅写回勾选行，逐项保存；不新增稿件、不改列表断点。合法零值和下降值均覆盖旧值。
 * 接口未提供的字段保留旧值并提示；实时程度仍取决于 B 站接口自身的统计更新。
 * 手动采集当前稿件保留 DOM 优先的兜底方式，响应回来时复核当前稿件与账号。
 * 补详情及获取实时数据共用三档速度：稳妥 5～8 秒 / 标准 2～5 秒 / 较快 1.5～3 秒。
 * 纯列表及手动采集仍间隔 1.5～4 秒；每 20 个实际请求长休息，30 秒请求超时。
 * 进度按发起页面保存，普通成功反馈自动消退；错误保留且长内容可展开。
 * 停止、切号、会话变化会中断后续请求；不以迟到响应写库。
 *
 * 稿件页：标题/日期/完整度/数值条件与标签条件按 AND 组合。
 * 多个命名标签按 OR 匹配，支持搜索；「无标签」独立互斥。
 * 稿件列表连续滚动，可浏览全部稿件；Shift 选择覆盖未渲染行，保留区间外勾选。
 * 复制/CSV 范围始终为：有勾选用勾选，否则用筛选，否则全库。
 *
 * 标题栏账号右侧图标「数据管理」：完整备份包含全库、未知字段、标签与未完成进度。
 * 导入先校验与预览，只补当前账号缺失的稿件；已有稿件和当前进度保持原样。
 * 恢复前保存保护副本，写后读回核验；损坏数据可另导出原始排查文件。
 *
 * B站口径沿用原版，不套用公众号的接口/字段/版本回退规则：
 *   · archive/index 优先有效 real_stat，缺失才退回 stat。
 *   · full_play_ratio 是万分数，除以100存为百分数。
 *   · 平均播放进度来自 graph.quit_info.avg_play_progress（秒），按第1P统计。
 *     不使用 overview.play_avg_duration 或 duration_info.avg_play_time。
 *   · 沿用原有 graph 未就绪判定：平均播放进度未返回有效正数时标记未提供，
 *     不以占位零覆盖旧进度和完播率；其他有效数值中的0正常保存。
 *   · 详情只补扩展指标，不覆盖列表的播放量/点赞/收藏等核心指标。
 *   · 缺失和非法数值不转成0、不覆盖旧值；抓取保留手工标签及未知字段。
 *
 * 本地回归入口：tests/README.md。测试使用模拟响应和隔离存储，不能代替真实后台验收。
 * ============================================================================ */

(function () {
  'use strict';

  /* ==========================================================================
   * 1. 节奏与开关
   * ========================================================================== */
  const PAGE_SIZE = 20;        // 列表接口每页条数（ps）
  // 节奏参数。写成 let 是为了让自动化测试能把它调到 0 —— 真跑的时候别改小。
  let DELAY_MIN = 1500;        // 请求间隔下限（随机，别改成固定值）
  let DELAY_MAX = 4000;
  let REST_EVERY = 20;         // 每这么多个请求歇一次长的
  let REST_MIN = 6000;
  let REST_MAX = 12000;
  const MAX_PAGES = 300;       // 保险丝
  const DETAIL_SPEEDS = Object.freeze({
    cautious: Object.freeze({ label: '谨慎', min: 5000, max: 8000, restMin: 12000, restMax: 20000 }),
    standard: Object.freeze({ label: '标准', min: 2000, max: 5000, restMin: 6000, restMax: 12000 }),
    quicker: Object.freeze({ label: '较快', min: 1500, max: 3000, restMin: 6000, restMax: 12000 }),
  });
  // 「补详情」用的是第几版接口。补过的行会记下这个号；号对不上的，
  // 在「还没补详情」里重新出现一次。6.0 补的行没有这个号 → 会被重新补。
  // 换接口来源时把它加一，别改别的地方。
  const DETAIL_V = 2;
  const OVERVIEW_V = 1;       // 退粉/充电独立记录，不能由播放分析完成状态推断
  const ROW_HEIGHT = 32;      // 与公众号稿件列表一致：定高行和连续虚拟滚动
  const ROW_OVERSCAN = 6;      // 视口上下各预渲染少量行

  // 6.2 起手动采集会自己问接口要平均播放进度，正常情况下用不着切标签，所以默认关着。
  // 打开 = 接口也拿不到时，再退回「自动切到播放分析、轮询页面」那条老路
  //（会动你的页面，采完停在那一页、不切回）。接口哪天彻底失效了才需要它。
  const AUTO_SWITCH_TAB = false;

  const PANEL_ID = 'bili-arc-panel';
  const LIB_KEY = 'bili_arc_lib_v1';
  const PROG_KEY = 'bili_arc_progress_v1';
  const CFG_KEY = 'bili_arc_cols_v1';
  const PRESET_KEY = 'bili_arc_presets_v1';
  const FILT_KEY = 'bili_arc_filter_v1';
  const UI_KEY = 'bili_arc_ui_v1';

  // 合并版（内容数据一站抓取 1.0/1.1）的库，迁移时从这里挑视频
  const MERGED_KEY = 'bili_content_lib_v1';
  // 更老的键，按可信度排：v6 是本谱系一直维护的，v5 是外来分支（标题去重、无链接，
  // 质量最差），v2 最老。没有可用的 6.x 旧库、且合并库里没有视频时才用。
  const LEGACY_ARC = ['bili_stat_rows_v6', 'bili_stat_rows_v3', 'bili_stat_rows_v5', 'bili_stat_rows_v2'];

  /* ==========================================================================
   * 2. 接口与页面（全部沿用实测确认过的，别按直觉改）
   * --------------------------------------------------------------------------
   * 稿件（视频）—— 以下全部来自 2026-08-25 的探针报告，是创作中心自己发的请求，
   * 不是猜的。报告原件在 B站探针与报告/ 下面。
   *
   * 列表 A  member.bilibili.com/x/web/data/archive/index
   *   参数 pn / ps / order=0 / scene=archive_compare / tmid= / t=<毫秒>
   *   → pager.{pn,ps,total}
   *     list[].{aid,bvid,title,cover,ctime,pubtime,duration}
   *     list[].stat 和 list[].real_stat 各一套 {play,fans,reply,full_play_ratio,vt,likes}
   *     ⚠ 实测 stat.play=568 而 real_stat.play=769，real_stat 才是活的
   *     ⚠ real_stat 里有些值是字符串（fans:"0"、full_play_ratio:"2995"），别当数字直接用
   *     ⚠ full_play_ratio 是万分数：2995 = 29.95%
   *
   * 列表 B  member.bilibili.com/x/web/archives
   *   参数 status=pubed / pn / ps / coop=1 / interactive=1
   *   → page.{pn,ps,count}
   *     arc_audits[].Archive.{aid,bvid,title,cover,duration,ptime,ctime,tag,desc,state_desc}
   *     arc_audits[].stat.{view,danmaku,reply,favorite,coin,share,like,dislike,vt,vv}
   *   B 有 弹幕/收藏/投币/转发，A 没有；A 有 完播率/涨粉，B 没有。所以默认两个都翻。
   *
   * 单条详情  member.bilibili.com/x/web/data/archive_diagnose/overview
   *   参数 bvid / tmid= / t=<毫秒>
   *   → stat.{play_avg_duration, total_duration, unfollow, elec, ...}
   *     只取列表拿不到的这四个；play/like/fav 那些不覆盖，列表已经给了更靠谱的。
   *     ⚠ 实测这个号 play_avg_duration=0，旁边 archive_diagnose/grey 说
   *       play_analysis_offline_data_ready=false —— 所以「补了但没数」是正常结果，
   *       脚本会如实标成「接口没给」，不会假装是 0，也不会每次重复去补。
   * ---------------------------------------------------------------------------
   *
   * 稿件分析页（DOM，手动采集用，接口版的兜底）
   *   数据区在一个同源 iframe 里，顶层文档没有 .archive-title，所以必须遍历 iframe
   *   .archive-title            标题
   *   .time                     「2026年7月21日 18:23」
   *   .real-time-play-number    播放量
   *   .cell.item-cell 里 .title/.value  点赞/收藏/评论/投币/弹幕/分享/涨粉
   *   .duration / .arc-comp-duration    时长（查询必须排除 .menu-wrapper，
   *                                     切换菜单里有 40 个 .duration，混进来就废了）
   *   「播放分析」标签下「内容节奏」区块里  平均播放进度 + 占总时长 X%
   * ========================================================================== */

  const API_ARC_A = 'https://member.bilibili.com/x/web/data/archive/index';
  const API_ARC_B = 'https://member.bilibili.com/x/web/archives';
  // 退粉 / 充电 / 总播放时长。⚠ 它的 play_avg_duration 恒为 0，不是平均播放进度
  const API_ARC_OVERVIEW = 'https://member.bilibili.com/x/web/data/archive_diagnose/overview';
  // 平均播放进度 / 完播率 / 同类完播率。⚠ 入参是 cid，不是 bvid
  const API_ARC_GRAPH = 'https://member.bilibili.com/x/web/data/v2/archive/analyze/graph';
  // 兜底拿 cid：列表里没带 videos 时，用 bvid 换一次，换到就存进库，不会问第二遍
  const API_ARC_VIEW = 'https://member.bilibili.com/x/web/data/v3/archive/view';

  // 手动采集要读这个页面的 DOM；批量抓走接口，在创作中心哪个页面都能跑
  const PAGE_ARC = /\/platform\/upload-manager\/article\/data/;
  const onArcPage = () => PAGE_ARC.test(location.pathname);

  /* ==========================================================================
   * 3. 列 schema
   * --------------------------------------------------------------------------
   * 一处声明，四处受益：导出表头、列设置面板、互动量的加数、数值条件的可选列。
   * 加一列数据只要在这儿加一行，筛选面板自动就能筛它。
   *
   * 字段含义：
   *   from      直接取 row[from]
   *   value     自己算显示值（字符串）
   *   num       是数字列（导出时去掉千分位）
   *   numValue  给数值条件筛选用的数值访问器；返回 null = 这行没有这个指标
   *   sumable   可以计入「互动量」
   *   detail    属于「扩展指标」（视频要切到播放分析、图文要补详情才有）
   *   only      只有这些类型才有（用来在列设置里标注，也用来给筛选提示）
   * ========================================================================== */

  const EXPORT_SCHEMA = [
    { col: '发布日期', from: '发布日期' },
    { col: '发布时间', from: '发布时间' },
    { col: '标题', from: '标题' },
    {
      col: '播放量',
      from: '播放量',
      num: true,
      numValue: r => (r.播放量 === '' || r.播放量 == null ? null : num(r.播放量)),
    },
    { col: '点赞', from: '点赞', num: true, sumable: true },
    { col: '收藏', from: '收藏', num: true, sumable: true },
    { col: '评论', from: '评论', num: true, sumable: true },
    { col: '投币', from: '投币', num: true, sumable: true },
    { col: '转发', from: '转发', num: true, sumable: true },
    { col: '弹幕', from: '弹幕', num: true, sumable: true },
    {
      col: '互动量',
      calc: true,
      value: r => String(sumValue(r)),
      numValue: r => sumValue(r),
    },
    {
      col: '互动率',
      calc: true,
      value: r => { const v = rate(r); return v == null ? '' : v.toFixed(2) + '%'; },
      numValue: r => rate(r),
    },
    { col: '涨粉', from: '涨粉', num: true },
    { col: '退粉', from: '退粉', num: true, detail: true },
    { col: '充电', from: '充电', num: true, detail: true },
    {
      // 秒存着，显示成什么样看「列设置」里的时长写法开关（8分53秒 / 08:53）。
      // 页面读不到时长时会用「平均播放进度 ÷ 占总时长%」倒推，倒推的加「（推算）」标记。
      col: '时长',
      value: r => (r._durSec ? showDur(r._durSec) + (r._durGuess ? '（推算）' : '') : ''),
      numValue: r => (r._durSec ? num(r._durSec) : null),
    },
    {
      // graph 只给第 1P 的曲线。多 P 稿件如实标出来，别让人拿一个 P 的数当整条的。
      col: '平均播放进度',
      detail: true,
      value: r => (r._progSec ? showDur(r._progSec) + (num(r._pCnt) > 1 ? '（第1P）' : '') : ''),
      numValue: r => (r._progSec ? num(r._progSec) : null),
    },
    {
      // 完播率有三个来源，按可信度排：
      //   _finishPct  full_play_ratio ÷100。抓列表就白拿一份，补详情时 graph 再给一份
      //               （graph 那份和平均播放进度同源、同一时刻，所以补详情会覆盖它）
      //   _progPct    播放分析页 DOM 上的「占总时长 X%」
      //   算出来的    平均播放进度 ÷ 时长（时长本身可能是推算的，所以排最后）
      col: '完播率',
      value: r => { const v = finishPct(r); return v == null ? '' : v.toFixed(2) + '%'; },
      numValue: r => finishPct(r),
    },
    {
      // graph 里的 full_play_ratio_avg：同类稿件的平均完播率，用来给自己的完播率找个尺子。
      // ⚠「同类」具体怎么划的接口没说，当参考值看，别当考核指标。
      // 和它同来源的 pass_peer（3898，看着像「超过同类 38.98%」）就没做成列 ——
      // 含义没确认的数不该进导出表，但它照样存进了库（_passPeer），确认了加一行就能用。
      col: '同类完播率',
      detail: true,
      value: r => (r._peerFinish === '' || r._peerFinish == null
        ? '' : num(r._peerFinish).toFixed(2) + '%'),
      numValue: r => (r._peerFinish === '' || r._peerFinish == null ? null : num(r._peerFinish)),
    },
    { col: '标签', value: r => (r._tags || []).join(' ') },
    { col: '链接', from: '链接' },
    { col: '数据时间', from: '数据时间' },   // 核心数据是什么时候采的
    { col: '详情时间', from: '详情时间' },   // 扩展指标是什么时候采的（两边分开记）
  ];

  const DEFAULT_SUM = ['点赞', '收藏', '评论', '投币', '转发'];
  // 退粉/充电默认关着，因为它们要多发一个请求。graph 白给的那几列不在这儿 ——
  // 老用户的列设置是存过的，新列一律排在最后、默认开着（见 orderedSchema），
  // 把新列写进这个名单只会让「新装的关着、升级上来的开着」，同一个列在两台机器上不一样。
  const DEFAULT_OFF = ['退粉', '充电'];

  // 会随时间变化、重抓到就覆盖的字段
  // ⚠ _cid / _pCnt 故意不在这儿：它们是稿件的固有属性，一条稿件的 cid 不会变，
  //   拿到一次就一直有效。放进来只会让第一次抓到 cid 被算成一次「数据更新」。
  const VOLATILE = ['标题', '播放量', '点赞', '收藏', '评论', '投币', '转发', '弹幕',
    '涨粉', '退粉', '充电', '_durSec', '_durGuess', '_progSec', '_progPct', '_finishPct',
    '_peerFinish', '_passPeer', '_totalWatch', '_progNA', '数据时间', '详情时间'];

  // 这两个只是时间戳，不算「数据变了」，否则每次抓都报一堆假的更新
  const TIME_KEYS = ['数据时间', '详情时间'];

  // 详情接口负责的那几个数字。列表接口也给其中几个，但都是近似值
  //（1 万以上只给「x.x万」），转发它根本不给。
  // 所以「近似的列表数据遇上已经补过详情的行」时，这一整组都不许覆盖 ——
  // 不是只挡列表给了的那几个：旧图文脚本当年就往转发里写过占位的 '0'，
  // 只挡一部分的话，哪天有人照那个写法加回来，精确值就被静默清成 0 了。
  const DETAIL_NUMS = ['播放量', '点赞', '收藏', '评论', '投币', '转发'];

  const SORTS = [
    { key: 'ts', label: '发布时间', of: r => r._ts || 0 },
    { key: 'dur', label: '时长', of: r => num(r._durSec) },
    { key: 'view', label: '播放量', of: r => num(r.播放量) },
    { key: 'engage', label: '互动量', of: r => sumValue(r) },
    { key: 'rate', label: '互动率', of: r => (rate(r) == null ? -1 : rate(r)) },
    { key: 'finish', label: '完播率', of: r => (finishPct(r) == null ? -1 : finishPct(r)) },
    { key: 'like', label: '点赞', of: r => num(r.点赞) },
  ];

  /* ==========================================================================
   * 4. 小工具
   * ========================================================================== */

  function num(v) {
    if (v == null || v === '') return 0;
    const n = parseFloat(String(v).replace(/,/g, '').replace(/[^\d.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  // 数字清洗：去逗号/空白，'-'/'--' 视为空，换算 万/亿（「1.2万」→「12000」）
  function cleanNum(s) {
    if (s == null) return '';
    s = String(s).replace(/[,\s]/g, '');
    if (s === '' || s === '-' || s === '--') return '';
    const m = s.match(/^(-?\d+(?:\.\d+)?)(万|亿)?$/);
    if (!m) return s;
    let v = parseFloat(m[1]);
    if (m[2] === '万') v *= 1e4;
    else if (m[2] === '亿') v *= 1e8;
    return String(Math.round(v));
  }

  const pad = n => String(n).padStart(2, '0');
  const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmtTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const stampNow = () => { const d = new Date(); return `${fmtDate(d)} ${fmtTime(d)}`; };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const cell = v => String(v == null ? '' : v);
  const esc = s => String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cut = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : (s || ''));

  // 「mm:ss」/「hh:mm:ss」→ 总秒数
  function durToSec(str) {
    const p = String(str).trim().split(':').map(x => parseInt(x, 10));
    if (p.some(isNaN)) return 0;
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    if (p.length === 2) return p[0] * 60 + p[1];
    return 0;
  }
  // 「X时Y分Z秒」/「X小时Y分Z秒」任意组合 → 总秒数。
  // 我们自己导出的是「时」，但「小」那个字也顺手认了：多认一个字不花什么，
  // 而不认的后果很难查 —— 正则会在「1小」处静默匹配空串、返回 0，不报错。
  function cnDurToSec(str) {
    const m = String(str).match(/(?:(\d+)\s*小?时)?(?:(\d+)\s*分)?(?:(\d+)\s*秒)?/);
    if (!m) return 0;
    return (parseInt(m[1] || 0, 10) * 3600) + (parseInt(m[2] || 0, 10) * 60) + parseInt(m[3] || 0, 10);
  }
  /**
   * 秒 → hh:mm:ss，三段全写、全补零：20 秒 → `00:00:20`，4830 秒 → `01:20:30`。
   * ⚠ 小时位必须补足，别改成 mm:ss ——「08:53」会被 Excel 读成 8 小时 53 分。
   *   这一种存在的意义就是「定宽 + Excel 认得的时间格式」，能直接排序、算差值；
   *   想要短的看中文那种去（`8分53秒`），两种各管一头，别让它俩都变成半吊子。
   *   6.3 一度把这儿改成了「没小时就不写」，那样两种写法就重复了，已经改回来。
   */
  function fmtDur(sec) {
    sec = Math.round(num(sec));
    if (!sec) return '';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  /**
   * 中文写法，格式是 [x时]x分x秒 —— 方括号那段没有小时就整段不出现：
   *   4830 秒 → 1时20分30秒
   *     20 秒 → 0分20秒      （不是「0时0分20秒」）
   * 分钟位反过来，始终留着（哪怕是 0）—— 一列扫下来「x分x秒」这段是对齐的。
   * ⚠ 是「时」不是「小时」，和 B 站页面上的写法一致。6.3.0 写成「小时」是错的。
   */
  function fmtDurCn(sec) {
    sec = Math.round(num(sec));
    if (!sec) return '';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + '时' : '') + m + '分' + s + '秒';
  }

  /**
   * 时长 / 平均播放进度的两种写法。标签是拿 4830 秒（1时20分30秒）真算出来的，
   * 不是手写的占位符 —— 手写的迟早和函数跑偏。
   * 顺序就是点击切换的顺序（cn → hms → cn）。
   */
  const DUR_FMTS = [
    { key: 'cn', fn: sec => fmtDurCn(sec), tip: '短、读着顺；Excel 只当它是文本，不会自作聪明' },
    { key: 'hms', fn: sec => fmtDur(sec), tip: '定宽，Excel 认得的时间格式，能直接排序算差值' },
  ];
  DUR_FMTS.forEach(f => { f.label = f.fn(4830); });
  // 时长 / 平均播放进度用哪种写法。存在 uiState 里，改了立刻重画，导出也跟着走。
  // ⚠ 缓存成模块变量而不是每次读 localStorage —— 这两列每渲染一行都要调一次，
  //   200 行就是 400 次读盘。
  let durFmt = 'cn';
  const durFmtAt = k => DUR_FMTS.find(f => f.key === k) || DUR_FMTS[0];
  const showDur = sec => durFmtAt(durFmt).fn(sec);
  // 点一下换下一种，转一圈回来。加第三种写法只要往 DUR_FMTS 里加一行
  const nextDurFmt = () => {
    const i = DUR_FMTS.findIndex(f => f.key === durFmt);
    return DUR_FMTS[(i + 1) % DUR_FMTS.length].key;
  };

  /** 「2026-07-21」+「18:23」→ 时间戳。日期列固定 YYYY-MM-DD，日期区间筛选靠字符串比较，
   *  改成别的格式（比如公众号那边的 YYYY/MM/DD）区间筛选会静默失效。 */
  function tsOf(d, t) {
    const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return 0;
    const tm = String(t || '').match(/^(\d{1,2}):(\d{2})/);
    return new Date(+m[1], +m[2] - 1, +m[3], tm ? +tm[1] : 0, tm ? +tm[2] : 0).getTime();
  }

  function splitTime(t) {
    const m = String(t || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/);
    if (!m) return { d: '', t: '', ts: 0 };
    const d = `${m[1]}-${pad(m[2])}-${pad(m[3])}`, tt = `${pad(m[4])}:${m[5]}`;
    return { d, t: tt, ts: tsOf(d, tt) };
  }

  /* ---- 派生数值。返回 null 表示「这行没有这个指标」，不是 0 ---- */

  function sumValue(row) {
    const picked = cfg.read().sum;
    let s = 0;
    for (const c of EXPORT_SCHEMA) {
      if (!c.sumable || picked.indexOf(c.col) < 0) continue;
      s += num(row[c.from]);
    }
    return s;
  }
  function sumCols() {
    const picked = cfg.read().sum;
    return EXPORT_SCHEMA.filter(c => c.sumable && picked.indexOf(c.col) >= 0).map(c => c.col);
  }
  function rate(row) {
    const v = num(row.播放量);
    if (!v) return null;
    return sumValue(row) / v * 100;
  }
  function finishPct(row) {
    if (row._finishPct !== '' && row._finishPct != null) return num(row._finishPct);
    if (row._progPct !== '' && row._progPct != null) return num(row._progPct);
    if (row._progSec && row._durSec) return num(row._progSec) / num(row._durSec) * 100;
    return null;
  }

  /**
   * 从接口响应里挑一个数出来。
   *   pick(o, 'play')            取 o.play
   *   pickLive(o, 'play')        优先 o.real_stat.play，取不到才 o.stat.play
   * 一律返回字符串（库里的数字列都是字符串），空/缺失返回 ''。
   * ⚠ real_stat 里 fans 是 "0"、full_play_ratio 是 "2995"，都是字符串；
   *   stat 里同名字段却是 number。所以只能按「有没有值」判断，不能按 typeof。
   */
  function numStr(v) {
    if (typeof v !== 'number' && typeof v !== 'string') return '';
    const s = String(v).trim();
    if (!/^-?\d+(?:\.\d+)?$/.test(s)) return '';
    const x = Number(s);
    return Number.isFinite(x) ? String(x) : '';
  }
  function pickLive(o, key) {
    const live = (o && o.real_stat) ? o.real_stat[key] : undefined;
    const s = numStr(live);
    if (s !== '') return s;
    return numStr((o && o.stat) ? o.stat[key] : undefined);
  }

  /* ==========================================================================
   * 5. 存储
   * ========================================================================== */
  function rawRead(key, dflt) {
    try {
      return (typeof GM_getValue === 'function')
        ? GM_getValue(key, dflt) : (localStorage.getItem(key) || dflt);
    } catch (e) { throw new Error('读取本地数据失败，请检查油猴存储权限；未使用空库覆盖。'); }
  }
  function rawWrite(key, val) {
    try {
      if (typeof GM_setValue === 'function') GM_setValue(key, val);
      else localStorage.setItem(key, val);
    } catch (e) { throw new Error('保存本地数据失败，可能空间不足；进度未标记完成。'); }
  }

  function requiredWrite(key, value) {
    rawWrite(key, value);
    if (rawRead(key, null) !== value) throw new Error('本地数据写入后核验失败，未标记成功。');
    return true;
  }

  function readStoredJson(key, fallback) {
    const raw = rawRead(key, '');
    if (raw === '' || raw == null) return fallback;
    try { return JSON.parse(raw); }
    catch (e) { throw new Error('本地数据格式损坏，请先导出原始数据排查；未覆盖原数据。'); }
  }

  function detectAccount() {
    const cookies = String(document.cookie || '');
    const id = (cookies.match(/(?:^|;\s*)DedeUserID=(\d+)(?:;|$)/) || [])[1] || '';
    const session = (cookies.match(/(?:^|;\s*)bili_jct=([^;]*)/) || [])[1] || '';
    return { id, name: id ? 'UID ' + id : '未识别登录账号', session };
  }
  let activeAccount = detectAccount();
  function accountContext() { return { ...activeAccount }; }
  function sameAccountContext(ctx) {
    const now = detectAccount();
    return !!ctx && !!ctx.id && ctx.id === now.id && ctx.session === now.session
      && ctx.id === activeAccount.id && ctx.session === activeAccount.session;
  }
  function requireAccount(ctx = accountContext()) {
    if (!ctx.id) throw new Error('未识别登录账号，请登录创作中心后刷新页面。');
    if (!sameAccountContext(ctx)) throw new Error('账号或登录会话已变化，请刷新后继续。');
    return ctx;
  }
  function scopedKey(base, ctx = accountContext()) {
    if (!ctx.id) throw new Error('未识别账号，不能读写稿件库。');
    return base + '::' + ctx.id;
  }
  function mergeFields(old, incoming) {
    const out = { ...old };
    for (const [k, value] of Object.entries(incoming)) {
      if (value === '' || value == null || (typeof value === 'number' && !Number.isFinite(value))) continue;
      if (k === '_tags' && Object.prototype.hasOwnProperty.call(old, '_tags')) continue;
      if (k === '_ts' && !value && old._ts) continue;
      out[k] = value;
    }
    return out;
  }

  /**
   * 一条稿件的唯一键：bv:BV1xx411c7mD。
   * 拿不到 BV 号时退到 tt:<归一化标题> —— 这是旧脚本「无链接按标题兜底合并」的
   * 等价物，但把它显式做成 ID 的一部分：勾选、标签、筛选就都能用同一个键，
   * 不必在每个地方各写一遍「有链接按链接、没链接按标题」的兜底分支。
   * ⚠ 前缀保持和合并版一致，这样从合并库迁移过来是原样搬，标签和已补标记全不丢。
   */
  function makeId(kind, val, title) {
    if (kind && val) return kind + ':' + val;
    const k = titleKey(title);
    return k ? 'tt:' + k : '';
  }

  /** 有没有哪个值真变了。只比较新数据里确实带了的字段 —— 列表抓来的行没有扩展字段，
   *  不能因为它「缺」就判成变了。 */
  function bumped(a, b) {
    return VOLATILE.some(k => TIME_KEYS.indexOf(k) < 0 && (k in b) && cell(a[k]) !== cell(b[k]));
  }

  /**
   * 稿件库。donePn 记「从最新往回已经连续覆盖到第几页」，
   * 「补抓更早」靠它知道从哪页接着请求，而不是从第 1 页重翻。
   * ⚠ 合并版存的是 {arc,opus} 对象，迁移时只取 .arc，见 migrate()。
   */
  const lib = {
    read() {
      if (!accountContext().id) return { rows: [], donePn: 0, at: 0 };
      const v = readStoredJson(scopedKey(LIB_KEY), { rows: [], donePn: 0, at: 0 });
      if (!v || !Array.isArray(v.rows) || v.rows.some(r => !r || typeof r !== 'object' || !r._id))
        throw new Error('稿件库结构损坏，已停止读写。');
      return { ...v, donePn: Number(v.donePn) || 0, at: v.at || 0 };
    },
    write(v) {
      const ctx = requireAccount();
      requiredWrite(scopedKey(LIB_KEY, ctx), JSON.stringify({
        ...v, donePn: Number(v.donePn) || 0, at: Date.now(),
      }));
    },
    clear() { requiredWrite(scopedKey(LIB_KEY, requireAccount()), ''); },

    /**
     * @param newRows  新内容（会新增）
     * @param donePn   覆盖进度，null = 不动
     * @param seenRows 顺路看到的，只刷新已有记录、不新增（页面已下载，白捡）
     * @param opts     { approx:true } 这批数字是近似的 —— 遇到库里已经补过精确值
     *                 （_detail=1）的行就不覆盖数字，只更新标题/日期这类结构性字段。
     *                 ⚠ 这是 B 站和公众号方向相反的那处：公众号防的是「旧盖新」，
     *                   B 站图文防的是「粗盖细」。两句话不一样，要防的事同构。
     */
    merge(newRows, donePn, seenRows, opts) {
      const approx = !!(opts && opts.approx);
      const cur = lib.read();
      const byId = new Map(cur.rows.map(r => [r._id, r]));
      let added = 0, updated = 0;

      const put = (r, allowAdd) => {
        const old = byId.get(r._id);
        if (!old) { if (allowAdd) { byId.set(r._id, r); added++; } return; }
        const inc = Object.assign({}, r);
        // 粗的不许盖细的：近似数字遇上已经补过详情的行，这一组整体跳过
        if (approx && old._detail) DETAIL_NUMS.forEach(k => { delete inc[k]; });
        // 空值也不许盖已有值。'' 在这套数据里一律是「不知道」而不是「就是空」——
        // 上游少读到一个字段，不该让库里已经有的那个值跟着消失。
        for (const k of Object.keys(inc)) {
          if ((inc[k] === '' || inc[k] == null) && cell(old[k]) !== '') delete inc[k];
        }
        if (bumped(old, inc)) updated++;
        byId.set(r._id, mergeFields(old, inc));
      };

      for (const r of newRows || []) put(r, true);
      for (const r of seenRows || []) put(r, false);

      const rows = [...byId.values()].sort((a, b) => (b._ts || 0) - (a._ts || 0));
      lib.write({ ...cur, rows, donePn: donePn == null ? cur.donePn : donePn });
      return { added, updated, total: rows.length };
    },

    /**
     * 写一条进库，返回合并后的整行。稿件手动采集走这条路。
     * 保险丝（从 5.7 搬过来的）：BV 号和已存记录撞了、但标题不一样 → BV 是从
     * 过期 URL 上读来的，丢掉链接改按标题存，绝不把错链接写进库。
     */
    upsert(partial) {
      const cur = lib.read();
      let id = partial._id;
      if (id && id.indexOf('bv:') === 0 && partial.标题) {
        const clash = cur.rows.some(r => r._id === id && r.标题 && r.标题 !== partial.标题);
        if (clash) {
          partial = Object.assign({}, partial, { 链接: '', _bv: '' });
          id = partial._id = makeId('', '', partial.标题);
        }
      }
      if (!id) return null;
      const i = cur.rows.findIndex(r => r._id === id);
      let row;
      if (i >= 0) {
        row = mergeFields(cur.rows[i], partial);
      } else {
        row = partial;
      }
      if (i >= 0) cur.rows[i] = row; else cur.rows.push(row);
      cur.rows.sort((a, b) => (b._ts || 0) - (a._ts || 0));
      lib.write(cur);
      return row;
    },

    /** 把扩展字段写回某一条 */
    patch(id, fields) {
      const cur = lib.read();
      const i = cur.rows.findIndex(r => r._id === id);
      if (i < 0) return false;
      cur.rows[i] = mergeFields(cur.rows[i], fields);
      lib.write(cur);
      return true;
    },

    remove(id) {
      const cur = lib.read();
      const n = cur.rows.length;
      cur.rows = cur.rows.filter(r => r._id !== id);
      lib.write(cur);
      return n !== cur.rows.length;
    },

    newestTs() {
      const rows = lib.read().rows;
      return rows.length ? Math.max.apply(null, rows.map(r => r._ts || 0)) : 0;
    },

    /** 还没补过详情的（含 6.0 用旧接口补过、但没拿到平均播放进度的那批） */
    pending(opts = {}) {
      return lib.read().rows.filter(r => r._bv && (!detailDone(r) || (opts.overview && !overviewDone(r))));
    },

    /** 其中有几条是「补过、但版本旧了」—— 面板要单独说一句，免得看着像凭空多出来的 */
    stale() {
      return lib.read().rows.filter(r => r._detail && !detailDone(r) && r._bv);
    },

    allTags() {
      const s = new Set();
      for (const r of lib.read().rows) for (const t of r._tags || []) s.add(t);
      return [...s].sort();
    },

    /**
     * 批量改标签。add / del 都是数组；del 里出现 '*' 表示清空该行。
     * 标签存在行上、不在 VOLATILE 里，所以重抓列表或刷新详情都不会把它冲掉。
     */
    tag(ids, add, del) {
      const cur = lib.read();
      const set = new Set(ids);
      let n = 0;
      for (const r of cur.rows) {
        if (!set.has(r._id)) continue;
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

  /* ==========================================================================
   * 6. 旧数据迁移
   * --------------------------------------------------------------------------
   * 两条来路，按新旧排：
   *   1) 合并版（内容数据一站抓取 1.0/1.1）的库 —— 里面的视频行和这边的格式
   *      完全一样（连 _id 前缀都一样），挑出来直接搬，标签和已补详情的标记全不丢，
   *      donePn 取它的 .arc。搬完等于原样接着用，一个请求都不用重发。
   *   2) 更老的「B站稿件数据采集 5.x」的键 —— 那会儿列名不一样
   *      （视频长度 / 投币量 / 弹幕量 / 涨粉数），要按下面这张表改名。
   * 用户确认归属后补回缺稿、空字段和标签；当前非空数据与进度优先，原始旧库不删。
   * ========================================================================== */

  const LEGACY_CLAIM_KEY = 'bili_arc_legacy_claim_v1';
  const LEGACY_SAFETY_KEY = 'bili_arc_legacy_safety_v1';
  function applyLegacyClaim(claim) {
    const ctx = requireAccount();
    if (!claim || typeof claim.library !== 'string' || typeof claim.pending !== 'string')
      throw new Error('旧库认领记录损坏，请先导出原始数据排查。');
    const libKey = scopedKey(LIB_KEY), progKey = scopedKey(PROG_KEY);
    const currentLib = rawRead(libKey, ''), currentProgress = rawRead(progKey, '');
    const beforeLib = typeof claim.beforeLibrary === 'string' ? claim.beforeLibrary : '';
    const beforeProgress = typeof claim.beforePending === 'string' ? claim.beforePending : '';
    if ((currentLib !== beforeLib && currentLib !== claim.library)
      || (currentProgress !== beforeProgress && currentProgress !== claim.pending))
      throw new Error('认领期间当前账号数据已变化，不能覆盖，请先备份排查。');
    // 先核验保护副本落盘，再改主库。重试时继续沿用第一次保存的副本。
    if (!rawRead(scopedKey(LEGACY_SAFETY_KEY), '')) {
      requiredWrite(scopedKey(LEGACY_SAFETY_KEY), JSON.stringify({
        format: 'bili-arc-legacy-safety', accountId: ctx.id, at: Date.now(),
        library: beforeLib, pending: beforeProgress,
        sourceLibrary: claim.sourceLibrary || claim.library,
        sourcePending: claim.sourcePending || '',
      }));
    }
    requireAccount(ctx);
    if (rawRead(libKey, '') !== currentLib || rawRead(progKey, '') !== currentProgress)
      throw new Error('认领期间当前账号数据已变化，不能覆盖，请先备份排查。');
    if (currentLib !== claim.library) requiredWrite(libKey, claim.library);
    requireAccount(ctx);
    if (rawRead(progKey, '') !== currentProgress)
      throw new Error('认领期间当前账号进度已变化，不能覆盖，请先备份排查。');
    if (currentProgress !== claim.pending) requiredWrite(progKey, claim.pending);
    requiredWrite(scopedKey(LEGACY_CLAIM_KEY), '');
    return claim.result;
  }
  function stageLegacyClaim(library, pending, result) {
    if (!library || !Array.isArray(library.rows) || library.rows.some(r => !r || typeof r._id !== 'string' || !r._id
      || (r._tags != null && (!Array.isArray(r._tags) || r._tags.some(t => typeof t !== 'string'))))
      || new Set(library.rows.map(r => r._id)).size !== library.rows.length)
      throw new Error('旧稿件库结构损坏，未认领。');
    const ctx = requireAccount();
    if ((library.acctId != null && String(library.acctId) !== ctx.id)
      || (pending && pending.acctId != null && String(pending.acctId) !== ctx.id))
      throw new Error('旧库或进度属于其他账号，未认领。');
    const beforeLibrary = rawRead(scopedKey(LIB_KEY), '');
    const beforePending = rawRead(scopedKey(PROG_KEY), '');
    const current = lib.read(), currentPending = progress.read();
    const merge = current.rows.length > 0 || !!currentPending;
    let next = library, added = library.rows.length, completed = 0;
    if (merge) {
      const byId = new Map(current.rows.map(r => [r._id, r]));
      if (byId.size !== current.rows.length) throw new Error('当前稿件 ID 重复，请先导出原始数据排查。');
      added = 0;
      const missing = value => value == null || value === '' || (typeof value === 'number' && !Number.isFinite(value));
      for (const old of library.rows) {
        const now = byId.get(old._id);
        if (!now) { byId.set(old._id, old); added++; continue; }
        const filled = { ...now };
        for (const [key, value] of Object.entries(old)) {
          if (key !== '_tags' && missing(filled[key]) && !missing(value)) filled[key] = value;
        }
        if (old._tags && old._tags.length) {
          if (now._tags != null && !Array.isArray(now._tags)) throw new Error('当前稿件标签结构损坏，未认领。');
          filled._tags = [...new Set([...(now._tags || []), ...old._tags])];
        }
        if (missing(now._progSec) && Number(filled._progSec) > 0) filled._progNA = 0;
        if (JSON.stringify(filled) !== JSON.stringify(now)) completed++;
        byId.set(old._id, filled);
      }
      next = { ...library, ...current, rows: [...byId.values()].sort((a, b) => (b._ts || 0) - (a._ts || 0)) };
      // 补回旧稿件不能把本次抓取的覆盖页码、断点或全抓暂存任务改成旧值。
    }
    const claim = {
      library: JSON.stringify(next), pending: merge ? beforePending : pending ? JSON.stringify(pending) : '',
      beforeLibrary, beforePending,
      sourceLibrary: JSON.stringify(library), sourcePending: pending ? JSON.stringify(pending) : '',
      result: { ...result, sourceTotal: library.rows.length, total: next.rows.length, added, completed,
        merged: merge, keptProgress: merge && !!currentPending },
    };
    requireAccount(ctx);
    if (rawRead(scopedKey(LIB_KEY), '') !== beforeLibrary || rawRead(scopedKey(PROG_KEY), '') !== beforePending)
      throw new Error('认领期间当前账号数据已变化，请重新认领。');
    requiredWrite(scopedKey(LEGACY_CLAIM_KEY), JSON.stringify(claim));
    return applyLegacyClaim(claim);
  }

  function readLegacyJson(key, source) {
    let raw;
    try { raw = source === 'local' ? localStorage.getItem(key) : rawRead(key, ''); }
    catch (error) { throw new Error('读取旧数据失败，未认领。'); }
    if (raw === '' || raw == null) return null;
    try { return typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw)); }
    catch (error) { throw new Error('旧数据 JSON 损坏，未认领。'); }
  }

  function readUnownedLegacy() {
    const sources = typeof GM_getValue === 'function' ? ['gm', 'local'] : ['local'];
    let empty = null;
    for (const source of sources) {
      const library = readLegacyJson(LIB_KEY, source);
      if (!library) continue;
      if (!Array.isArray(library.rows)) throw new Error('旧稿件库结构损坏。');
      const pending = readLegacyJson(PROG_KEY, source);
      if (pending && (!Array.isArray(pending.rows) || (pending.seen != null && !Array.isArray(pending.seen))))
        throw new Error('旧进度结构损坏。');
      const candidate = { library, pending, source };
      if (library.rows.length) return candidate;
      if (pending && !empty) empty = candidate;
    }
    return empty;
  }

  function migrate(confirmed = false) {
    if (!confirmed) return null;
    requireAccount();
    const pendingClaim = readStoredJson(scopedKey(LEGACY_CLAIM_KEY), null);
    if (pendingClaim) return applyLegacyClaim(pendingClaim);
    const unowned = readUnownedLegacy();
    if (unowned) {
      return stageLegacyClaim(unowned.library, unowned.pending,
        { from: 'unowned', storage: unowned.source, donePn: unowned.library.donePn || 0 });
    }

    const readJson = key => {
      let raw = rawRead(key, '');
      if (!raw) {
        try { raw = localStorage.getItem(key); }
        catch (e) { throw new Error('读取旧数据失败，未认领。'); }
      }
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { throw new Error('旧数据 JSON 损坏，未认领。'); }
    };

    /* ---- 1) 合并库里的视频 ---- */
    const merged = readJson(MERGED_KEY);
    if (merged && Array.isArray(merged.rows)) {
      const rows = merged.rows.filter(r => r && r._type === '视频');
      if (rows.length) {
        const donePn = (merged.donePn && typeof merged.donePn === 'object')
          ? (Number(merged.donePn.arc) || 0) : 0;
        return stageLegacyClaim({ rows: rows.sort((a, b) => (b._ts || 0) - (a._ts || 0)), donePn }, null, { total: rows.length, from: 'merged', donePn });
      }
    }

    /* ---- 2) 5.x 的老键 ---- */
    let old = [];
    for (const k of LEGACY_ARC) {
      const v = readJson(k);
      if (Array.isArray(v) && v.length) { old = v; break; }
    }
    if (!old.length) return null;

    const byId = new Map();
    for (const o of old) {
      const link = cell(o['视频链接']);
      const bv = (link.match(/BV[0-9A-Za-z]+/) || [])[0] || '';
      const d = cell(o['发布日期']), t = cell(o['发布时间']);
      const prog = cell(o['平均播放进度']);
      const durRaw = cell(o['视频长度']);
      const row = {
        _id: makeId(bv ? 'bv' : '', bv, o['标题']),
        _type: '视频',
        _bv: bv,
        _ts: tsOf(d, t),
        发布日期: d, 发布时间: t, 标题: cell(o['标题']), 链接: link,
        播放量: cleanNum(o['播放量']), 点赞: cleanNum(o['点赞']),
        收藏: cleanNum(o['收藏']), 评论: cleanNum(o['评论']),
        投币: cleanNum(o['投币量']), 转发: cleanNum(o['转发量']),
        弹幕: cleanNum(o['弹幕量']), 涨粉: cleanNum(o['涨粉数']),
        _durSec: durRaw ? String(durToSec(durRaw.replace('（推算）', ''))) : '',
        _durGuess: durRaw.indexOf('（推算）') >= 0 ? 1 : 0,
        _progSec: prog ? String(cnDurToSec(prog)) : '',
        _progPct: '',
        _detail: prog ? 1 : 0,
        _tags: [], _migrated: 1,
        数据时间: '', 详情时间: '',
      };
      if (row._id) byId.set(row._id, row);
    }
    if (!byId.size) return null;
    const out = [...byId.values()].sort((a, b) => (b._ts || 0) - (a._ts || 0));
    return stageLegacyClaim({ rows: out, donePn: 0 }, null, { total: out.length, from: 'legacy', donePn: 0 });
  }

  /* ==========================================================================
   * 7. 标签的 JSON 导入 / 导出
   * --------------------------------------------------------------------------
   * 认这几种写法，自动判断 key 是标题还是链接/号：
   *   {"稿件标题": ["技术","重点"], "BV1xx411c7mD": ["活动"]}
   *   {"标题": "专栏,重点"}                    值是字符串也行，按逗号拆
   *   [{"标题":"…","标签":["专栏"]}, {"链接":"…","tags":"活动"}]
   * 导出用数组那种写法：既好读好改，链接又能精确匹配回来。
   * ========================================================================== */

  /**
   * 链接归一化：认 BV 号、视频链接，以及库里的内部 ID 写法（bv:BV…）。
   * 输出就是内部 ID 的格式，所以标签导入时两边能直接对上。
   *
   * ⚠ 裸号必须整串匹配，URL 里的必须跟在 /video/ 后面 ——
   *   之前用的是「串里出现 BV+8 位就算」，那样一个叫「BVeryLongTitle…」的标题
   *   会被当成链接，于是既匹配不到、又不再走标题匹配，静默漏掉。
   *   裸 BV 卡死 10 位（B 站的实际格式），就是为了和标题划清界限；
   *   万一哪天格式变了，最坏结果是退回标题匹配、然后在预览里被报成「没匹配上」，
   *   是看得见的失败，不是静默的错配。
   */
  function linkKey(u) {
    const s = String(u == null ? '' : u).trim();
    const m = s.match(/^(?:bv:)?(BV[0-9A-Za-z]{10})$/i) || s.match(/\/video\/(BV[0-9A-Za-z]{8,})/);
    return m ? 'bv:' + m[1] : '';
  }
  const looksLikeLink = s => !!linkKey(s);

  /** 标题归一化：忽略空白和全角/半角标点差异，方便手打的标题也能对上 */
  function titleKey(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[\s　]+/g, '')
      .replace(/[｜]/g, '|').replace(/[，]/g, ',').replace(/[：]/g, ':')
      .replace(/[！]/g, '!').replace(/[？]/g, '?')
      .replace(/[“”„]/g, '"').replace(/[‘’]/g, "'")
      .replace(/[（]/g, '(').replace(/[）]/g, ')')
      .trim();
  }

  function parseTagJson(text) {
    let data;
    try { data = JSON.parse(String(text || '')); }
    catch (e) { return { error: 'JSON 格式不对：' + ((e && e.message) || e) }; }

    const entries = [];
    const push = (key, tags) => {
      key = String(key == null ? '' : key).trim();
      if (!key) return;
      let t = [];
      if (Array.isArray(tags)) t = tags;
      else if (typeof tags === 'string') t = tags.split(/[,，]/);
      else if (tags != null) t = [String(tags)];
      t = t.map(x => String(x).trim()).filter(Boolean);
      entries.push({ key, tags: t, isLink: looksLikeLink(key) });
    };

    if (Array.isArray(data)) {
      for (const o of data) {
        if (!o || typeof o !== 'object') continue;
        push(o.链接 || o.link || o.url || o.BV || o.bv || o.标题 || o.title,
          o.标签 || o.tags || o.tag);
      }
    } else if (data && typeof data === 'object') {
      for (const k of Object.keys(data)) push(k, data[k]);
    } else {
      return { error: 'JSON 顶层得是对象或数组' };
    }

    if (!entries.length) return { error: '没解析出任何条目' };
    return { entries };
  }

  /**
   * 先算出「会改哪些内容」，不落库。
   * 标题按 精确 → 归一化 → 唯一模糊包含 三级匹配；
   * 模糊命中多条时算歧义，宁可报出来让人确认，也不瞎猜。
   */
  function planTagImport(entries) {
    const rows = lib.read().rows;
    const byLink = new Map();
    const byTitle = new Map();
    for (const r of rows) {
      const lk = linkKey(r.链接) || (r._id.indexOf('tt:') === 0 ? '' : r._id);
      if (lk) byLink.set(lk, r);
      const k = titleKey(r.标题);
      if (!byTitle.has(k)) byTitle.set(k, []);
      byTitle.get(k).push(r);
    }

    const hits = [], unmatched = [], ambiguous = [];
    let fuzzy = 0, dup = 0;

    for (const e of entries) {
      let matched = null, how = '';
      if (e.isLink) {
        const r = byLink.get(linkKey(e.key));
        if (r) { matched = [r]; how = '链接'; }
      } else {
        const k = titleKey(e.key);
        if (byTitle.has(k)) {
          matched = byTitle.get(k);
          how = matched.length > 1 ? '标题重名' : '标题';
          if (matched.length > 1) dup++;
        } else if (k) {
          const cands = rows.filter(r => titleKey(r.标题).indexOf(k) >= 0);
          if (cands.length === 1) { matched = cands; how = '模糊'; fuzzy++; }
          else if (cands.length > 1) { ambiguous.push(`${e.key}（${cands.length} 条都像）`); continue; }
        }
      }
      if (!matched) { unmatched.push(e.key); continue; }
      hits.push({ key: e.key, tags: e.tags, how, ids: matched.map(r => r._id) });
    }

    const affected = new Set();
    hits.forEach(h => h.ids.forEach(i => affected.add(i)));
    return { hits, unmatched, ambiguous, fuzzy, dup, affected: affected.size, entries: entries.length };
  }

  function applyTagImport(plan, mode) {
    const cur = lib.read();
    const map = new Map(cur.rows.map(r => [r._id, r]));
    const touched = new Set();
    for (const h of plan.hits) {
      for (const id of h.ids) {
        const r = map.get(id);
        if (!r) continue;
        if (mode === 'replace' && !touched.has(id)) r._tags = h.tags.slice();
        else {
          const t = (r._tags || []).slice();
          for (const x of h.tags) if (t.indexOf(x) < 0) t.push(x);
          r._tags = t;
        }
        touched.add(id);
      }
    }
    lib.write(cur);
    return touched.size;
  }

  /**
   * 导出成数组写法：好读好改，链接还能精确匹配回来。
   * 没链接的那些（页面没给 BV 号）故意把链接留空，让它靠标题匹配回来 ——
   * 早先这里填的是内部 ID（tt:xxx），那玩意儿既不是链接也不是标题，
   * 导出去再导回来会全军覆没。
   */
  function tagsToJson() {
    const rows = lib.read().rows.filter(r => (r._tags || []).length);
    return JSON.stringify(rows.map(r =>
      ({ 标题: r.标题, 链接: r.链接 || '', 标签: r._tags })), null, 2);
  }

  /* ==========================================================================
   * 8. 进度 / 列配置 / 模板 / 界面状态
   * ========================================================================== */
  const progress = {
    read() {
      if (!accountContext().id) return null;
      const v = readStoredJson(scopedKey(PROG_KEY), null);
      if (v && (!Array.isArray(v.rows) || (v.seen != null && !Array.isArray(v.seen))))
        throw new Error('未完成进度结构损坏，已保留原数据。');
      return v;
    },
    write(v) { requiredWrite(scopedKey(PROG_KEY, requireAccount()), JSON.stringify(v)); },
    clear() { requiredWrite(scopedKey(PROG_KEY, requireAccount()), ''); },
  };

  const cfg = {
    read() {
      let v = {};
      try { v = JSON.parse(rawRead(CFG_KEY, '{}')) || {}; } catch (e) { v = {}; }
      return {
        order: Array.isArray(v.order) ? v.order : [],
        off: Array.isArray(v.off) ? v.off : DEFAULT_OFF.slice(),
        sum: Array.isArray(v.sum) ? v.sum : DEFAULT_SUM.slice(),
        preset: typeof v.preset === 'string' ? v.preset : '',
      };
    },
    write(v) { rawWrite(CFG_KEY, JSON.stringify(v)); },
    patch(kv) { cfg.write(Object.assign(cfg.read(), kv)); },
    reset() { rawWrite(CFG_KEY, '{}'); },
  };

  const SHAPE = ['order', 'off', 'sum'];
  const shapeOf = c => { const o = {}; SHAPE.forEach(k => { o[k] = c[k]; }); return o; };
  const sameShape = (a, b) => JSON.stringify(shapeOf(a)) === JSON.stringify(shapeOf(b));

  const presets = {
    read() {
      try { const v = JSON.parse(rawRead(PRESET_KEY, '{}')); return (v && typeof v === 'object') ? v : {}; }
      catch (e) { return {}; }
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
    /** 改名。重建对象，保住在下拉框里的位置 */
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
    return !p || !sameShape(c, Object.assign({ order: [], off: [], sum: [] }, p));
  }

  const uiState = {
    read() { try { return JSON.parse(rawRead(UI_KEY, '{}')) || {}; } catch (e) { return {}; } },
    patch(kv) { rawWrite(UI_KEY, JSON.stringify(Object.assign(uiState.read(), kv))); },
  };

  /* ==========================================================================
   * 9. 列的顺序 / 勾选 / 取值
   * ========================================================================== */
  function orderedSchema() {
    const { order, off } = cfg.read();
    const left = new Map(EXPORT_SCHEMA.map(c => [c.col, c]));
    const out = [];
    for (const name of order) if (left.has(name)) { out.push(left.get(name)); left.delete(name); }
    for (const c of left.values()) out.push(c);      // 以后新增的列排最后
    return out.map(c => ({ c, on: off.indexOf(c.col) < 0 }));
  }
  const activeSchema = () => orderedSchema().filter(x => x.on).map(x => x.c);
  const headerName = c => (typeof c.header === 'function' ? c.header() : c.col);
  const colByName = n => EXPORT_SCHEMA.find(c => c.col === n) || null;

  function cellOf(r, c) {
    if (c.value) return cell(c.value(r));
    let v = cell(r[c.from]);
    if (c.num) v = v.replace(/,/g, '');
    return v;
  }

  /** 能用来做数值条件的列 —— 从 schema 自动来，加一列数据就自动能筛 */
  const numColumns = () => EXPORT_SCHEMA.filter(c => c.num || c.numValue).map(c => c.col);

  /** 取某行某列的数值。null = 这行没有这个指标（比如没补详情就没有平均播放进度） */
  function numOf(row, colName) {
    const c = colByName(colName);
    if (!c) return null;
    if (c.numValue) { const v = c.numValue(row); return v == null ? null : num(v); }
    const raw = row[c.from];
    if (raw === '' || raw == null) return null;
    return num(raw);
  }

  /* ==========================================================================
   * 10. 筛选内核（这一版的重点）
   * --------------------------------------------------------------------------
   * 六个条件同时生效（AND）。每个条件是一条 { key, test } 声明，
   * filtered() 就是「所有 test 都过」，不是一串 if。
   * 好处：加条件只加一条声明；筛选摘要、是否在筛选、清空筛选全都能自动跟上。
   * ========================================================================== */

  const OPS = ['≥', '≤', '='];

  const EMPTY_FILTER = () => ({
    q: '', tags: [], untagged: false, detail: 'all', st: '', from: '', to: '', rules: [],
    sort: 'ts', desc: true,
  });

  const filt = {
    read() {
      let v = {};
      try { v = JSON.parse(rawRead(FILT_KEY, '{}')) || {}; } catch (e) { v = {}; }
      const d = EMPTY_FILTER();
      return {
        q: typeof v.q === 'string' ? v.q : d.q,
        // 兼容旧版单选；命名标签和「无标签」使用独立字段，避免名称碰撞。
        tags: Array.isArray(v.tags)
          ? [...new Set(v.tags.filter(t => typeof t === 'string' && t.trim()))]
          : (typeof v.tag === 'string' && v.tag && v.tag !== '__none__' ? [v.tag] : []),
        untagged: Array.isArray(v.tags) ? v.untagged === true : v.tag === '__none__',
        detail: ['all', 'yes', 'no'].includes(v.detail) ? v.detail : d.detail,
        st: ['', 'full', 'noext', 'nocore'].indexOf(v.st) >= 0 ? v.st : d.st,
        from: typeof v.from === 'string' ? v.from : d.from,
        to: typeof v.to === 'string' ? v.to : d.to,
        rules: Array.isArray(v.rules) ? v.rules.filter(r => r && numColumns().indexOf(r.col) >= 0
          && OPS.indexOf(r.op) >= 0) : d.rules,
        sort: SORTS.some(s => s.key === v.sort) ? v.sort : d.sort,
        desc: v.desc === false ? false : true,
      };
    },
    write(v) {
      rawWrite(FILT_KEY, JSON.stringify(v));
      resetSelectionAnchor();
      if (ui && ui.list) ui.list.scrollTop = 0;
    },
    patch(kv) {
      // 保留旧控制台调用的 tag 单选入口，写入后统一为多选格式。
      if (Object.prototype.hasOwnProperty.call(kv, 'tag') && !Object.prototype.hasOwnProperty.call(kv, 'tags')) {
        kv = Object.assign({}, kv, { tags: kv.tag && kv.tag !== '__none__' ? [kv.tag] : [], untagged: kv.tag === '__none__' });
        delete kv.tag;
      }
      filt.write(Object.assign(filt.read(), kv));
    },
    clear() {
      // 排序不是筛选条件，「清空筛选」不该把它一起重置掉
      const cur = filt.read();
      const d = EMPTY_FILTER();
      d.sort = cur.sort; d.desc = cur.desc;
      filt.write(d);
    },
  };

  /**
   * 一条数值规则。col 是列名，op 是 ≥/≤/=，v 是数字（互动率/完播率按百分数写，如 2 = 2%）。
   * 该行没有这个指标（如图文没有弹幕）→ 不满足，会被排除。这是有意的：
   * 「弹幕 ≥ 100」本来就只对视频成立。面板上有一行灰字说明这件事。
   */
  function testRule(row, rule) {
    const v = numOf(row, rule.col);
    if (v == null) return false;
    const t = num(rule.v);
    if (rule.op === '≥') return v >= t;
    if (rule.op === '≤') return v <= t;
    return Math.abs(v - t) < 1e-9;
  }

  /** 这一条能不能走「补详情」—— 要有 BV 号 */
  function detailable(r) {
    return !!r._bv;
  }

  /**
   * 这一条的详情算不算「补过了」。
   * 光看 _detail 不够：6.0 也置 _detail=1，但它取的是那个恒为 0 的
   * play_avg_duration，平均播放进度那一栏还是空的。所以还要版本号对得上。
   * 一处判定，pending / stale / completeness 三处共用，不会有一边认一边不认。
   */
  function detailDone(r) {
    return !!r._detail && Number(r._detailV || 0) >= DETAIL_V;
  }

  function overviewDone(r) {
    return Number.isInteger(r._overviewV) && r._overviewV >= OVERVIEW_V;
  }

  /** 缺 cid 时可能查不到，因此给出请求范围；已获取过的指标组不重复请求。 */
  function estimateDetailRequests(rows, opts = {}) {
    let graph = 0, overview = 0, cid = 0;
    for (const r of rows || []) {
      if (!r._bv) continue;
      if (!detailDone(r)) { graph++; if (!cell(r._cid)) cid++; }
      if (opts.overview && !overviewDone(r)) overview++;
    }
    return { min: graph + overview, max: graph + overview + cid, graph, overview, cid };
  }

  /** 完整度。已补 = 扩展指标补过（不管接口最后给没给数，补过就算补过） */
  function completeness(r) {
    if (cell(r.播放量) === '') return 'nocore';
    return detailDone(r) ? 'full' : 'noext';
  }

  const FILTERS = [
    {
      key: 'q',
      on: v => !!String(v || '').trim(),
      // 关键词连标签一起搜：想找「所有打了活动标签的」，直接打「活动」也能中
      test: (r, v) => {
        const kw = String(v).trim().toLowerCase();
        const hay = (cell(r.标题) + ' ' + (r._tags || []).join(' ')).toLowerCase();
        return hay.indexOf(kw) >= 0;
      },
      say: v => `含「${String(v).trim()}」`,
    },
    {
      key: 'tags',
      on: v => Array.isArray(v) && v.length > 0,
      test: (r, v) => v.some(t => (r._tags || []).includes(t)),
      say: v => v.map(t => '#' + t).join(' 或 '),
    },
    {
      key: 'untagged',
      on: v => v === true,
      test: r => !(r._tags || []).length,
      say: () => '无标签',
    },
    {
      key: 'detail',
      on: v => v === 'yes' || v === 'no',
      test: (r, v) => v === 'yes' ? detailDone(r) : !detailDone(r),
      say: v => v === 'yes' ? '有详情' : '无详情',
    },
    {
      key: 'st',
      on: v => v !== '',
      test: (r, v) => completeness(r) === v,
      say: v => ({ full: '数据全齐', noext: '缺扩展指标', nocore: '缺核心数据' }[v] || ''),
    },
    {
      // 日期列固定 YYYY-MM-DD，所以字符串比较就是日期比较。改格式这里会静默失效。
      key: 'from',
      on: v => !!v,
      test: (r, v) => !!r.发布日期 && r.发布日期 >= v,
      say: v => v + ' 起',
    },
    {
      key: 'to',
      on: v => !!v,
      test: (r, v) => !!r.发布日期 && r.发布日期 <= v,
      say: v => '至 ' + v,
    },
    {
      key: 'rules',
      on: v => Array.isArray(v) && v.length > 0,
      test: (r, v) => v.every(rule => testRule(r, rule)),
      say: v => v.map(r => `${r.col}${r.op}${r.v}`).join(' · '),
    },
  ];

  const activeFilters = () => {
    const f = filt.read();
    return FILTERS.filter(x => x.on(f[x.key]));
  };
  const isFiltering = () => activeFilters().length > 0;

  /** 当前筛选出来的内容，已按排序规则排好 —— 导出跟着这个顺序走 */
  function filtered() {
    const f = filt.read();
    const on = activeFilters();
    const rows = lib.read().rows.filter(r => on.every(x => x.test(r, f[x.key])));
    const s = SORTS.find(x => x.key === f.sort) || SORTS[0];
    const dir = f.desc ? -1 : 1;
    return rows.sort((a, b) => {
      const va = s.of(a), vb = s.of(b);
      if (va === vb) return (b._ts || 0) - (a._ts || 0);   // 同值再按时间，顺序才稳定
      return va < vb ? -dir : dir;
    });
  }

  /**
   * 导出 / 复制 / 批量操作的作用域：
   *   勾了行 → 只要勾的那些
   *   没勾但有筛选 → 筛选结果
   *   都没有 → 全库
   * 这样「筛完直接导出」是顺手的，不用先全选一遍。
   */
  function scopeRows() {
    if (sel.size) {
      // 勾选跨筛选保留，但导出顺序还是听排序的
      const f = filt.read();
      const s = SORTS.find(x => x.key === f.sort) || SORTS[0];
      const dir = f.desc ? -1 : 1;
      return lib.read().rows.filter(r => sel.has(r._id)).sort((a, b) => {
        const va = s.of(a), vb = s.of(b);
        if (va === vb) return (b._ts || 0) - (a._ts || 0);
        return va < vb ? -dir : dir;
      });
    }
    return filtered();
  }

  function scopeLabel() {
    const n = scopeRows().length;
    if (sel.size) return `范围：勾选的 ${n} 条`;
    if (isFiltering()) return `范围：筛选出的 ${n} 条`;
    return `范围：全库 ${n} 条`;
  }

  /** 把当前筛选念成人话。开着好几个条件时，这一行是唯一能一眼看全的地方。 */
  function filterLabel() {
    const f = filt.read();
    const bits = activeFilters().map(x => x.say(f[x.key])).filter(Boolean);
    return bits.length ? '筛选：' + bits.join(' · ') : '';
  }

  /* ==========================================================================
   * 11. 稿件采集（DOM）
   * --------------------------------------------------------------------------
   * 这一整节是从 5.7 原样搬过来的，包括所有实测注释。数据源没动：
   * 我改的是采完之后往哪儿存、怎么筛，不是怎么读页面。
   * ========================================================================== */

  // 实测：数据区在一个同源 iframe 里（顶层文档没有 .archive-title），所以必须遍历 iframe
  function getDoc() {
    if (document.querySelector('.archive-title')) return document;
    for (const f of document.querySelectorAll('iframe')) {
      try {
        const r = f.getBoundingClientRect();
        if (r.width < 10 || r.height < 10) continue; // 跳过隐藏/残留的旧 iframe
        if (f.contentDocument && f.contentDocument.querySelector('.archive-title')) return f.contentDocument;
      } catch (e) { /* 跨域读不到就跳过 */ }
    }
    return null;
  }

  // BV 号（只认 DOM）。实测：当前版页面标题附近并没有 /video/BV 链接，这个函数基本恒返回
  // 空字符串，留着只为 B 站以后把链接加回来时能自动生效 —— 真正在干活的定位依据是
  // 菜单单选标记和完整标题。
  function getBVFromDom(doc) {
    const titleEl = doc.querySelector('.archive-title');
    if (!titleEl) return '';
    const wrapA = titleEl.closest('a[href*="/video/BV"]');
    if (wrapA) { const m0 = wrapA.href.match(/BV[0-9A-Za-z]+/); if (m0) return m0[0]; }
    // 从标题向上找 4 层容器内的视频链接；出现多个不同 BV 则视为不可靠，放弃 DOM 来源
    let node = titleEl;
    for (let i = 0; i < 4 && node; i++) {
      if (node.querySelectorAll) {
        const set = new Set();
        node.querySelectorAll('a[href*="/video/BV"]').forEach(a => {
          const m1 = a.href.match(/BV[0-9A-Za-z]+/);
          if (m1) set.add(m1[0]);
        });
        if (set.size === 1) return [...set][0];
        if (set.size > 1) break;
      }
      node = node.parentElement;
    }
    return '';
  }

  // 采集用：DOM 读不到 BV 时退回 URL。既然 getBVFromDom 恒空，这条路其实是「链接」列的
  // 唯一来源。5.6 曾以为切换后 URL 会过期、加开关禁止读 URL，结果切换之后每一条的链接
  // 都是空的。实测反过来：面板切换会同步更新 URL —— 两次导出分别是 25/25、28/28 个各不
  // 相同的链接、零空值、upsert 保险丝一次都没触发，说明每次读到的都是当前稿件自己的 BV。
  // 万一哪天真读到过期值，lib.upsert 的保险丝会发现「BV 撞了但标题不同」并丢掉链接。
  function getBV(doc) {
    const fromDom = getBVFromDom(doc);
    if (fromDom) return fromDom;
    let m = null;
    try { if (doc.defaultView) m = doc.defaultView.location.href.match(/BV[0-9A-Za-z]+/); } catch (e) { /* noop */ }
    if (!m) m = location.href.match(/BV[0-9A-Za-z]+/);
    return m ? m[0] : '';
  }

  // 当前稿件的视频长度。
  // 首选：从 .archive-title 向上最多 5 层，在同一块里找唯一的时长元素 —— 实测在第 3 层
  //（.cover-and-info）命中，那里同时装着当前标题和当前封面时长，两者同源、不会错位。
  // 查询要排除 .menu-wrapper：切换菜单里有 40 个 .duration，混进来就废了。
  // 兜底：「稿件对比」表里带「当前稿件」徽标（.arc-comp-cur）的那一行。
  function durOfCurrent(doc) {
    const t = doc.querySelector('.archive-title');
    if (t) {
      let n = t.parentElement;
      for (let i = 0; i < 5 && n; i++) {
        const list = [...n.querySelectorAll('.duration, .arc-comp-duration')]
          .filter(e => !e.closest('.menu-wrapper'));
        if (list.length === 1) return list[0].textContent.trim();
        if (list.length > 1) break; // 范围放宽到出现多个了，宁可不取
        n = n.parentElement;
      }
    }
    const badge = [...doc.querySelectorAll('.arc-comp-cur')]
      .find(e => e.textContent.trim() === '当前稿件');
    if (badge) {
      const row = badge.closest('tr') || badge.parentElement;
      const el = row.querySelector('.arc-comp-duration, .duration');
      if (el) return el.textContent.trim();
    }
    return '';
  }

  /** 「数据总览」标签上能读到的东西 */
  function collectOverview(doc) {
    const q = s => { const el = doc.querySelector(s); return el ? el.innerText.trim() : ''; };
    const row = {};
    row.标题 = q('.archive-title');
    const rawTime = q('.time');
    const dm = rawTime.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    const tm = rawTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    row.发布日期 = dm ? `${dm[1]}-${pad(dm[2])}-${pad(dm[3])}` : '';
    row.发布时间 = tm ? `${pad(tm[1])}:${tm[2]}` : '';
    const bv = getBV(doc);
    row._bv = bv;
    row.链接 = bv ? `https://www.bilibili.com/video/${bv}` : '';
    row.播放量 = cleanNum(q('.real-time-play-number'));

    const cardMap = {};
    doc.querySelectorAll('.cell.item-cell').forEach(card => {
      const t = card.querySelector('.title');
      const v = card.querySelector('.value');
      if (t && v) cardMap[t.innerText.trim()] = cleanNum(v.innerText);
    });
    row.点赞 = cardMap['点赞'] || '';
    row.收藏 = cardMap['收藏'] || '';
    row.评论 = cardMap['评论'] || '';
    row.投币 = cardMap['投币'] || '';
    row.弹幕 = cardMap['弹幕'] || '';
    row.转发 = cardMap['分享'] || '';
    row.涨粉 = cardMap['涨粉'] || '';

    const durRaw = durOfCurrent(doc);
    if (durRaw) { row._durSec = String(durToSec(durRaw)); row._durGuess = 0; }
    return row;
  }

  /** 「播放分析」标签上的平均播放进度 + 占总时长 */
  function collectPlay(doc) {
    const out = {};
    if (!doc) return out;
    const t = [...doc.querySelectorAll('.title')].find(e => e.textContent.trim() === '内容节奏');
    if (!t) return out;
    let box = t.parentElement;
    while (box && !box.innerText.includes('平均播放进度')) box = box.parentElement;
    if (!box) return out;
    const txt = box.innerText.replace(/\s+/g, '');
    const prog = (txt.match(/平均播放进度([\d时分秒]+)/) || [])[1] || '';
    const pct = (txt.match(/占总时长([\d.]+)%/) || [])[1] || '';
    if (prog) { out._progSec = String(cnDurToSec(prog)); out._detail = 1; out.详情时间 = stampNow(); }
    if (pct) out._progPct = pct;
    return out;
  }

  /** 时长兜底：平均播放进度秒 ÷ 占总时长%。推算的打上标记，导出后一眼能分辨 */
  function guessDur(row) {
    if (row._durSec || !row._progSec || !row._progPct) return row;
    const sec = num(row._progSec), pct = num(row._progPct);
    if (sec && pct) { row._durSec = String(Math.round(sec / (pct / 100))); row._durGuess = 1; }
    return row;
  }

  const findTab = (doc, name) => [...doc.querySelectorAll('.tabbar-item')]
    .find(e => e.textContent.trim() === name);

  /**
   * 采集当前稿件 —— 一次点击拿全。
   *
   * 「平均播放进度」这个数从来就不在「数据总览」的 DOM 里，它在「播放分析」标签下。
   * 6.1 之前只有 DOM 一条路，所以必须让人切过去再点一次；6.1 把批量那条路改成走
   * analyze/graph 接口了，却漏了手动这条 —— 于是手动采集还是要点两次。这儿补上：
   *
   *   1) 先读当前 DOM（在哪个标签就读到哪些）
   *   2) 进度没读到 → 直接问接口要，不切标签、不动页面
   *   3) 接口也没有、而且开了 AUTO_SWITCH_TAB → 才退回「切标签轮询」那条老路
   *
   * 合并顺序是 接口 → DOM：这条路的意义就是「眼见为实」，屏幕上摆着的数字优先，
   * 接口只负责补屏幕上没有的那部分。
   * ⚠ 这不是空话，有真会撞车的字段：多 P 稿件里 graph 给的 duration 是第 1P 的长度，
   *   而页面上那个 .duration 是整条的。接口排前面被 DOM 盖掉，时长才是对的。
   */
  async function doCollect() {
    const context = requireAccount();
    const doc = getDoc();
    if (!doc) { say('未找到数据区，请确认在稿件分析页并等待加载', 'err', 'grab-detail'); return; }
    const overview = collectOverview(doc);
    const play = collectPlay(doc);
    if (!overview.标题) { say('读不到标题，请切到「数据总览」标签先采集一次', 'err', 'grab-detail'); return; }

    let viaApi = null, apiErr = '';
    if (!play._progSec && overview._bv) {
      say('页面上没有播放分析的数据，正在从接口取…', 'progress', 'grab-detail');
      try { viaApi = await progViaApi(overview._bv); }
      catch (err) { requireAccount(context); assertTask(); if (/账号|登录|限流|网络/.test(err.message)) throw err; apiErr = String((err && err.message) || err); }
    }
    requireAccount(context);

    if (!play._progSec && !(viaApi && viaApi._progSec) && AUTO_SWITCH_TAB) {
      const playTab = findTab(doc, '播放分析');
      if (playTab) {
        playTab.click();
        say('正在切换到播放分析…', 'progress', 'grab-detail');
        await pollPlay(Object.assign({}, viaApi || {}, overview), 20, context); // 约 8 秒超时
        return;
      }
    }
    assertTask();
    const current = currentArcState();
    if (!current || current.id !== makeId(overview._bv ? 'bv' : '', overview._bv, overview.标题))
      throw new Error('当前稿件已切换，本次采集结果未保存，请重新采集。');
    finishCollect(Object.assign({}, viaApi || {}, overview, play), apiErr, context);
  }

  /**
   * 单条走接口补播放分析的数。库里已经有这条的话就用库里存的 cid，省一个请求。
   * 复用 enrichArc —— 批量那条路和手动这条路取数逻辑必须是同一段，
   * 否则哪天接口变了，改一处漏一处，两边的数字会对不上。
   */
  async function progViaApi(bv) {
    const known = lib.read().rows.find(r => r._bv === bv);
    return enrichArc({ _bv: bv, _cid: known ? known._cid : '' }, { overview: false });
  }

  // 轮询等「播放分析」数据出现；采集完停在播放分析，不自动切回
  async function pollPlay(overview, tries, context) {
    requireAccount(context);
    assertTask();
    const p = collectPlay(getDoc());
    if (p._progSec || tries <= 0) {
      finishCollect(Object.assign({}, overview, p), '', context);
      if (!p._progSec) say('已采集，但未抓到平均播放进度（加载超时）', 'warn', 'grab-detail');
      return;
    }
    await sleepOrStop(400);
    return pollPlay(overview, tries - 1, context);
  }

  function finishCollect(partial, apiErr, context = accountContext()) {
    assertTask();
    requireAccount(context);
    guessDur(partial);
    partial._type = '视频';
    partial._ts = tsOf(partial.发布日期, partial.发布时间);
    partial._id = makeId(partial._bv ? 'bv' : '', partial._bv, partial.标题);
    partial.数据时间 = stampNow();
    if (!partial._id) { say('既没有 BV 号也没有标题，这条没法入库', 'err', 'grab-detail'); return; }

    const saved = lib.upsert(partial);
    if (!saved) { say('入库失败', 'err', 'grab-detail'); return; }
    fresh.add(saved._id);
    refresh();

    const tips = [];
    if (!saved.播放量) tips.push('核心数据缺失，请到「数据总览」再点一次');
    // 判的是「这条到底有没有平均播放进度」，不是 _detail 标记。
    // 提示要分清「谁没给」——接口试过了还是没有，再让人去切标签就是白跑一趟。
    if (!saved._progSec) {
      if (apiErr) tips.push('平均播放进度没取到：' + apiErr);
      else if (saved._progNA) tips.push('这条的播放分析接口没数（可能还没算好），切标签也看不到');
      else tips.push('要平均播放进度请切到「播放分析」再点一次');
    }
    say('已采集：' + cut(saved.标题, 10) + (tips.length ? '（' + tips.join('；') + '）' : ''),
      tips.length ? 'warn' : 'ok', 'grab-detail');
  }

  /* ---- 上一个 / 下一个稿件切换（每次点击只做一次「人会做的」菜单操作，无自动批量） ---- */

  const getArchiveItems = doc => [...doc.querySelectorAll('.menu-wrapper .archive-item')];

  function openSwitchMenu(doc) {
    const trigger = [...doc.querySelectorAll('.info-top *')]
      .find(e => e.childElementCount === 0 && e.textContent.trim() === '切换视频');
    if (trigger) { trigger.click(); return true; }
    return false;
  }

  // 菜单条目的单选标记：实测当前稿件那一条的图标带 ...-checked，其余是 ...-unchecked。
  // 这是菜单里唯一一个不依赖中文文案、也不怕标题被省略号截断的机器可读标记。
  const isChecked = it => !!it.querySelector('[class*="checked"]:not([class*="unchecked"])');

  // 条目里的 BV 号。实测当前版页面菜单里没有任何 BV，这里恒返回空数组；
  // 保留是为了 B 站以后加回链接时自动生效。
  function itemBVs(it) {
    const set = new Set();
    it.querySelectorAll('a[href*="/video/BV"]').forEach(a => {
      const m = a.href.match(/BV[0-9A-Za-z]+/);
      if (m) set.add(m[0]);
    });
    for (const attr of ['data-bvid', 'bvid', 'data-bv']) {
      const v = it.getAttribute && it.getAttribute(attr);
      if (v && /^BV[0-9A-Za-z]+$/.test(v.trim())) set.add(v.trim());
    }
    return [...set];
  }

  // 条目里最长的一行当标题。实测菜单里时长和标题粘在同一行（「04:57升压芯片 TPS61290｜…」），
  // 所以要把开头的时长去掉，否则按钮提示和切换校验里都带着一截「04:57」
  function itemName(it) {
    const lines = it.innerText.split('\n').map(s => s.trim()).filter(s => s && s !== '当前稿件');
    const raw = lines.sort((a, b) => b.length - a.length)[0] || '';
    return raw.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s*/, '').trim();
  }

  // 定位当前稿件在菜单里的下标 → { idx, by, alt }。
  // idx<0 表示各依据不一致、还不可信，调用方应继续等；alt 是「等不到一致时」按可信度排的备选。
  // 四种依据各自要求「唯一命中」，同时拿到多种时必须彼此一致：
  //   bv    —— 最硬，但当前页面菜单里没有 BV，实际恒失效
  //   title —— 读的是当前页面自己的完整标题，最可信；菜单里标题被截断时自然不命中
  //   check —— 菜单的单选标记，可靠但属于菜单渲染状态，可能滞后一拍
  //   badge —— 「当前稿件」文字，实测在菜单里根本不存在（它在稿件对比表里），保留仅为兼容
  // 5.4 曾用「标题前 16 字」兜底，同系列稿件前缀相同会命中更靠前那条，导致 idx+step 静默
  // 跳号漏采，已彻底去掉前缀匹配，不再用任何模糊匹配定位。
  function locateCurrent(doc, items) {
    const hitsOf = fn => { const out = []; items.forEach((it, i) => { if (fn(it)) out.push(i); }); return out; };
    const only = arr => (arr.length === 1 ? arr[0] : -1);
    const bv = getBVFromDom(doc);
    const byBV = bv ? only(hitsOf(it => itemBVs(it).includes(bv))) : -1;
    const byCheck = only(hitsOf(isChecked));
    const byBadge = only(hitsOf(it => it.innerText.includes('当前稿件')));
    const t = doc.querySelector('.archive-title');
    const cur = t ? t.textContent.trim() : '';
    const byTitle = cur.length >= 4 ? only(hitsOf(it => it.innerText.includes(cur))) : -1;
    const alt = byBV >= 0 ? byBV : (byTitle >= 0 ? byTitle : (byCheck >= 0 ? byCheck : byBadge));
    const votes = [byBV, byCheck, byBadge, byTitle].filter(i => i >= 0);
    if (!votes.length) return { idx: -1, by: 'none', alt: -1 };
    // 不一致 = 菜单还没刷新到当前稿件，先不动，等一等再看
    if (new Set(votes).size > 1) return { idx: -1, by: 'conflict', alt };
    return { idx: votes[0], by: byBV >= 0 ? 'bv' : (byTitle >= 0 ? 'title' : (byCheck >= 0 ? 'check' : 'badge')), alt };
  }

  let switchSequence = 0;
  // step = +1 下一个，-1 上一个
  function switchBy(step) {
    const context = requireAccount();
    if (ui) clearStatus('grab-detail');
    const sequence = ++switchSequence;
    const doc = getDoc();
    if (!doc) { finishStatus('未找到数据区', 'err', 'grab-detail'); return; }
    if (!openSwitchMenu(doc)) { finishStatus('未找到「切换视频」按钮', 'err', 'grab-detail'); return; }
    pollMenu(step, 16, context, sequence); // 轮询等菜单渲染 + 等定位可信，约 5 秒超时
  }

  // 等到定位可信（各依据一致）再点；等不到就退到最可信的那条依据，并靠点后回读校验兜底
  function pollMenu(step, tries, context, sequence) {
    if (sequence !== switchSequence || !sameAccountContext(context)) return;
    const doc = getDoc();
    const items = doc ? getArchiveItems(doc) : [];
    const loc = items.length ? locateCurrent(doc, items) : { idx: -1, by: 'none', alt: -1 };
    let idx = loc.idx;
    if (idx < 0) {
      if (tries > 0) { setTimeout(() => pollMenu(step, tries - 1, context, sequence), 300); return; }
      if (loc.alt < 0) {
        finishStatus(items.length ? '未定位到当前稿件，请在打开的菜单里手动选择' : '切换菜单未加载出来，请手动切换', 'err', 'grab-detail');
        return;
      }
      idx = loc.alt; // 等不到一致就按可信度取，不把按钮变成死路
    }
    const viaAlt = loc.idx < 0;
    const target = idx + step;
    if (target < 0 || target >= items.length) {
      openSwitchMenu(doc); // 再点一次收起菜单
      finishStatus(target < 0 ? '已经是第一个稿件了' : '已经是最后一个稿件了', 'warn', 'grab-detail');
      return;
    }
    // 先记下目标是谁，点完再回读校验，切错了要看得见
    const want = itemName(items[target]);
    const wantBV = itemBVs(items[target])[0] || '';
    items[target].click();
    if (!wantBV && want.length < 6) { clearStatus('grab-detail'); setTimeout(() => { if (sequence === switchSequence && sameAccountContext(context)) updateHints(); }, 800); return; }
    say((viaAlt ? '定位有分歧，' : '') + '正在切到：' + cut(want, 12), 'progress', 'grab-detail');
    verifySwitch(want, wantBV, 16, context, sequence); // 约 5 秒
  }

  // 点完之后确认页面真的落到了目标稿件。标题比对前去掉两端省略号，
  // 免得菜单里被截断过的标题让校验白白超时报警
  function verifySwitch(want, wantBV, tries, context, sequence) {
    if (sequence !== switchSequence || !sameAccountContext(context)) return;
    const trim = s => String(s || '').replace(/[…\.]+$/, '').trim();
    const doc = getDoc();
    const t = doc && doc.querySelector('.archive-title');
    const cur = trim(t ? t.textContent : '');
    const w = trim(want);
    const bv = doc ? getBVFromDom(doc) : '';
    const hit = (wantBV && bv) ? (wantBV === bv)
      : !!(cur && w.length >= 6 && (cur.includes(w) || w.includes(cur)));
    if (hit) { finishStatus('已切到：' + cut(cur, 14), 'ok', 'grab-detail'); updateHints(); return; }
    if (tries <= 0) {
      finishStatus('没能确认已切到「' + cut(w || '目标稿件', 12) + '」，采集前请先核对页面上的标题', 'warn', 'grab-detail');
      updateHints();
      return;
    }
    setTimeout(() => verifySwitch(want, wantBV, tries - 1, context, sequence), 300);
  }

  /** 方向按钮上的第二行小字：下一个/上一个是谁 */
  function updateHints() {
    if (!ui || !ui.prevBtn) return;
    const set = (btn, top, name) => {
      btn.innerHTML = `<span class="l1">${esc(top)}</span>`
        + (name ? `<span class="l2">${esc(cut(name, 18))}</span>` : '');
    };
    const doc = onArcPage() ? getDoc() : null;
    const items = doc ? getArchiveItems(doc) : [];
    const reset = () => { set(ui.prevBtn, '↑ 上个'); set(ui.nextBtn, '↓ 下个'); };
    if (!items.length) { reset(); return; }
    const idx = locateCurrent(doc, items).idx;
    if (idx < 0) { reset(); return; } // 定位不可信时不显示目标标题，免得给出错误暗示
    if (idx > 0) set(ui.prevBtn, '↑ 上个', itemName(items[idx - 1])); else set(ui.prevBtn, '已是第一个');
    if (idx + 1 < items.length) set(ui.nextBtn, '↓ 下个', itemName(items[idx + 1])); else set(ui.nextBtn, '已是最后一个');
  }

  /** 当前页面这条稿件在库里有没有 —— 面板顶上一行，省得反复翻列表确认 */
  function currentArcState() {
    if (!onArcPage()) return null;
    const doc = getDoc();
    if (!doc) return null;
    const t = doc.querySelector('.archive-title');
    const title = t ? t.textContent.trim() : '';
    if (!title) return null;
    const bv = getBV(doc);
    const id = makeId(bv ? 'bv' : '', bv, title);
    const row = lib.read().rows.find(r => r._id === id);
    return { title, id, row: row || null };
  }

  /* ==========================================================================
   * 12. 抓取
   * ========================================================================== */

  let aborted = false;

  /**
   * 只给自动化测试用：把间隔调到 0，好在几百毫秒里跑完一次多页抓取。
   * 真跑的时候别碰 —— 固定/极短的间隔本身就是机器人特征。
   */
  function setPace(o) {
    if (!o) return;
    if (o.min != null) DELAY_MIN = o.min;
    if (o.max != null) DELAY_MAX = o.max;
    if (o.restEvery != null) REST_EVERY = o.restEvery;
    if (o.restMin != null) REST_MIN = o.restMin;
    if (o.restMax != null) REST_MAX = o.restMax;
  }

  let activeTask = null;
  let testTimingOverride = null;
  function setTimingForTests(timing) {
    testTimingOverride = timing == null ? null : { ...timing };
  }
  const getCurrentTask = () => activeTask;
  function taskTiming(timing) {
    const value = testTimingOverride || (typeof timing === 'string' ? DETAIL_SPEEDS[timing] : timing);
    if (timing != null && (!value || typeof value !== 'object')) throw new Error('采集速度设置无效');
    const out = value ? { min: value.min, max: value.max, restMin: value.restMin,
      restMax: value.restMax, restEvery: REST_EVERY } : {
      min: DELAY_MIN, max: DELAY_MAX, restMin: REST_MIN, restMax: REST_MAX, restEvery: REST_EVERY,
    };
    if (['min', 'max', 'restMin', 'restMax'].some(key => !Number.isFinite(out[key]) || out[key] < 0)
      || out.max < out.min || out.restMax < out.restMin || !Number.isInteger(out.restEvery) || out.restEvery < 1)
      throw new Error('采集速度设置无效');
    return Object.freeze(out);
  }
  function beginTask(onTip, timing) {
    if (activeTask) throw new Error('已有采集任务正在执行。');
    switchSequence++;
    aborted = false;
    activeTask = { context: requireAccount(), controller: new AbortController(), requests: 0,
      onTip, timing: taskTiming(timing) };
    return activeTask;
  }
  function endTask() { activeTask = null; aborted = false; }
  function stopTask() {
    switchSequence++;
    aborted = true;
    if (activeTask) activeTask.controller.abort();
  }
  function assertTask(task = activeTask) {
    if (task && !sameAccountContext(task.context)) throw new Error('账号或登录会话已变化，已停止采集。');
    if (aborted || (task && task.controller.signal.aborted)) {
      const e = new Error('已停止采集，已保存的数据保留。'); e.name = 'AbortError'; throw e;
    }
  }
  async function withTask(fn, onTip, timing) {
    const own = !activeTask;
    if (own) beginTask(onTip, timing);
    try { assertTask(); return await fn(activeTask); }
    finally { if (own) endTask(); }
  }
  async function sleepOrStop(ms, task = activeTask) {
    assertTask(task);
    await new Promise((resolve, reject) => {
      const signal = task && task.controller.signal;
      let timer, watcher;
      const cleanup = () => { clearTimeout(timer); clearInterval(watcher); if (signal) signal.removeEventListener('abort', cancel); };
      const cancel = () => { cleanup(); const e = new Error('已停止采集'); e.name = 'AbortError'; reject(e); };
      if (signal) signal.addEventListener('abort', cancel, { once: true });
      timer = setTimeout(() => { cleanup(); resolve(); }, ms);
      watcher = setInterval(() => { try { assertTask(task); } catch (e) { cleanup(); reject(e); } }, 150);
    });
    assertTask(task);
  }
  async function pace(i, onTip, task = activeTask) {
    const timing = task ? task.timing : taskTiming();
    const long = i > 0 && i % timing.restEvery === 0;
    const wait = long ? rand(timing.restMin, timing.restMax) : rand(timing.min, timing.max);
    if (onTip) onTip(long ? `歇 ${Math.round(wait / 1000)} 秒…` : `等 ${(wait / 1000).toFixed(1)} 秒…`);
    await sleepOrStop(wait, task);
  }
  async function getJson(url) {
    return withTask(async task => {
      if (task.requests) await pace(task.requests, task.onTip, task);
      assertTask(task);
      const controller = new AbortController();
      const cancel = () => controller.abort();
      task.controller.signal.addEventListener('abort', cancel, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
      try {
        task.requests++;
        if (task.onRequest) task.onRequest();
        const res = await fetch(url, { credentials: 'include', cache: 'no-store', signal: controller.signal });
        assertTask(task);
        if (res.status === 429 || res.status === 503 || res.status === 412) throw new Error(`被限流了（HTTP ${res.status}）`);
        if (res.status === 401 || res.status === 403) throw new Error(`登录或访问权限异常（HTTP ${res.status}）`);
        if (!res.ok) throw new Error(`请求失败：HTTP ${res.status}`);
        let j;
        try { j = await res.json(); }
        catch (e) { assertTask(task); throw new Error('返回的不是 JSON，可能登录已失效'); }
        assertTask(task);
        if (!j || j.code !== 0) {
          const msg = (j && j.message) || '';
          if ((j && [-412, -509].includes(j.code)) || /频繁|风控|限制|拦截/.test(msg)) throw new Error(`被限流了（${msg}），请稍后继续`);
          if (j && (j.code === -101 || j.code === -111)) throw new Error('登录状态失效，请重新登录后继续');
          throw new Error(`接口返回 code=${j && j.code} ${msg}`);
        }
        if (!j.data || typeof j.data !== 'object' || Array.isArray(j.data)) throw new Error('接口数据结构异常，未保存为空数据');
        return j.data;
      } catch (e) {
        assertTask(task);
        if (timedOut) throw new Error('网络请求超时（30 秒），请稍后继续');
        if (e && e.name === 'TypeError') throw new Error('网络请求失败：' + e.message);
        throw e;
      } finally {
        clearTimeout(timer);
        task.controller.signal.removeEventListener('abort', cancel);
      }
    });
  }

  /* ==========================================================================
   * 两个列表接口
   * --------------------------------------------------------------------------
   * 两边字段是互补的，所以各写一个映射函数，同一页的结果按 bvid 合到一起。
   * 谁也不覆盖谁的空值 —— 合并用的是和 lib.merge 同一条规则（见 absorb）。
   * ========================================================================== */

  const cacheBust = () => 't=' + Date.now();

  /**
   * 从列表条目里抠 cid。
   * 列表 A 给的是 videos:[{cid,index,title,duration}]，列表 B 给的是 cid_list:[41126068693]，
   * 形状不同、意思一样，所以两边都归到这儿，返回 { _cid, _pCnt }。
   * 取第 1P（videos[0] / cid_list[0]）—— 播放分析页本身也只画第 1P 的曲线。
   * 顺手记下分 P 数，多 P 的行导出时会标「（第1P）」。
   * 拿不到就返回空对象：merge 的空值保护会让库里已有的 _cid 留着，不会被抹掉。
   */
  function cidOf(o) {
    const arr = (o && Array.isArray(o.videos) && o.videos)
      || (o && Array.isArray(o.cid_list) && o.cid_list) || null;
    if (!arr || !arr.length) return {};
    const first = arr[0];
    const cid = numStr(first && typeof first === 'object' ? first.cid : first);
    // cid 是 0 等于没有 —— 别把 0 当成钥匙塞进库，那样兜底换 cid 那一步就永远不会跑
    if (cid === '' || num(cid) <= 0) return {};
    return { _cid: cid, _pCnt: String(arr.length) };
  }

  /** 列表 A（x/web/data/archive/index）的一条 */
  function mapArcA(o) {
    const bvid = cell(o && o.bvid);
    if (!bvid) return null;
    const ts = (Number(o.pubtime) || 0) * 1000;
    const d = ts ? new Date(ts) : null;
    const fp = pickLive(o, 'full_play_ratio');
    return Object.assign(cidOf(o), {
      _id: 'bv:' + bvid, _type: '视频', _bv: bvid,
      _aid: o.aid ? String(o.aid) : '',
      _ts: ts,
      发布日期: d ? fmtDate(d) : '', 发布时间: d ? fmtTime(d) : '',
      标题: cell(o.title).trim(),
      链接: 'https://www.bilibili.com/video/' + bvid,
      播放量: pickLive(o, 'play'),
      点赞: pickLive(o, 'likes'),
      评论: pickLive(o, 'reply'),
      涨粉: pickLive(o, 'fans'),
      // full_play_ratio 是万分数：2995 = 29.95%
      _finishPct: fp === '' ? '' : String(num(fp) / 100),
      _durSec: o.duration ? String(o.duration) : '',
      _durGuess: 0,
      数据时间: stampNow(),
    });
  }

  /** 列表 B（x/web/archives）的一条 */
  function mapArcB(o) {
    const A = (o && o.Archive) || {};
    const S = (o && o.stat) || {};
    const bvid = cell(A.bvid);
    if (!bvid) return null;
    const ts = (Number(A.ptime) || 0) * 1000;
    const d = ts ? new Date(ts) : null;
    // cid_list 挂在外层条目上，不在 Archive 里
    return Object.assign(cidOf(o), {
      _id: 'bv:' + bvid, _type: '视频', _bv: bvid,
      _aid: A.aid ? String(A.aid) : '',
      _ts: ts,
      发布日期: d ? fmtDate(d) : '', 发布时间: d ? fmtTime(d) : '',
      标题: cell(A.title).trim(),
      链接: 'https://www.bilibili.com/video/' + bvid,
      播放量: numStr(S.view),
      点赞: numStr(S.like),
      收藏: numStr(S.favorite),
      评论: numStr(S.reply),
      投币: numStr(S.coin),
      转发: numStr(S.share),
      弹幕: numStr(S.danmaku),
      _durSec: A.duration ? String(A.duration) : '',
      _durGuess: 0,
      数据时间: stampNow(),
    });
  }

  async function fetchArcA(pn) {
    const url = `${API_ARC_A}?pn=${pn}&ps=${PAGE_SIZE}&order=0`
      + `&scene=archive_compare&tmid=&${cacheBust()}`;
    const d = await getJson(url);
    if (!Array.isArray(d.list) || !d.pager || numStr(d.pager.total) === '' || Number(d.pager.total) < 0)
      throw new Error('列表 A 数据结构异常，未将本页视为抓取完成');
    const total = Number(d.pager.total);
    if (total > (pn - 1) * PAGE_SIZE && !d.list.length) throw new Error('列表 A 提前返回空页，请稍后继续');
    return {
      list: Array.isArray(d.list) ? d.list : [],
      total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  async function fetchArcB(pn) {
    const url = `${API_ARC_B}?status=pubed&pn=${pn}&ps=${PAGE_SIZE}&coop=1&interactive=1&${cacheBust()}`;
    const d = await getJson(url);
    if (!Array.isArray(d.arc_audits) || !d.page || numStr(d.page.count) === '' || Number(d.page.count) < 0)
      throw new Error('列表 B 数据结构异常，未将本页视为抓取完成');
    const total = Number(d.page.count);
    if (total > (pn - 1) * PAGE_SIZE && !d.arc_audits.length) throw new Error('列表 B 提前返回空页，请稍后继续');
    return {
      list: Array.isArray(d.arc_audits) ? d.arc_audits : [],
      total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  /** 把 inc 并进 old，空值不许盖已有值（和 lib.merge 同一条规则） */
  function absorb(old, inc) {
    for (const k of Object.keys(inc)) {
      if ((inc[k] === '' || inc[k] == null) && cell(old[k]) !== '') continue;
      old[k] = inc[k];
    }
    return old;
  }

  // 只优先 A 的有效核心数值；B 补专属字段和 A 未提供的值。
  // 同一轮的优先值单独保留，避免两来源页序不同时又被较晚出现的 B 覆盖。
  function listPriority(row) {
    const out = {};
    for (const key of ['播放量', '点赞', '评论']) {
      const value = numStr(row[key]);
      if (value !== '') out[key] = value;
    }
    return out;
  }

  /* ==========================================================================
   * 数据源
   * --------------------------------------------------------------------------
   * 抓列表的循环（crawlList）不认识具体接口，只管翻页和判断什么时候停；
   * 怎么请求、怎么映射、一页发几个请求，全收在这个 page() 里。
   * ========================================================================== */
  const SOURCE = {
    key: 'arc', name: '稿件',
    // 列表给的是精确整数（不像图文列表那样是「x.x万」的近似值），所以详情不用防它
    approx: false,
    async page(pn, opts, stat, tip) {
      const batches = [];
      const mapRows = (list, mapper) => {
        const rows = list.map(mapper).filter(Boolean);
        if (rows.length !== list.length) { stat.skipped += list.length - rows.length; throw new Error('列表条目结构异常，部分稿件缺少 BV 号，未将本页视为完成'); }
        return rows;
      };
      if (opts.both) {
        const a = await fetchArcA(pn);
        batches.push({ key: 'a', rows: mapRows(a.list, mapArcA), total: a.total, hasMore: pn < a.pages });
      }
      assertTask();
      const b = await fetchArcB(pn);
      batches.push({ key: 'b', rows: mapRows(b.list, mapArcB), total: b.total, hasMore: pn < b.pages });
      const out = new Map();
      for (const batch of batches) for (const row of batch.rows) {
        if (out.has(row._id)) absorb(out.get(row._id), row); else out.set(row._id, { ...row });
      }
      for (const batch of batches) if (batch.key === 'a') for (const row of batch.rows) {
        Object.assign(out.get(row._id), listPriority(row));
      }
      return { rows: [...out.values()].sort((x, y) => (y._ts || 0) - (x._ts || 0)), batches,
        total: Math.max(...batches.map(x => x.total)), hasMore: batches.some(x => x.hasMore) };

    },
  };

  /**
   * 第 1 步：抓列表。
   * 四种模式的区别全在起始页、每来源停止边界及完成后的提交方式：
   *   inc     从第 1 页起，分别确认各来源遇到已知 BV，整页新 BV 均保留
   *   older   从 donePn+1 页起接着翻，用来分几次补全历史
   *   refresh 从第 1 页翻到底，只更新不清库 —— 老稿件的播放量一直在涨，
   *           增量模式碰不到它们，得靠这个
   *   full    从第 1 页起暂存，完成后替换主库
   * inc 之外都不设 stopAtTs，所以会一路翻到底或翻到 cutoffTs。
   */
  async function crawlList(src, opts, onProgress = () => {}) {
    return withTask(async task => {
      const resume = opts.resume || null;
      const rows = resume ? resume.rows.slice() : [];
      const seen = resume && Array.isArray(resume.seen) ? resume.seen.slice() : [];
      const byId = new Map(rows.map(r => [r._id, r]));
      const preferred = new Map(resume && Array.isArray(resume.preferred) ? resume.preferred : []);
      const library = lib.read();
      const known = new Set(resume && resume.knownIds || library.restoreKnownIds || library.rows.map(r => r._id));
      const stat = Object.assign({ reqs: 0, pages: 0, skipped: 0, total: 0, reached: '' }, resume && resume.stat);
      const startPn = resume ? resume.startPn : (opts.startPn || 1);
      let pn = resume ? resume.pn : startPn;
      let donePages = resume ? (resume.donePages || 0) : 0;
      let reason = resume && resume.complete ? resume.reason || 'end' : '';
      const reached = { ...(resume && resume.reached || {}) };
      const save = complete => {
        requireAccount(task.context);
        progress.write({ kind: 'list', src: src.key, mode: opts.mode, both: !!opts.both,
          startPn, pn, donePages, rows, seen, stat, knownIds: [...known], reached, preferred: [...preferred],
          stopAtTs: opts.stopAtTs || 0, cutoffTs: opts.cutoffTs || 0,
          complete: !!complete, reason, at: Date.now() });
      };
      task.onTip = tip => onProgress(rows.length, stat, tip);
      task.onRequest = () => { stat.reqs++; };
      if (!reason) save(false);
      try {
        for (let loop = 0; !reason && loop < MAX_PAGES; loop++) {
          assertTask(task);
          const page = await src.page(pn, opts, stat, task.onTip);
          assertTask(task);
          stat.total = page.total || stat.total;
          stat.pages++;
          const batches = page.batches || [{ key: 'main', rows: page.rows, hasMore: page.hasMore }];
          for (const batch of batches) if (batch.key === 'a') for (const r of batch.rows) {
            preferred.set(r._id, { ...preferred.get(r._id), ...listPriority(r) });
          }
          for (const batch of batches) {
            // 每个来源独立确认到达旧记录/日期边界，避免 A 的排序提前截断 B。
            const hit = opts.mode === 'inc' && batch.rows.some(r => known.has(r._id));
            const cutHit = opts.cutoffTs && batch.rows.some(r => r._ts && r._ts < opts.cutoffTs);
            if (!batch.hasMore || hit || cutHit) reached[batch.key] = true;
          }
          let cutoffHit = false;
          for (const r of page.rows) {
            Object.assign(r, preferred.get(r._id));
            if (opts.cutoffTs && r._ts && r._ts < opts.cutoffTs) {
              const oldSeen = seen.find(old => old._id === r._id);
              if (oldSeen) absorb(oldSeen, r); else seen.push(r);
              cutoffHit = true; continue;
            }
            // 一页全部处理：同一秒发布的新 BV、置顶或回填的旧日期稿件均不会直接漏掉。
            const old = byId.get(r._id);
            if (old) absorb(old, r); else { byId.set(r._id, r); rows.push(r); }
          }
          if (rows.length) stat.reached = rows[rows.length - 1].发布日期;
          if (!cutoffHit) donePages = pn;
          if (!page.hasMore || !page.rows.length) reason = 'end';
          else if (batches.every(x => reached[x.key])) reason = opts.mode === 'inc' ? 'known' : 'cutoff';
          if (!reason) pn++;
          save(!!reason);
          onProgress(rows.length, stat, '');
        }
        if (!reason) { reason = 'limit'; save(false); }
      } catch (e) {
        if (!sameAccountContext(task.context)) throw e;
        if (e.name === 'AbortError') { reason = 'stopped'; save(false); }
        else { save(false); throw e; }
      }
      return { rows, seen, stat, donePages, startPn, reason, context: task.context, stopped: reason === 'stopped' || reason === 'limit' };
    });
  }

  /* ---- 第 2 步：补详情。每条一个请求，抓完立刻写回库，中断也不丢 ---- */

  /**
   * 用 bvid 换 cid（只在列表没给 videos/cid_list 时才走）。
   * 换到的 cid 会跟着 enrich 的结果写进库，所以同一条最多问这一次。
   */
  async function fetchArcCid(bvid) {
    const url = `${API_ARC_VIEW}?bvid=${encodeURIComponent(bvid)}&tmid=&${cacheBust()}`;
    const d = await getJson(url);
    return cidOf(d);
  }

  /**
   * 平均播放进度 / 完播率 / 同类完播率 —— 「播放分析」页背后的那个接口。
   * ⚠ 入参是 cid 不是 bvid，这是它和其它接口最不一样的地方。
   * ⚠ 别碰 duration_info.avg_play_time / avg_play_time_int：名字最像
   *   「平均播放时长」，实测是 "-" 和 0，是空的。真正的数在 quit_info 里。
   * 万分数：full_play_ratio 2933 = 29.33%，和列表接口一个写法，一律 ÷100。
   * 自洽性核对过：avg_play_progress 176 ÷ duration 601 = 29.28%，
   * 和 full_play_ratio 给的 29.33% 差 0.05 个百分点 —— 两个字段说的是同一件事，
   * 所以 avg_play_progress 的单位就是秒。
   * viewer_quit 那条 21~30 个点的留存曲线故意不存：763 条稿件全存下来会把
   * localStorage 撑爆，而且表格里也放不下。要看曲线还是去页面上看。
   */
  async function fetchArcGraph(cid) {
    const url = `${API_ARC_GRAPH}?cid=${encodeURIComponent(cid)}&tmid=&${cacheBust()}`;
    const d = await getJson(url);
    const q = d.quit_info || {};
    const avg = numStr(q.avg_play_progress);
    // 又一次「别让粗的盖掉细的」：这条稿件的播放分析还没算出来时，quit_info 整个是空的，
    // 里面的 full_play_ratio 也就跟着是 0。那个 0 不是「完播率为零」，是「不知道」——
    // 拿它去盖抓列表时白拿到的那个真完播率，就是把已有的数据抹成假的 0。
    // 所以整组数据一荣俱荣：avg_play_progress 有值才认，没值就一个都不取。
    if (avg === '' || num(avg) <= 0) return { _progNA: 1 };

    const out = { _progSec: avg, _progNA: 0 };
    const fp = numStr(q.full_play_ratio);
    const pa = numStr(q.full_play_ratio_avg);
    if (fp !== '') out._finishPct = String(num(fp) / 100);
    if (pa !== '') out._peerFinish = String(num(pa) / 100);
    // pass_peer（3898）看着像「超过同类 38.98%」，但接口没说清楚，
    // 所以只存不导出。哪天确认了含义，加一行 schema 就能用，不用重抓。
    out._passPeer = numStr(q.pass_peer);
    // graph 自带时长，而且和列表那份是同一个数。列表没给时长时正好补上。
    const dur = numStr(q.duration);
    if (dur !== '' && num(dur) > 0) { out._durSec = dur; out._durGuess = 0; }
    return out;
  }

  /**
   * 退粉 / 充电 / 总播放时长。默认不发这个请求 —— 勾了「顺便补退粉/充电」才发。
   * ⚠ 只取列表拿不到的那几项。play/like/fav 那些故意不覆盖：列表接口给的是
   *   real_stat（活的那份），而这个响应里 stat.pubtime 和 stat.log_date 实测都是 0，
   *   说明它有一部分字段根本没填 —— 拿它去盖列表的数字，就是又一次「粗的盖细的」。
   * ⚠ 它的 play_avg_duration 实测恒为 0（archive_diagnose/grey 里
   *   play_analysis_offline_data_ready=false）。6.0 把它当平均播放进度用了，
   *   那是错的：平均播放进度在 graph 的 quit_info.avg_play_progress 上。这儿绝不取它。
   */
  async function fetchArcOverview(bvid) {
    const url = `${API_ARC_OVERVIEW}?bvid=${encodeURIComponent(bvid)}&tmid=&${cacheBust()}`;
    const d = await getJson(url);
    const S = d.stat || {};
    const out = {
      退粉: numStr(S.unfollow),
      充电: numStr(S.elec),
      _totalWatch: numStr(S.total_duration),
    };
    return { ...out, _overviewV: OVERVIEW_V, _overviewAt: stampNow(),
      _overviewNA: out.退粉 === '' || out.充电 === '' ? 1 : 0 };
  }

  /**
   * 补一条稿件的详情。
   * 只补尚未获取的指标组。调用者可通过 onGroup 逐组保存，后续请求失败不会丢掉已取得结果。
   * 没有 cid 时先查询；合法响应未给数字也记录已尝试，失败/中止不记完成。
   */
  async function enrichArc(r, opts, onGroup = () => {}) {
    const withOverview = !!(opts && opts.overview);
    const out = {};
    const accept = (group, fields) => {
      assertTask();
      onGroup(group, fields);
      Object.assign(out, fields);
    };
    if (!detailDone(r)) {
      // getJson 按实际请求计数；查询 cid 也计入等待和长休息。
      let cid = cell(r._cid);
      if (!cid) {
        const got = await fetchArcCid(r._bv);
        accept('cid', got);
        cid = cell(got._cid);
      }
      const graph = cid ? await fetchArcGraph(cid) : { _progNA: 1 };
      accept('graph', { ...graph, _detail: 1, _detailV: DETAIL_V, 详情时间: stampNow() });
    }
    if (withOverview && !overviewDone(r)) {
      const overview = await fetchArcOverview(r._bv);
      accept('overview', { ...overview, 详情时间: overview._overviewAt });
    }
    return out;
  }

  async function enrichOne(r, opts, onGroup) {
    if (!r._bv) throw new Error('没有 BV 号');
    return enrichArc(r, opts, onGroup);
  }

  /**
   * 详情逐篇保存且写后核验，只有保存成功才累计完成；请求节奏统一由 getJson 管理。
   */
  async function crawlDetails(todo, onProgress = () => {}, opts = {}) {
    return withTask(async task => {
      let done = 0, failed = 0, stopped = false;
      let detailNA = 0, overviewNA = 0, graphDone = 0, overviewDoneCount = 0;
      const fails = [];
      task.onTip = tip => onProgress(done, todo.length, failed, tip);
      for (const r of todo) {
        const current = lib.read().rows.find(row => row._id === r._id);
        if (!current) throw new Error('待更新的稿件已不存在，已停止；未累计成功数。');
        const save = (group, fields) => {
          assertTask(task);
          try {
            if (Object.keys(fields).length && !lib.patch(r._id, fields))
              throw new Error('待更新的稿件已不存在，已停止；未累计成功数。');
          } catch (e) { e.detailWrite = true; throw e; }
          if (group === 'graph') { graphDone++; if (fields._progNA) detailNA++; }
          if (group === 'overview') { overviewDoneCount++; if (fields._overviewNA) overviewNA++; }
        };
        try { assertTask(task); await enrichOne(current, opts, save); assertTask(task); }
        catch (e) {
          if (e.name === 'AbortError') { stopped = true; break; }
          if (e.detailWrite || !sameAccountContext(task.context) || /限流|登录|网络|HTTP|结构异常/.test(e.message)) throw e;
          failed++; fails.push(cut(r.标题, 20) + '：' + e.message);
          onProgress(done, todo.length, failed, '');
          continue;
        }
        done++;
        onProgress(done, todo.length, failed, '');
      }
      return { done, failed, fails, total: todo.length, stopped, requests: task.requests,
        detailNA, overviewNA, graphDone, overviewDone: overviewDoneCount };
    }, undefined, opts.timing);
  }

  /**
   * 稿件页「获取实时数据」。只改点击时勾选且仍在库中的行。
   * 列表接口没有已验证的按 BV 查询参数，因此翻页查找，但只保存目标稿件。
   * 各来源找到全部目标后独立停止；不依赖抓列表配置，也不读写列表断点。
   */
  async function refreshSelected(todo, onProgress = () => {}, opts = {}) {
    const ids = new Set((todo || []).map(r => r._id));
    const targets = lib.read().rows.filter(r => ids.has(r._id) && detailable(r)).map(r => ({ ...r }));
    const result = { total: targets.length, listDone: 0, detailDone: 0, missing: 0,
      detailNA: 0, overviewNA: 0, failed: 0, stopped: false, requests: 0, errors: [] };
    if (!targets.length) return result;

    return withTask(async task => {
      const byBV = new Map();
      for (const row of targets) {
        if (!byBV.has(row._bv)) byBV.set(row._bv, []);
        byBV.get(row._bv).push(row._id);
      }
      const found = { a: new Set(), b: new Set() };
      const preferred = new Map();
      const sources = [
        { key: 'a', fetch: fetchArcA, map: mapArcA, done: false },
        { key: 'b', fetch: fetchArcB, map: mapArcB, done: false },
      ];
      const report = tip => {
        result.requests = task.requests;
        result.listDone = targets.filter(r => found.a.has(r._bv) && found.b.has(r._bv)).length;
        onProgress({ ...result }, tip || '');
      };
      task.onTip = report;
      const save = (id, fields) => {
        assertTask(task);
        // 保持本地行身份，尤其是由旧版按标题建立、后来才补到 BV 的记录。
        const patch = { ...fields }; delete patch._id;
        if (!lib.patch(id, patch)) throw new Error('勾选的稿件已不存在，已停止获取。');
      };

      try {
        for (let pn = 1; sources.some(s => !s.done); pn++) {
          if (pn > MAX_PAGES) throw new Error('已到列表翻页上限，已取得的数据已保存；请稍后重试。');
          for (const source of sources) {
            if (source.done) continue;
            assertTask(task);
            report(`查找勾选稿件 · 列表 ${source.key.toUpperCase()} 第 ${pn} 页`);
            const page = await source.fetch(pn);
            assertTask(task);
            const rows = page.list.map(source.map);
            if (rows.some(r => !r)) throw new Error('列表条目结构异常，已停止获取。');
            for (const row of rows) {
              const targetIds = byBV.get(row._bv);
              if (!targetIds) continue;
              if (source.key === 'a') preferred.set(row._bv, {
                ...preferred.get(row._bv), ...listPriority(row),
              });
              const fields = { ...row, ...preferred.get(row._bv) };
              for (const id of targetIds) save(id, fields);
              found[source.key].add(row._bv);
            }
            source.done = found[source.key].size === byBV.size || pn >= page.pages;
            report(`列表 ${source.key.toUpperCase()} 第 ${pn} 页已保存`);
          }
        }
        result.missing = targets.length - result.listDone;

        for (const row of targets) {
          assertTask(task);
          report(`获取详情 ${result.detailDone + 1}/${targets.length} · ${cut(row.标题, 16)}`);
          // 视频替换后 cid 可能变化，实时刷新始终重新查询，不用库里的旧 cid。
          const current = await fetchArcCid(row._bv);
          assertTask(task);
          if (current._cid) {
            save(row._id, current);
            const graph = await fetchArcGraph(current._cid);
            save(row._id, { ...graph, _detail: 1, _detailV: DETAIL_V, 详情时间: stampNow() });
            if (graph._progNA) result.detailNA++;
          } else {
            // 不拿旧 cid 请求旧视频的数据；已有详情值保留，明确标记本次未取得。
            save(row._id, { _progNA: 1 });
            result.detailNA++;
          }
          // 稿件页此按钮固定刷新全部指标，不受抓取页「顺便补退粉/充电」影响。
          const overview = await fetchArcOverview(row._bv);
          save(row._id, { ...overview, 详情时间: overview._overviewAt });
          if (overview._overviewNA) result.overviewNA++;
          result.detailDone++;
          report('本条已保存');
        }
      } catch (err) {
        result.requests = task.requests;
        if (err.name === 'AbortError' && sameAccountContext(task.context)) {
          result.stopped = true;
          report('已停止，已取得的数据已保存');
          return result;
        }
        result.failed++;
        result.errors.push(String(err.message || err));
        err.refreshResult = { ...result };
        throw err;
      }
      result.requests = task.requests;
      return result;
    }, undefined, opts.timing);
  }

  /* ==========================================================================
   * 完整备份与补回缺失稿件：保留原始字段和进度，已有稿件不覆盖
   * ========================================================================== */
  const BACKUP_FORMAT = 'bili-arc-backup';
  const BACKUP_FORMAT_VERSION = 1;
  const RESTORE_SAFETY_KEY = 'bili_arc_restore_safety_v1';
  const backupObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const backupClone = value => JSON.parse(JSON.stringify(value));
  const backupRowId = row => String(row && row._id || '').trim();
  const backupState = value => JSON.stringify({
    account: { id: value.account.id, name: value.account.name },
    library: value.library, pending: value.pending,
  });

  function validateBackup(input, currentAccountId) {
    const errors = [], warnings = [];
    const fail = message => { if (errors.length < 30) errors.push(message); };
    const counter = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
    const metric = value => (typeof value === 'number' && Number.isFinite(value))
      || (typeof value === 'string' && (value === '' || (!!value.trim() && Number.isFinite(Number(value.replace(/,/g, ''))))));
    const rowsCheck = (rows, label) => {
      if (!Array.isArray(rows)) { fail(`${label}必须是数组`); return; }
      const ids = new Set();
      rows.forEach((row, index) => {
        const at = `${label}第 ${index + 1} 条`;
        if (!backupObject(row)) { fail(`${at}格式错误`); return; }
        const id = backupRowId(row);
        if (typeof row._id !== 'string' || !id) fail(`${at}缺少有效稿件 ID`);
        else if (ids.has(id)) fail(`${at}稿件 ID 重复`);
        else ids.add(id);
        if (row._tags != null && (!Array.isArray(row._tags) || row._tags.some(t => typeof t !== 'string')))
          fail(`${at}标签应为字符串数组`);
        if (row._ts != null && !counter(row._ts)) fail(`${at}发布时间戳无效`);
        if (row._overviewV != null && (!Number.isInteger(row._overviewV) || row._overviewV < 1))
          fail(`${at}退粉/充电获取版本无效`);
        if (row._overviewAt != null && (typeof row._overviewAt !== 'string'
          || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(row._overviewAt)
          || !Number.isFinite(Date.parse(row._overviewAt.replace(' ', 'T')))))
          fail(`${at}退粉/充电获取时间无效`);
        if (row._overviewNA != null && row._overviewNA !== 0 && row._overviewNA !== 1)
          fail(`${at}退粉/充电缺失状态无效`);
        for (const key of ['标题', '链接', '发布日期', '发布时间', '_bv'])
          if (row[key] != null && typeof row[key] !== 'string') fail(`${at}的 ${key} 应为文字`);
        for (const key of ['播放量', '点赞', '收藏', '评论', '投币', '转发', '弹幕', '涨粉', '退粉', '充电',
          '_durSec', '_progSec', '_progPct', '_finishPct', '_peerFinish', '_passPeer', '_totalWatch'])
          if (row[key] != null && !metric(row[key])) fail(`${at}的 ${key} 应为数字或空值`);
        if (row._bv && id.indexOf('bv:') === 0 && id !== 'bv:' + row._bv.trim())
          fail(`${at}稿件 ID 与 BV 号不一致`);
      });
    };
    if (!backupObject(input)) return { valid: false, errors: ['备份应为 JSON 对象'], warnings, summary: null };
    if (input.format !== BACKUP_FORMAT) fail('不是 B 站稿件完整备份文件');
    if (input.formatVersion !== BACKUP_FORMAT_VERSION) fail('备份格式版本不受支持');
    if (typeof input.scriptVersion !== 'string' || !input.scriptVersion.trim()) fail('缺少脚本版本');
    if (typeof input.exportedAt !== 'string' || !Number.isFinite(Date.parse(input.exportedAt))) fail('导出时间无效');
    const account = input.account;
    if (!backupObject(account) || typeof account.id !== 'string' || !/^[1-9]\d*$/.test(account.id)
      || typeof account.name !== 'string') fail('缺少有效的账号 UID / 名称');
    else if (currentAccountId && account.id !== String(currentAccountId)) fail('备份账号与当前登录账号不同，不能补回');
    if (!backupObject(input.library)) fail('缺少稿件库');
    else {
      rowsCheck(input.library.rows, '稿件库');
      if (input.library.donePn != null && (!Number.isInteger(input.library.donePn) || input.library.donePn < 0))
        fail('稿件库覆盖页码无效');
      if (input.library.acctId != null && account && String(input.library.acctId) !== account.id)
        fail('稿件库账号与备份账号不一致');
    }
    if (input.pending != null) {
      if (!backupObject(input.pending) || input.pending.kind !== 'list') fail('未完成进度格式错误');
      else {
        rowsCheck(input.pending.rows, '进度暂存稿件');
        for (const key of ['seen', 'fresh']) {
          if (input.pending[key] != null) rowsCheck(input.pending[key], `进度 ${key}`);
        }
        if (input.pending.acctId != null && account && String(input.pending.acctId) !== account.id)
          fail('进度账号与备份账号不一致');
        warnings.push('备份中的未完成进度仅保留在文件中；补回只处理主库，不接管进度');
      }
    }
    return {
      valid: !errors.length, errors, warnings,
      summary: errors.length ? null : {
        accountId: account.id, accountName: account.name,
        rows: input.library.rows.length,
        pendingRows: input.pending ? input.pending.rows.length : 0,
      },
    };
  }

  function createAccountBackup() {
    const context = accountContext();
    if (!context.id || context.id === 'unknown') throw new Error('尚未识别登录账号，请登录后再备份');
    const library = readStoredJson(scopedKey(LIB_KEY, context), { rows: [], donePn: 0, at: 0 });
    const pending = readStoredJson(scopedKey(PROG_KEY, context), null);
    if (!sameAccountContext(context)) throw new Error('账号或登录会话已变化，请重新打开数据管理');
    const backup = {
      format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION,
      scriptVersion: '6.5.7', exportedAt: new Date().toISOString(),
      account: { id: context.id, name: context.name || context.id },
      library, pending,
    };
    const checked = validateBackup(backup, context.id);
    if (!checked.valid) throw new Error('当前数据不能生成有效备份：' + checked.errors.join('；'));
    return backupClone(backup);
  }

  // 库格式损坏时保留原始字符串供排查，不伪装成可补回的正常备份。
  function createRawRecoveryExport() {
    const context = accountContext();
    if (!context.id || !sameAccountContext(context)) throw new Error('未识别当前账号或登录会话已变化');
    const values = {};
    for (const [label, key] of [['library', LIB_KEY], ['pending', PROG_KEY], ['safety', RESTORE_SAFETY_KEY],
      ['legacySafety', LEGACY_SAFETY_KEY], ['legacyClaim', LEGACY_CLAIM_KEY]])
      values[label] = rawRead(scopedKey(key, context), null);
    if (!sameAccountContext(context)) throw new Error('账号或登录会话已变化，请重试');
    return {
      format: 'bili-arc-raw-recovery', formatVersion: 1, exportedAt: new Date().toISOString(),
      account: { id: context.id, name: context.name || context.id }, values,
    };
  }

  function backupFileName(backup) {
    const safe = value => String(value).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 70);
    return `B站稿件完整备份-${safe(backup.account.name)}-${safe(backup.account.id)}-${dateStamp()}.json`;
  }

  function planBackupRestore(input) {
    if (running || collecting) throw new Error('请先停止采集，再预览补回');
    const context = accountContext();
    const checked = validateBackup(input, context.id);
    if (!checked.valid) throw new Error(checked.errors.join('；'));
    const current = createAccountBackup();
    const ids = new Set(current.library.rows.map(backupRowId));
    const missing = input.library.rows.filter(row => !ids.has(backupRowId(row)));
    const existing = input.library.rows.length - missing.length;
    const sourceIds = new Set(input.library.rows.map(backupRowId));
    return {
      backup: backupClone(input), context: { ...context }, base: backupState(current),
      missing: backupClone(missing), existing,
      currentOnly: current.library.rows.filter(row => !sourceIds.has(backupRowId(row))).length,
      warnings: checked.warnings,
    };
  }

  function applyBackupRestore(plan) {
    if (running || collecting) throw new Error('请先停止采集，再补回缺失稿件');
    if (!plan || !backupObject(plan.backup)) throw new Error('请先导入并预览备份');
    const context = plan.context;
    const ensureContext = () => {
      if (!sameAccountContext(context)) throw new Error('账号或登录会话已变化，请重新预览');
    };
    ensureContext();
    const current = createAccountBackup();
    if (backupState(current) !== plan.base) throw new Error('当前稿件库或进度已变化，请重新预览后再补回');
    // 重新计算差集，避免预览对象被修改后直接成为写入来源。
    const checked = validateBackup(plan.backup, context.id);
    if (!checked.valid) throw new Error(checked.errors.join('；'));
    const ids = new Set(current.library.rows.map(backupRowId));
    const missing = plan.backup.library.rows.filter(row => !ids.has(backupRowId(row)));
    if (!missing.length) return { added: 0, total: current.library.rows.length };
    const next = backupClone(current.library);
    // 补入较新的稿件不能成为下一轮增量的提前停止点；多次补回沿用最初基线。
    const baseline = current.library.restoreKnownIds;
    next.restoreKnownIds = Array.isArray(baseline) && baseline.every(id => typeof id === 'string' && id.trim())
      ? baseline.slice() : current.library.rows.map(backupRowId);
    next.rows = next.rows.concat(backupClone(missing).map(row => ({ ...row, _id: backupRowId(row) })))
      .sort((a, b) => (b._ts || 0) - (a._ts || 0));
    next.at = Date.now();
    const safetyKey = scopedKey(RESTORE_SAFETY_KEY, context);
    const safety = JSON.stringify(current);
    ensureContext();
    requiredWrite(safetyKey, safety);
    if (JSON.stringify(readStoredJson(safetyKey, null)) !== safety)
      throw new Error('恢复前保护副本核验失败，尚未写入稿件库');
    ensureContext();
    if (backupState(createAccountBackup()) !== plan.base)
      throw new Error('保存保护副本期间稿件库或进度已变化，请重新预览');
    const serialized = JSON.stringify(next);
    requiredWrite(scopedKey(LIB_KEY, context), serialized);
    ensureContext();
    if (JSON.stringify(readStoredJson(scopedKey(LIB_KEY, context), null)) !== serialized)
      throw new Error('稿件库写入后核验失败，未确认补回成功；保护副本已保留，请检查后重新预览');
    if (JSON.stringify(readStoredJson(scopedKey(PROG_KEY, context), null)) !== JSON.stringify(current.pending))
      throw new Error('补回期间抓取进度发生变化，请检查当前数据；保护副本已保留');
    ensureContext();
    return { added: missing.length, total: next.rows.length };
  }

  function mountDataManager() {
    if (!ui || ui.root.querySelector('[data-backup-panel]')) return;
    const toggle = document.createElement('button');
    toggle.className = 'data-toggle';
    toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></svg>';
    toggle.title = '数据管理：完整备份与补回缺失稿件';
    toggle.setAttribute('aria-label', '数据管理');
    toggle.setAttribute('aria-expanded', 'false');
    ui.root.querySelector('.hd-account').appendChild(toggle);
    const panel = document.createElement('div');
    panel.setAttribute('data-backup-panel', '');
    panel.hidden = true;
    panel.className = 'data-manager';
    panel.innerHTML = `
      <h2 class="data-heading">数据管理</h2><div class="backup-account" data-backup-account></div>
      <div class="backup-summary" data-library-summary></div>
      <div class="backup-actions backup-file-actions">
        <button type="button" data-backup-export>导出完整备份</button>
        <button type="button" data-backup-import>导入备份文件</button>
        <button type="button" data-backup-raw hidden>导出原始数据</button>
      </div>
      <div class="cbar data-maintenance"><button data-act="claim-legacy" title="补回旧稿件、空字段和标签，保留当前数据与进度">认领旧库</button><button data-act="lib-clear">清空稿件库</button></div>
      <div class="backup-summary">已抓过数据也可认领旧库；首次认领前自动保存保护副本。</div>
      <input type="file" accept=".json,application/json" data-backup-file hidden>
      <div data-backup-status role="status" style="white-space:pre-wrap;margin-top:8px;line-height:1.6"></div>
      <div class="backup-actions"><button type="button" data-backup-apply disabled style="margin-top:8px">补回缺失稿件</button></div>`;
    ui.root.querySelector('[data-view="rows"]').prepend(panel);
    const find = selector => panel.querySelector(selector);
    const file = find('[data-backup-file]');
    const status = find('[data-backup-status]');
    const apply = find('[data-backup-apply]');
    const rawExport = find('[data-backup-raw]');
    let plan = null, serial = 0;
    const message = (text, error = false) => {
      status.textContent = text;
      status.style.color = error ? '#b91c1c' : '#475569';
    };
    const reset = () => { plan = null; apply.disabled = true; serial++; file.value = ''; };
    toggle.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
      reset();
      if (panel.hidden) return;
      selectTab('rows'); ui.body.scrollTop = 0;
      const context = accountContext();
      find('[data-backup-account]').textContent = `B站稿件 · ${context.name || context.id}`;
      rawExport.hidden = true;
      try { renderLibrarySummary(); message('完整备份包含全库、标签和未完成进度。补回时保留已有稿件及当前进度。'); }
      catch (error) { rawExport.hidden = false; message(error.message + '\n可先导出原始数据排查。', true); }
    });
    find('[data-backup-import]').addEventListener('click', () => {
      reset();
      if (running || collecting) { message('请先停止采集，再导入备份', true); return; }
      file.click();
    });
    find('[data-backup-export]').addEventListener('click', () => {
      try {
        const backup = createAccountBackup();
        download(backupFileName(backup), JSON.stringify(backup, null, 2), 'application/json');
        rawExport.hidden = true;
        message(`已导出 ${backup.library.rows.length} 条稿件${backup.pending ? '及未完成进度' : ''}`);
      } catch (error) {
        rawExport.hidden = false;
        message(error.message + '\n可使用“导出原始数据”保留当前存储供排查，该文件不能直接补回。', true);
      }
    });
    rawExport.addEventListener('click', () => {
      try {
        const raw = createRawRecoveryExport();
        download(`B站稿件原始数据-${raw.account.id}-${dateStamp()}.json`, JSON.stringify(raw, null, 2), 'application/json');
        message('已导出当前账号的原始存储供排查；该文件不是完整备份，不能直接导入补回。');
      } catch (error) { message(error.message, true); }
    });
    file.addEventListener('change', async () => {
      const selected = file.files && file.files[0];
      if (!selected) return;
      const token = ++serial, context = accountContext();
      plan = null; apply.disabled = true;
      try {
        if (selected.size > 50 * 1024 * 1024) throw new Error('备份超过 50 MB，请检查是否选对文件');
        const text = await readFileText(selected);
        if (token !== serial) return;
        if (!sameAccountContext(context)) throw new Error('账号或登录会话已变化，请重新导入');
        let value;
        try { value = JSON.parse(text); } catch (_) { throw new Error('文件不是有效 JSON，未修改稿件库'); }
        plan = planBackupRestore(value);
        const preview = plan.missing.slice(0, 8).map(row => `· ${row.标题 || row._id}`).join('\n');
        message(`校验通过：备份 ${value.library.rows.length} 条；可补回 ${plan.missing.length} 条，已有 ${plan.existing} 条保持原样，当前库独有 ${plan.currentOnly} 条保留。`
          + (plan.warnings.length ? '\n' + plan.warnings.join('\n') : '')
          + (preview ? '\n待补回：\n' + preview + (plan.missing.length > 8 ? '\n…' : '') : ''));
        apply.textContent = `补回 ${plan.missing.length} 条缺失稿件`;
        apply.disabled = !plan.missing.length;
      } catch (error) { if (token === serial) { plan = null; message(error.message, true); } }
    });
    apply.addEventListener('click', () => {
      try {
        const result = applyBackupRestore(plan);
        reset();
        refresh();
        message(`已补回 ${result.added} 条稿件，当前共 ${result.total} 条。恢复前保护副本已保存。`);
      } catch (error) { reset(); message(error.message, true); }
    });
  }

  /* ==========================================================================
   * 13. 导出
   * ========================================================================== */
  const headerFor = () => activeSchema().map(headerName);

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
    return '﻿' + [sc.map(c => q(headerName(c))).join(',')]
      .concat(rows.map(r => sc.map(c => q(cellOf(r, c))).join(',')))
      .join('\r\n');
  }

  function download(name, text, mime) {
    const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function copyText(text) {
    if (typeof GM_setClipboardText === 'function') {
      try { GM_setClipboardText(text); return Promise.resolve(true); } catch (e) { /* next */ }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => legacyCopy(text));
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  const dateStamp = () => { const d = new Date(); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; };

  /* ==========================================================================
   * 14. 面板
   * --------------------------------------------------------------------------
   * 用 Shadow DOM + `:host { all: initial }`。旧脚本靠一长串 inline style 硬顶
   * B 站页面的全局 CSS，加个类名就可能被污染；Shadow DOM 是一次性解决。
   * 配色沿用旧脚本那套（中性灰 + 单一强调色 #0071e3），只有骨架换了。
   * ========================================================================== */
  const BILIBILI_MARK = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" fill="currentColor"><path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z"/></svg>`;

  const CSS = `
    :host { all:initial;
      --bili-primary:#00A1D6; --bili-hover:#008DBB; --bili-ink:#007EA8;
      --bili-tint:#F0FAFF; --bili-border:#B8E3F1; }
    .wrap { position:fixed; right:20px; bottom:20px; z-index:2147483600; box-sizing:border-box;
      width:min(360px, calc(100vw - 24px));
      font:13px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif; color:#1f2329;
      background:#fff; border:1px solid #e3e5e8; border-radius:16px;
      box-shadow:0 14px 38px rgba(16,49,66,.16),0 2px 8px rgba(16,49,66,.06); overflow:hidden; }
    .hd { display:flex; align-items:center; gap:8px; padding:10px 12px; background:var(--bili-primary); color:#fff;
      cursor:move; user-select:none; touch-action:none; }
    .hd-account { display:flex; align-items:center; gap:6px; flex:1; min-width:0; }
    .brand-icon { display:grid; place-items:center; flex:none; color:#fff; }
    .brand-icon svg { display:block; width:16px; height:16px; }
    .hd b { font-size:13px; font-weight:600; flex:0 1 auto; min-width:0;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .hd button { all:unset; flex:none; cursor:pointer; padding:0 6px; font-size:15px; line-height:1; opacity:.9; }
    .hd button:hover { opacity:1; }
    .bd { box-sizing:border-box; padding:12px;
      height:max(0px, min(470px, calc(80vh - 40px), calc(100vh - 182px - var(--bili-status-extra, 0px))));
      overflow-y:auto; scrollbar-gutter:stable; }
    .bd.cols-active { display:flex; flex-direction:column; }
    .bd.cols-active [data-view="cols"] { display:flex; flex:1; flex-direction:column; min-height:0; }
    .wrap.is-morphing .bd.cols-active { display:flex; }
    .wrap button:focus-visible { outline:2px solid var(--bili-primary); outline-offset:3px; }
    .hd button:focus-visible { outline-color:#fff; }

    /* 收起后只保留可拖动、可点击的玻璃质感入口。图形不参与背景模糊。 */
    .launcher { display:none; }
    .wrap.is-collapsed { width:64px; height:64px; border:0; border-radius:22px;
      background:transparent; box-shadow:none; overflow:visible; }
    .wrap.is-collapsed .hd, .wrap.is-collapsed .tabs, .wrap.is-collapsed .bd,
    .wrap.is-collapsed .st { display:none; }
    .wrap.is-collapsed .launcher, .wrap.is-morphing .launcher { all:unset; box-sizing:border-box; position:relative;
      display:grid; place-items:center; width:64px; height:64px; border-radius:22px;
      border:1px solid rgba(255,255,255,.92); cursor:pointer; touch-action:none;
      background:linear-gradient(145deg,rgba(255,255,255,.89),rgba(230,248,255,.66) 58%,rgba(213,242,253,.68));
      box-shadow:inset 0 1px 1px rgba(255,255,255,.98),inset 0 -1px 2px rgba(0,161,214,.12),
        0 12px 30px rgba(0,64,89,.19),0 2px 6px rgba(0,44,65,.08);
      -webkit-backdrop-filter:blur(18px) saturate(180%);
      backdrop-filter:blur(18px) saturate(180%);
      -webkit-tap-highlight-color:transparent;
      transition:transform .24s cubic-bezier(.2,.8,.2,1),box-shadow .24s ease; }
    .launcher::before { content:""; position:absolute; inset:1px; border-radius:21px;
      background:linear-gradient(145deg,rgba(255,255,255,.85),transparent 43%,rgba(255,255,255,.15) 80%);
      pointer-events:none; }
    .launcher::after { content:""; position:absolute; inset:1px; border-radius:21px;
      box-shadow:inset 1px 1px 0 rgba(255,255,255,.9),inset -1px -1px 0 rgba(0,161,214,.2);
      pointer-events:none; }
    .launcher svg { width:40px; height:40px; color:var(--bili-primary); position:relative; z-index:1;
      transition:transform .24s cubic-bezier(.2,.8,.2,1); }
    .wrap.is-collapsed .launcher:hover { transform:translateY(-2px) scale(1.03);
      box-shadow:inset 0 1px 1px rgba(255,255,255,.98),0 16px 34px rgba(0,91,124,.24),
        0 3px 9px rgba(0,44,65,.1); }
    .launcher:hover svg { transform:translateY(-1px); }
    .wrap.is-collapsed .launcher:active { transform:scale(.96); }
    .wrap.is-collapsed .launcher:focus-visible { outline:3px solid var(--bili-primary); outline-offset:4px; }
    /* 过渡时固定内容宽度，只改变外壳尺寸；文字不会跟着拉伸或反复换行。 */
    .wrap.is-morphing { overflow:hidden; border-style:solid; }
    .wrap.is-morphing::after { content:""; position:absolute; inset:0; z-index:3;
      background:rgba(255,255,255,.001); }
    .wrap.is-morphing .hd { display:flex; box-sizing:border-box; width:var(--mp-open-width); }
    .wrap.is-morphing .tabs { display:grid; box-sizing:border-box; width:var(--mp-open-width); }
    .wrap.is-morphing .bd { display:block; width:var(--mp-open-width); }
    .wrap.is-morphing .st { display:flex; width:var(--mp-open-width); }
    .wrap.is-morphing .launcher { position:absolute; right:0; bottom:0; transition:none; }
    .wrap.is-morphing .launcher:hover, .wrap.is-morphing .launcher:active,
    .wrap.is-morphing .launcher svg { transform:none; }
    @media (prefers-reduced-motion: reduce) {
      .wrap.is-collapsed .launcher, .launcher svg { transition:none; }
      .wrap.is-collapsed .launcher:hover, .wrap.is-collapsed .launcher:active,
      .launcher:hover svg { transform:none; }
    }

    /* 标签 JSON 导入 */
    .imp { margin:0 0 9px; padding:9px; border:1px solid #D9EAF1;
      border-radius:8px; background:#FAFDFF; }
    .imp-heading { margin:0 0 7px; font-size:11.5px; font-weight:600; color:#416778; }
    .imp textarea { width:100%; box-sizing:border-box; height:96px; resize:vertical;
      padding:6px 8px; border:1px solid #dee0e3; border-radius:5px;
      font:11px/1.5 ui-monospace,Menlo,Consolas,monospace; color:#1f2329; }
    .imp textarea:focus { outline:none; border-color:var(--bili-primary); }
    .improw { display:flex; align-items:center; gap:6px; margin:6px 0; font-size:11px; color:#8f959e; }
    .improw input[type=file] { flex:1; min-width:0; font-size:10.5px; color:#646a73; }
    /* 导入方式是「选项」，不能长得像动作按钮 ——
       之前选中态用了和主按钮一样的满绿，结果被当成「要点的那个」。 */
    .improw .rmode { display:inline-flex; align-items:center; gap:4px; cursor:pointer;
      font-size:11px; color:#646a73; }
    .improw .rmode input { margin:0; width:12px; height:12px; accent-color:var(--bili-primary); cursor:pointer; }
    .impprev { margin:6px 0; padding:7px 8px; border-radius:5px; font-size:10.5px; line-height:1.7;
      background:#f7f8fa; border:1px solid #eef0f2; color:#646a73; max-height:110px; overflow:auto; }
    .impprev.err { background:#fff1f0; border-color:#ffd6d3; color:#c9302c; }
    .impprev b { color:var(--bili-primary); font-weight:600; }
    .impprev .warn { color:#d9a03c; }

    .tabs { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); grid-auto-rows:54px; gap:5px;
      padding:8px 10px; background:#F7FAFC; border-bottom:1px solid #E4EDF1; }
    .tabs button { all:unset; box-sizing:border-box; min-width:0; height:54px; cursor:pointer;
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px;
      border:1px solid #E4EDF1; border-radius:10px; background:#fff;
      font-size:11px; line-height:1.2; color:#556872;
      transition:background .18s ease,color .18s ease,box-shadow .18s ease; }
    .tabs button svg { width:20px; height:20px; flex:none; fill:none; stroke:currentColor;
      stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .tabs button .tab-label { white-space:nowrap; }
    .tabs button:hover:not(.on) { background:var(--bili-tint); color:#006B8F; }
    .tabs button.on { color:var(--bili-ink); border-color:var(--bili-border); font-weight:600;
      box-shadow:0 2px 8px rgba(24,64,84,.09); }
    .tabs button.on svg { stroke:var(--bili-primary); }
    .tabs button:focus-visible { outline:2px solid var(--bili-primary); outline-offset:2px; }
    @media (prefers-reduced-motion: reduce) { .tabs button { transition:none; } }
    .view.hide { display:none; }

    .warnbar { padding:7px 9px; margin:0 0 10px; background:#fff8e6; border:1px solid #ffe1a8;
      border-radius:6px; font-size:11px; color:#8a6d3b; line-height:1.6; }
    .warnbar button { all:unset; cursor:pointer; font-size:11px; color:#8a6d3b;
      border:1px solid #e8c98a; border-radius:9px; padding:2px 9px; margin-right:6px; }
    .warnbar button:hover { border-color:var(--bili-primary); color:var(--bili-primary); }
    .acct { display:flex; align-items:center; gap:5px; margin:0 0 8px; font-size:11px; color:#646a73; }
    .acct .unknown { color:#d9a03c; }

    .modes { display:flex; gap:4px; margin:0 0 8px; }
    .modes button { all:unset; flex:1; box-sizing:border-box; text-align:center; cursor:pointer;
      padding:6px 2px; font-size:11.5px; color:#646a73; border:1px solid #dee0e3; border-radius:6px; }
    .modes button:hover { border-color:var(--bili-primary); }
    .modes button.on { background:var(--bili-primary); border-color:var(--bili-primary); color:#fff; }

    input[type=date],input[type=number] { box-sizing:border-box; padding:5px 7px; border:1px solid #dee0e3;
      border-radius:5px; font:inherit; font-size:12px; }
    input[type=date] { width:100%; }
    input[type=number] { width:64px; }
    input:focus { outline:none; border-color:var(--bili-primary); }
    .grab-date-line { display:flex; align-items:center; gap:8px; font-size:11.5px; color:#646a73; }
    .grab-date-line span { flex:none; }
    .grab-date-line input[type=date] { flex:1; min-width:0; width:auto; }
    .quick { display:flex; gap:6px; margin:6px 0 10px; }
    .quick button { all:unset; cursor:pointer; font-size:11px; color:#8f959e; padding:2px 7px;
      border:1px solid #dee0e3; border-radius:9px; }
    .quick button:hover { border-color:var(--bili-primary); color:var(--bili-primary); }

    .grab-switch { position:relative; display:grid; grid-template-columns:1fr 1fr; gap:0;
      box-sizing:border-box; padding:3px; margin:0 0 14px; border:1px solid #D9EAF1;
      border-radius:11px; background:#EDF7FB; isolation:isolate; }
    .grab-switch::before { content:""; position:absolute; top:3px; bottom:3px; left:3px;
      width:calc(50% - 3px); border-radius:8px; background:#fff;
      box-shadow:0 2px 6px rgba(16,53,74,.12),inset 0 1px rgba(255,255,255,.95);
      pointer-events:none; transition:transform .24s cubic-bezier(.2,.75,.25,1); }
    .grab-switch[data-view="detail"]::before { transform:translateX(100%); }
    .grab-switch button { all:unset; position:relative; z-index:1; box-sizing:border-box;
      padding:8px 4px; text-align:center; font-size:12px; color:#60717B; cursor:pointer;
      transition:color .24s ease; }
    .grab-switch button[aria-selected="true"] { color:var(--bili-ink); font-weight:600; }
    .grab-switch button:focus-visible { outline:2px solid var(--bili-primary); outline-offset:3px; border-radius:8px; }
    .grab-viewport { overflow:hidden; transition:height .24s cubic-bezier(.2,.75,.25,1); }
    .grab-track { display:flex; align-items:flex-start; width:200%;
      transition:transform .24s cubic-bezier(.2,.75,.25,1); }
    .grab-viewport[data-view="detail"] .grab-track { transform:translateX(-50%); }
    .grab-pane { box-sizing:border-box; flex:0 0 50%; width:50%; padding:1px 3px 4px; }
    .grab-run { display:block; margin:14px 0 0; }
    .btns.grab-run button { width:100%; padding:9px 4px; font-weight:600; }
    .grab-date-repair { margin:8px 0 0; }
    .grab-date-repair button { grid-column:1 / -1; }
    @media (prefers-reduced-motion: reduce) {
      .grab-switch::before, .grab-switch button, .grab-viewport, .grab-track { transition:none; }
    }
    .detail-pending { margin:0 0 6px; font-size:11px; color:#8f959e; }
    .detail-setting { display:flex; align-items:center; justify-content:space-between; gap:8px;
      min-height:34px; border-bottom:1px solid #f2f3f5; font-size:11.5px; color:#646a73; }
    .detail-setting:last-child { border-bottom:0; }
    .detail-setting > span { display:flex; align-items:center; gap:5px; }
    .detail-setting select { box-sizing:border-box; width:150px; max-width:65%; padding:5px 7px;
      border:1px solid #dee0e3; border-radius:5px; background:#fff; color:#1f2329;
      font:inherit; font-size:11px; cursor:pointer; }
    .detail-setting select:focus { outline:none; border-color:var(--bili-primary); }

    .resume { display:flex; align-items:center; gap:8px; margin:0 0 10px; padding:7px 9px;
      background:#fff8e6; border:1px solid #ffe1a8; border-radius:6px; font-size:11px; color:#8a6d3b; }
    .resume span { flex:1; }
    .resume button { all:unset; cursor:pointer; text-decoration:underline; flex:none; color:#8a6d3b; }
    .resume button:hover { color:var(--bili-primary); }

    .cols { margin:2px 0 8px; max-height:40vh; overflow:auto; }
    .cols-active .cols { flex:1; min-height:0; max-height:none; }
    .crow { display:flex; align-items:center; gap:6px; padding:5px 4px;
      border-bottom:1px solid #f2f3f5; font-size:12px; background:#fff; }
    .crow.calc { background:#F6FCFF; }
    .crow.drag { opacity:.45; }
    .grip { cursor:grab; color:#c9cdd4; font-size:12px; line-height:1; user-select:none;
      padding:2px 1px; letter-spacing:-1px; }
    .grip:active { cursor:grabbing; }
    .crow.calc .grip { color:#97D6EA; }
    .ck { margin:0; width:13px; height:13px; flex:none; cursor:pointer; accent-color:var(--bili-primary); }
    .cn { flex:1; color:#646a73; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .crow.calc .cn, .crow.calc .cv { color:var(--bili-primary); }
    .crow.off .cn, .crow.off .cv { color:#c9cdd4; }
    .cv { max-width:42%; text-align:right; font-weight:600; font-variant-numeric:tabular-nums;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .cv.miss { color:#d33; font-weight:400; }
    .cn .tag { font-size:9.5px; color:#c9cdd4; margin-left:3px; }
    .chip { all:unset; cursor:pointer; flex:none; font-size:10px; line-height:1;
      padding:2px 5px; border-radius:9px; border:1px solid #dee0e3; color:#8f959e; background:#fff; }
    .chip:hover { border-color:var(--bili-primary); color:var(--bili-primary); }
    .crow.calc .chip { border-color:#97D6EA; color:var(--bili-primary); }
    .sub { padding:7px 8px 8px 26px; background:#F6FCFF; border-bottom:1px solid #f2f3f5; }
    .sub .h { font-size:10.5px; color:#8f959e; margin-bottom:5px; }
    .sub .ops { display:flex; flex-wrap:wrap; gap:4px 10px; }
    .sub label { display:inline-flex; align-items:center; gap:4px; font-size:11.5px; color:#646a73; cursor:pointer; }
    .sub input { margin:0; width:12px; height:12px; accent-color:var(--bili-primary); cursor:pointer; }

    .cbar { display:flex; align-items:center; gap:8px; font-size:11px; color:#8f959e; margin:0 0 7px; }
    .cbar b { font-weight:600; color:#646a73; }
    .cbar button, .pacts button { all:unset; cursor:pointer; color:#8f959e; text-decoration:underline; }
    .cbar button:hover, .pacts button:hover { color:var(--bili-primary); }
    .selection-bar [data-selinfo] { flex:1; min-width:0; }
    .selection-bar .icon-action { all:unset; box-sizing:border-box; display:grid; place-items:center;
      flex:none; width:26px; height:26px; border:1px solid #DFE9EE; border-radius:6px;
      background:#fff; color:#657681; cursor:pointer; }
    .selection-bar .icon-action:hover { border-color:var(--bili-primary); color:var(--bili-primary); background:var(--bili-tint); }
    .selection-bar .icon-action:focus-visible { outline:2px solid var(--bili-primary); outline-offset:2px; }
    .selection-bar .icon-action svg { width:16px; height:16px; fill:none; stroke:currentColor;
      stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .tag-actions { display:flex; align-items:center; gap:6px; margin:6px 0 8px; }
    .tag-actions button { all:unset; box-sizing:border-box; display:flex; align-items:center;
      justify-content:center; height:36px; border:1px solid #dee0e3; border-radius:6px;
      background:#fff; color:#566B77; cursor:pointer; }
    .tag-actions button:hover { border-color:var(--bili-primary); color:var(--bili-ink); background:#F3FBFF; }
    .tag-actions button:focus-visible { outline:2px solid var(--bili-primary); outline-offset:2px; }
    .tag-actions button[disabled], .tag-actions button[disabled]:hover {
      background:#f7f8fa; color:#c9cdd4; border-color:#eef0f2; cursor:default; }
    .tag-actions svg { width:18px; height:18px; flex:none; fill:none; stroke:currentColor;
      stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .tag-actions .tag-edit { flex:1; min-width:0; gap:6px; font-size:12px; }
    .tag-actions .tag-divider { flex:none; width:1px; height:24px; margin:0 2px;
      background:#E2EBF0; }
    .tag-actions .tag-icon { flex:none; width:36px; }
    .tag-actions .tag-icon[aria-expanded="true"] { border-color:#AEDDEB;
      background:#E8F7FD; color:var(--bili-ink); }
    .template-footer { display:flex; align-items:center; gap:7px; flex:none; padding-top:8px;
      border-top:1px solid #EBF0F3; background:#fff; }
    .pbar { display:flex; align-items:center; gap:6px; flex:1; min-width:0;
      font-size:11px; color:#8f959e; margin:0; }
    .pbar span { flex:none; }
    .pbar select { flex:1; min-width:0; font:inherit; font-size:11px; color:#1f2329; background:#fff;
      border:1px solid #dee0e3; border-radius:5px; padding:3px 4px; cursor:pointer; }
    .pbar select:focus { outline:none; border-color:var(--bili-primary); }
    .pacts { display:flex; align-items:center; gap:5px; flex:none; font-size:11px; margin:0; }
    .pacts button { box-sizing:border-box; flex:none; padding:4px 2px; border-radius:4px;
      color:#566B77; text-decoration:none; white-space:nowrap; }
    .pacts button:hover { background:var(--bili-tint); }
    .pacts button[disabled], .pacts button[disabled]:hover {
      color:#dee0e3; background:transparent; cursor:default; text-decoration:none; }
    .pacts button.hot { color:var(--bili-primary); font-weight:600; }
    @media (max-width:319px) {
      .template-footer { flex-wrap:wrap; gap:4px; }
      .template-footer .pbar, .template-footer .pacts { width:100%; }
      .template-footer .pacts { justify-content:space-between; }
    }

    .btns { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
    .btns button { all:unset; box-sizing:border-box; text-align:center; cursor:pointer; padding:7px 4px;
      border-radius:6px; font-size:12px; border:1px solid #dee0e3; background:#fff; }
    .btns button:hover { border-color:var(--bili-primary); color:var(--bili-primary); }
    .btns button.p { background:var(--bili-primary); border-color:var(--bili-primary); color:#fff; }
    .btns button.p:hover { background:var(--bili-hover); color:#fff; }
    /* 禁用态必须一眼看出来。注意要连 background 一起改 ——
       主按钮 .p 的主题色底和这条规则同优先级，只改文字颜色的话按钮看着还是能点的。 */
    .btns button[disabled], .btns button[disabled]:hover {
      background:#f7f8fa; color:#c9cdd4; border-color:#eef0f2; cursor:default; }

    /* 所有面板按钮共用轻微的按压与回弹；不改变布局尺寸。 */
    .wrap button:not(.launcher) { transform-origin:center;
      transition:transform .22s cubic-bezier(.18,1.35,.35,1),filter .16s ease,
        box-shadow .18s ease,color .18s ease,background-color .18s ease,border-color .18s ease; }
    .wrap button.mp-pressing:not(.launcher) { transform:translateY(1px) scale(.97);
      filter:brightness(.95); transition-duration:.08s; }
    .tabs button.mp-pressing, .btns button.mp-pressing,
    .modes button.mp-pressing, .quick button.mp-pressing,
    .tag-actions button.mp-pressing, .selection-bar button.mp-pressing {
      box-shadow:inset 0 2px 5px rgba(9,59,82,.14); }
    .btns button.mp-confirmed, .tag-actions button.mp-confirmed {
      border-color:#AEDDEB; background:#E8F7FD; color:var(--bili-ink); }
    .btns button.mp-confirmed[disabled], .tag-actions button.mp-confirmed[disabled] {
      background:#f7f8fa; color:#c9cdd4; border-color:#eef0f2; }
    .wrap button.mp-confirmed::after { content:"✓"; display:inline-block;
      margin-left:6px; font-size:12px; font-weight:700; }
    .tag-actions button.tag-icon.mp-confirmed svg { display:none; }
    .tag-actions button.tag-icon.mp-confirmed::after { margin-left:0; font-size:18px; }
    @media (prefers-reduced-motion: reduce) {
      .wrap button:not(.launcher) { transition:none; }
      .wrap button.mp-pressing:not(.launcher) { transform:none; }
    }

    .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px;
      overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }

    .st { box-sizing:border-box; display:flex; align-items:center; gap:8px; height:40px;
      padding:4px 10px; border-top:1px solid #E6EDF2; background:#F8FBFD;
      font-size:11px; line-height:1.35; color:#627583; }
    .st.empty { border-top-color:transparent; background:#fff; }
    .st-icon { display:grid; place-items:center; flex:none; width:17px; height:17px;
      border-radius:50%; font-size:11px; font-weight:700; background:#E5F1F7; color:#577585; }
    .st.ok .st-icon { background:#e5f8ed; color:#079c4f; }
    .st.err .st-icon { background:#fff0ee; color:#c7433d; }
    .st.warn .st-icon { background:#fff4df; color:#a9731b; }
    .st.progress .st-icon { box-sizing:border-box; border:2px solid #B8E3F1;
      border-top-color:var(--bili-primary); background:transparent; animation:mp-st-spin .8s linear infinite; }
    @keyframes mp-st-spin { to { transform:rotate(360deg); } }
    .st-copy { flex:1; min-width:0; display:-webkit-box; -webkit-box-orient:vertical;
      -webkit-line-clamp:2; overflow:hidden; overflow-wrap:anywhere; }
    .st.expanded { height:auto; min-height:40px; align-items:flex-start; }
    .st.expanded .st-copy { display:block; max-height:140px; overflow:auto; white-space:pre-wrap; }
    .st-expand { all:unset; flex:none; padding:3px; cursor:pointer; color:var(--bili-ink); font-size:11px; }
    .st-expand[hidden] { display:none; }
    .st-expand:hover { text-decoration:underline; }
    .st-expand:focus-visible, .st-dismiss:focus-visible { outline:2px solid var(--bili-primary); outline-offset:1px; }
    .st-dismiss { all:unset; flex:none; width:19px; height:19px; display:grid; place-items:center;
      border-radius:5px; cursor:pointer; font-size:16px; line-height:1; color:#7A8B95; }
    .st-dismiss:hover { background:#ECF3F7; color:#263F4C; }
    .st:not(.dismissible) .st-dismiss { display:none; }
    .st.empty .st-icon, .st.empty .st-copy { visibility:hidden; }
    @media (prefers-reduced-motion: reduce) { .st.progress .st-icon { animation:none; } }
    .filt { display:flex; gap:5px; margin:0 0 8px; }
    .filt input[type=search] { flex:1; min-width:0; box-sizing:border-box; padding:5px 7px;
      border:1px solid #dee0e3; border-radius:5px; font:inherit; font-size:11.5px; }
    .filt input[type=search]:focus { outline:none; border-color:var(--bili-primary); }
    .filt .tag-filter-button { all:unset; box-sizing:border-box; display:flex; align-items:center;
      justify-content:space-between; gap:6px; flex:none; min-width:88px; max-width:145px;
      padding:5px 7px; border:1px solid #dee0e3; border-radius:6px; background:#fff;
      color:#1f2329; font-size:11px; cursor:pointer; }
    .tag-filter-button span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .tag-filter-button svg { flex:none; width:15px; height:15px; fill:none; stroke:currentColor;
      stroke-width:1.8; stroke-linecap:round; }
    .filt .tag-filter-button:hover, .filt .tag-filter-button.active,
    .filt .tag-filter-button[aria-expanded=true] { border-color:#A8DEEF; color:var(--bili-ink); background:var(--bili-tint); }
    .tag-filter-panel { margin:-2px 0 9px; padding:9px; border:1px solid #D9EAF1;
      border-radius:8px; background:#FAFDFF; font-size:11px; }
    .tag-filter-panel[hidden] { display:none; }
    .tag-filter-search { box-sizing:border-box; width:100%; padding:6px 8px; border:1px solid #dee0e3;
      border-radius:5px; background:#fff; color:#1f2329; font:inherit; }
    .tag-filter-search:focus { outline:2px solid var(--bili-primary); outline-offset:1px; }
    .tag-detail-options { display:flex; flex-wrap:wrap; gap:8px; margin:8px 0; }
    .tag-detail-options label, .tag-option { display:flex; align-items:center; gap:6px; cursor:pointer; }
    .tag-filter-panel input[type=checkbox], .tag-filter-panel input[type=radio] {
      flex:none; margin:0; accent-color:var(--bili-primary); }
    .tag-option { padding:5px 4px; border-radius:4px; }
    .tag-option span { min-width:0; overflow-wrap:anywhere; }
    .tag-option:hover, .tag-option:focus-within { background:#E8F7FD; }
    .tag-filter-caption { display:flex; justify-content:space-between; gap:8px;
      margin:6px 0 3px; padding-top:7px; border-top:1px solid #DFEAF0; color:#6C808C; font-size:10.5px; }
    .tag-options { max-height:min(180px, 25vh); overflow:auto; overscroll-behavior:contain; }
    .tag-empty { padding:12px 4px; color:#8597A2; }
    .tag-filter-actions { display:flex; justify-content:flex-end; gap:7px; margin-top:8px; }
    .tag-filter-actions button { all:unset; cursor:pointer; padding:5px 12px; border:1px solid #D2E4EC;
      border-radius:5px; background:#fff; color:#456575; }
    .tag-filter-actions button:hover { border-color:var(--bili-primary); color:var(--bili-ink); }
    .filt .date-filter-button { all:unset; box-sizing:border-box; position:relative;
      display:grid; place-items:center; flex:none; width:32px; min-height:31px;
      border:1px solid #dee0e3; border-radius:6px; background:#fff;
      color:#627583; cursor:pointer; }
    .filt .date-filter-button:hover, .filt .date-filter-button.active {
      border-color:#A8DEEF; color:var(--bili-ink); background:var(--bili-tint); }
    .filt .date-filter-button svg { width:18px; height:18px; fill:none; stroke:currentColor;
      stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .filt .date-filter-button.active::after { content:""; position:absolute; top:3px; right:3px;
      width:5px; height:5px; border-radius:50%; background:var(--bili-primary); }
    .date-filter-panel { margin:-2px 0 9px; padding:9px; border:1px solid #D9EAF1;
      border-radius:8px; background:#FAFDFF; }
    .date-filter-panel[hidden], .date-filter-error[hidden], .selection-hint[hidden] { display:none; }
    .date-filter-fields { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .date-filter-field { display:flex; flex-direction:column; gap:3px; min-width:0;
      font-size:11px; color:#607482; }
    .date-filter-inputs { box-sizing:border-box; position:relative; display:flex; align-items:center;
      justify-content:center; gap:1px; min-width:0; min-height:31px; padding:5px 4px;
      border:1px solid #dee0e3; border-radius:5px; background:#fff; }
    .date-filter-inputs:focus-within { border-color:var(--bili-primary); }
    .date-filter-inputs input[data-date-part] { all:unset; box-sizing:border-box; flex:none; min-width:0;
      padding:0; text-align:center; font:inherit; font-size:11px; color:#1f2329;
      font-variant-numeric:tabular-nums; }
    .date-filter-inputs input[data-date-part=year] { width:4.5ch; }
    .date-filter-inputs input[data-date-part=month],
    .date-filter-inputs input[data-date-part=day] { width:2.2em; }
    .date-filter-inputs input[data-date-part]:focus { border-radius:2px; background:#EAF8FD; }
    .date-filter-inputs input[data-date-part]::placeholder { color:#a8abb2; opacity:1; }
    .date-filter-inputs .date-separator { flex:none; color:#8196A2; }
    .date-filter-inputs .date-picker-button { all:unset; box-sizing:border-box; flex:none;
      display:grid; place-items:center; width:20px; height:20px; margin-left:auto;
      border-radius:4px; color:#748D9A; cursor:pointer; }
    .date-filter-inputs .date-picker-button:hover { background:#EAF8FD; color:var(--bili-ink); }
    .date-filter-inputs .date-picker-button svg { width:15px; height:15px; fill:none;
      stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .date-filter-inputs .date-native-picker { position:absolute; right:0; bottom:0;
      width:1px; height:1px; padding:0; opacity:0; pointer-events:none; }
    .date-filter-error { margin-top:6px; font-size:10.5px; color:#c7433d; }
    .date-filter-actions { display:flex; justify-content:flex-end; gap:6px; margin-top:8px; }
    .date-filter-actions button { all:unset; box-sizing:border-box; min-width:64px;
      padding:5px 10px; border:1px solid #D7E5ED; border-radius:6px;
      background:#fff; color:#536A78; cursor:pointer; text-align:center; font-size:11px; }
    .date-filter-actions button:hover { border-color:var(--bili-primary); color:var(--bili-ink); }
    .date-filter-actions button.p { border-color:var(--bili-primary); background:var(--bili-primary); color:#fff; }
    .date-filter-actions button.p:hover { background:var(--bili-hover); color:#fff; }
    .selection-hint { margin:-2px 0 7px; padding:5px 7px; border-radius:6px;
      background:#fff8e6; color:#8a6d3b; font-size:10.5px; line-height:1.45; }
    @media (max-width:319px) { .date-filter-fields { grid-template-columns:1fr; } }

    .list { max-height:28vh; overflow:auto; overscroll-behavior:contain; }
    .it { display:flex; gap:6px; align-items:center; box-sizing:border-box; height:32px;
      padding:5px 2px;
      border-bottom:1px solid #f7f8fa; font-size:11.5px; }
    .it.new { background:var(--bili-tint); }
    .it.sel { background:#eef7ff; }
    .it input.rk { margin:0; width:13px; height:13px; flex:none; cursor:pointer; accent-color:var(--bili-primary); }
    .it .d { color:#a8abb2; flex:none; font-variant-numeric:tabular-nums; }
    .it .t { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      color:#1f2329; cursor:pointer; }
    .it .t:hover { color:var(--bili-primary); text-decoration:underline; }
    .it .tags { flex:none; font-size:9.5px; color:#5b8ff9; max-width:80px;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .it .flag { flex:none; font-size:9.5px; padding:2px 4px; border-radius:4px; white-space:nowrap; }
    .it .flag.no { color:#d9a03c; background:#fff8e6; }
    .more { padding:6px 2px; font-size:11px; color:#a8abb2; text-align:center; }

    .hd .data-toggle { display:grid; place-items:center; box-sizing:border-box;
      width:28px; height:28px; padding:4px; border-radius:6px; color:inherit; }
    .hd .data-toggle:hover, .hd .data-toggle[aria-expanded=true] { background:rgba(255,255,255,.2); opacity:1; }
    .data-toggle svg { width:18px; height:18px; fill:none; stroke:currentColor;
      stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .data-manager { margin:0 0 12px; padding:10px; border:1px solid #D9EAF1;
      border-radius:9px; background:#FAFDFF; font-size:11px; }
    .data-heading { margin:0 0 7px; font-size:13px; color:#315A6C; }
    .data-manager[hidden], .backup-result[hidden] { display:none; }
    .backup-account { font-weight:600; color:#315A6C; overflow-wrap:anywhere; }
    .backup-summary { margin:5px 0 8px; color:#607482; white-space:pre-line; line-height:1.7; }
    .backup-note { margin:6px 0 8px; color:#8a6d3b; font-size:10.5px; }
    .backup-note:empty { display:none; }
    .backup-actions { display:grid; grid-template-columns:1fr; gap:7px; }
    .backup-file-actions { grid-template-columns:repeat(2, minmax(0, 1fr)); }
    .backup-actions button { all:unset; box-sizing:border-box; text-align:center; cursor:pointer;
      padding:7px 9px; border:1px solid #D2E4EC; border-radius:6px; background:#fff; color:#456575; }
    .backup-actions button:hover { border-color:var(--bili-primary); color:var(--bili-ink); }
    .backup-actions button.p { border-color:var(--bili-primary); background:var(--bili-primary); color:#fff; }
    .backup-actions button.p:hover { background:var(--bili-hover); }
    .backup-actions button[hidden], .restore-preview[hidden] { display:none; }
    .backup-actions button:disabled { opacity:.5; cursor:not-allowed; }
    .backup-result { margin-top:9px; padding:8px; border:1px solid #D9EAF1; border-radius:6px;
      background:#ECF8FD; color:#28627A; white-space:pre-line; overflow-wrap:anywhere;
      max-height:190px; overflow:auto; font-size:10.5px; }
    .backup-result.bad { background:#fff1f0; color:#ac3e38; border-color:#f0d0cb; }
    .backup-result.warn { background:#fff8e6; color:#8a6d3b; border-color:#f2dfb7; }
    .restore-preview { margin-top:10px; padding-top:9px; border-top:1px solid #D9EAF1; }
    .restore-heading { margin:0 0 5px; font-size:12px; color:#315A6C; }
    .restore-summary { white-space:pre-line; line-height:1.7; }
    .restore-note { margin:7px 0; color:#707F89; font-size:10.5px; line-height:1.65; white-space:pre-line; }
    .restore-filter { display:block; margin:9px 0; }
    .restore-filter select { box-sizing:border-box; width:100%; margin-top:4px; padding:6px;
      color:#456575; background:#fff; border:1px solid #D2E4EC; border-radius:5px; }
    .restore-item { margin:6px 0; border:1px solid #DFE8ED; border-radius:6px; padding:7px; background:#fff; }
    .restore-item summary { cursor:pointer; overflow-wrap:anywhere; line-height:1.6; }
    .restore-item summary strong { display:block; color:#315A6C; }
    .restore-item p { margin:6px 0; white-space:pre-wrap; overflow-wrap:anywhere; }
    .restore-diff { border-top:1px dashed #DFE8ED; padding-top:5px; }
    .restore-link { font-size:10px; color:#8596A0; }
    .restore-pager { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:8px; }
    .restore-pager button { border:1px solid #D2E4EC; background:white; border-radius:5px; padding:4px 8px; cursor:pointer; }
    .restore-pager button:disabled { opacity:.4; cursor:not-allowed; }
    .restore-safety { margin-top:9px; padding:8px; border:1px solid #D9EAF1; border-radius:6px; }
    .restore-safety[hidden] { display:none; }
    .restore-safety p { margin:0 0 7px; font-size:10.5px; color:#607482; white-space:pre-line; }
    /* B站保留的控件使用同一套公众号面板尺寸、色彩和间距。 */
    .hide, [hidden] { display:none !important; }
    .hint, .fnote { font-size:10.5px; color:#8f959e; line-height:1.5; }
    .hint { margin:0 0 9px; }
    .fnote { margin:4px 0 0; }
    .f { display:block; font-size:11px; color:#8f959e; margin-bottom:3px; }
    select, input[type=search], input[type=text] { box-sizing:border-box; padding:5px 7px;
      border:1px solid #dee0e3; border-radius:5px; background:#fff; color:#1f2329;
      font:inherit; font-size:11.5px; }
    select { cursor:pointer; }
    select:focus { outline:none; border-color:var(--bili-primary); }
    .frow { display:flex; gap:5px; margin:0 0 6px; align-items:center; }
    .frow:last-child { margin-bottom:0; }
    .frow input[type=search], .frow input[type=date] { flex:1; min-width:0; font-size:11px; }
    .frow select { min-width:0; max-width:110px; font-size:11px; }
    .frow .lab { flex:none; font-size:11px; color:#8f959e; }
    .date-panel input[type=date] { min-width:0; font-size:11px; }
    .advanced { padding:8px 0; margin:0 0 8px; border-bottom:1px solid #EBF0F3; }
    .advanced summary { cursor:pointer; font-size:11px; color:#8f959e; }
    .advanced[open] summary { margin-bottom:8px; color:#456575; }
    .advanced .frow select[data-sort] { flex:1; max-width:none; }
    .rules { margin:2px 0 0; }
    .rule { display:flex; gap:4px; align-items:center; margin:0 0 5px; }
    .rule select { flex:none; font-size:11px; padding:4px 2px; }
    .rule select.rc { max-width:96px; }
    .rule select.ro { width:44px; }
    .rule input { flex:1; min-width:0; width:auto; padding:4px 6px; font-size:11px; }
    .rule .del { all:unset; flex:none; cursor:pointer; color:#c7433d; padding:0 4px; font-size:13px; }
    .rule .unit { flex:none; font-size:10.5px; color:#8f959e; }
    .fsum { margin:5px 0 7px; font-size:10.5px; color:var(--bili-ink); line-height:1.6; overflow-wrap:anywhere; }
    .fsum.none, .filter-summary[hidden] { display:none; }
    .it .n { flex:none; font-size:10.5px; color:#8f959e; font-variant-numeric:tabular-nums; }
    .it .n.fin { min-width:25px; text-align:right; color:var(--bili-ink); }
    .it.cur { box-shadow:inset 2px 0 0 var(--bili-primary); }
    .it .flag.full { color:#079c4f; background:#e5f8ed; }
    .it .flag.noext { color:#a9731b; background:#fff4df; }
    .it .flag.nocore { color:#c7433d; background:#fff0ee; }
    .libbar { display:flex; align-items:center; gap:6px; margin:0 0 8px;
      font-size:11px; line-height:1.6; color:#627583; }
    .libbar > span { flex:1; min-width:0; }
    .libbar button { all:unset; flex:none; cursor:pointer; color:#8f959e; text-decoration:underline; }
    .libbar button:hover { color:#c7433d; }
    .libbar.empty { color:#8f959e; }
    .warnbar.info { border-color:#D9EAF1; background:var(--bili-tint); color:#456575; }
    .sect { border-top:1px solid #EBF0F3; margin-top:12px; padding-top:10px; }
    .sect .row { display:flex; align-items:center; gap:8px; margin-bottom:8px;
      font-size:11.5px; color:#646a73; }
    .sect .row span { flex:1; }
    .sect .cap { margin:0 0 6px; font-size:11px; font-weight:600; color:#8f959e; }
    .bothrow { display:flex; align-items:flex-start; gap:6px; margin:0 0 8px;
      font-size:11px; line-height:1.5; color:#646a73; cursor:pointer; user-select:none; }
    .bothrow input { flex:none; width:13px; height:13px; margin:3px 0 0; accent-color:var(--bili-primary); cursor:pointer; }
    .detail-primary-options { padding:10px 0 4px; }
    .detail-primary-options .bothrow { margin-bottom:4px; }
    .detail-primary-options .option-note { margin:0 0 10px 19px; }
    .detail-setting input[type=number] { box-sizing:border-box; width:150px; max-width:65%;
      padding:5px 7px; font:inherit; font-size:11px; }
    .detail-setting.bothrow { align-items:center; margin:0; }
    .detail-setting.bothrow > span { flex:1; }
    .detail-setting.bothrow input { margin:0; }
    .sub .eq { margin-top:6px; font-size:10.5px; color:var(--bili-primary); overflow-wrap:anywhere; }
    .btns button.g { border-color:var(--bili-border); background:var(--bili-tint); color:var(--bili-ink); }
    .btns button .l1 { display:block; }
    .btns button .l2 { display:block; margin-top:2px; font-size:10.5px; color:#8f959e;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .manual-tools { margin-top:12px; border-top:1px solid #EBF0F3; padding-top:9px; }
    .grab-options { margin:10px 0 0; }
    .grab-options > summary { color:#8f959e; font-size:11px; cursor:pointer; }
    .grab-options > summary:focus-visible { outline:2px solid var(--bili-primary); outline-offset:2px; border-radius:3px; }
    .grab-options[open] > summary { color:var(--bili-ink); }
    .grab-options-body { padding-top:10px; }
    .grab-extra-mode { margin:8px 0 0; }
    .data-maintenance { margin:8px 0; justify-content:flex-end; }
    .manual-tools summary { color:#8f959e; font-size:11px; cursor:pointer; }
    .manual-tools[open] summary { margin-bottom:8px; }
    .st.err { color:#ac3e38; }
    .st.warn { color:#8a6d3b; }
    .st.ok { color:#326449; }
    .st-dismiss[hidden] { display:none; }
    .data-manager [data-backup-status] { overflow-wrap:anywhere; }
    .data-manager input[type=file] { max-width:100%; }
    @media (max-width:359px) {
      .wrap { right:12px; bottom:12px; }
    }
    @media (max-height:560px) {
      .tabs { grid-auto-rows:48px; padding:6px 10px; }
      .tabs button { height:48px; }
    }
  `;
  /* ==========================================================================
   * 15. 面板状态与构建
   * ========================================================================== */
  let ui = null;
  let mode = 'inc';
  let arcBoth = true;          // 是否两个列表接口都翻
  let wantOv = false;          // 补详情时是否顺便补 退粉/充电（每条多一个请求）
  let detailSpeed = 'standard';
  let collecting = false;      // 「采集当前稿件」正在跑（它现在会发接口请求，要防连点）
  let running = false;
  let runningAction = '';
  let dragLock = false;
  let sumOpen = false;
  let rulesOpen = false;
  let fresh = new Set();
  let sel = new Set();     // 勾选的内容（按 _id），只在本次会话内有效
  let selectionAnchor = null;
  let rowOrderKey = '';
  let tagPanelOpen = false;

  function resetSelectionAnchor() { selectionAnchor = null; rowOrderKey = ''; }
  let impMode = 'merge';
  let impPlan = null;
  let impTimer = null;
  let lastKind = '';
  let migrated = null;

  const MODE_HINT = {
    inc: '从首页抓起，各来源遇到已知 BV 后停止；当前页的新 BV 都会保存。',
    older: '从上次覆盖到的页接着往后翻，用来分几次补全历史。',
    refresh: '从头翻到底，只更新数字不清库 —— 老稿件的播放量一直在涨，增量模式碰不到它们。',
    full: '从头重新抓取，成功后替换稿件库；中断时原库保留，可继续上次。',
  };

  function build() {
    const host = document.createElement('div');
    host.id = PANEL_ID;
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${CSS}</style>
      <div class="wrap">
        <button type="button" class="launcher" data-act="toggle" aria-label="展开B站稿件数据" title="展开B站稿件数据" aria-expanded="true">
          ${BILIBILI_MARK}
        </button>
        <div class="hd" data-drag>
          <div class="hd-account"><span class="brand-icon" aria-hidden="true">${BILIBILI_MARK}</span><b data-account-name>B站稿件数据</b></div>
          <button type="button" data-act="toggle" title="收起为图标" aria-label="收起为图标" aria-expanded="true">–</button>
          <button type="button" data-act="close" title="关闭面板，刷新页面可重新打开" aria-label="关闭面板">×</button>
        </div>
        <div class="tabs" role="tablist" aria-label="功能区">
          <button type="button" id="bili-tab-grab" data-tab="grab" class="on" role="tab" aria-controls="bili-panel-grab" aria-selected="true" tabindex="0"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v11m0 0-4-4m4 4 4-4M4.5 16v2.5A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5V16"/></svg><span class="tab-label">抓取</span></button>
          <button type="button" id="bili-tab-cols" data-tab="cols" role="tab" aria-controls="bili-panel-cols" aria-selected="false" tabindex="-1"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/></svg><span class="tab-label">列设置</span></button>
          <button type="button" id="bili-tab-rows" data-tab="rows" role="tab" aria-controls="bili-panel-rows" aria-selected="false" tabindex="-1"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg><span class="tab-label">稿件 <span data-cnt>0</span></span></button>
        </div>
        <div class="bd">
          <div class="view" id="bili-panel-grab" data-view="grab" role="tabpanel" aria-labelledby="bili-tab-grab">
            <div class="grab-switch" data-grab-switch data-view="list" role="tablist" aria-label="抓取类型">
              <button type="button" id="bili-grab-list" data-grab-view="list" role="tab" aria-controls="bili-pane-list" aria-selected="true" tabindex="0">抓列表</button>
              <button type="button" id="bili-grab-detail" data-grab-view="detail" role="tab" aria-controls="bili-pane-detail" aria-selected="false" tabindex="-1">补详情</button>
            </div>
            <div class="grab-viewport" data-grab-viewport data-view="list">
              <div class="grab-track">
                <section class="grab-pane" id="bili-pane-list" data-grab-panel="list" role="tabpanel" aria-labelledby="bili-grab-list" aria-hidden="false">
                  <div class="warnbar" data-warn style="display:none"></div>
                  <div class="warnbar" data-claim hidden><span>检测到旧版存储。核对当前 UID 后可认领补回，已有稿件和进度会保留。</span><div><button data-act="claim-legacy">认领旧库</button></div></div>
                  <div class="modes">
                    <button data-mode="inc" class="on" aria-pressed="true">增量更新</button>
                    <button data-mode="older" aria-pressed="false">补抓更早</button>
                    <button data-mode="full" aria-pressed="false">重新全抓</button>
                  </div>
                  <div data-daterow>
                    <label class="grab-date-line"><span>抓取到</span><input type="date" data-since title="包含所选日期当天"></label>
                    <div class="quick"><button data-days="30">近 30 天</button><button data-days="90">近 90 天</button><button data-days="365">近一年</button><button data-days="0">不限</button></div>
                  </div>
                  <div class="resume" data-resume style="display:none"><span data-resume-txt></span><button data-act="resume">继续上次</button><button data-act="drop">丢弃</button></div>
                  <div class="btns grab-run"><button class="p" data-act="list">开始抓列表</button></div>
                  <details class="grab-options">
                    <summary data-grab-options-label>更多设置</summary>
                    <div class="grab-options-body">
                      <div class="hint" data-hint></div>
                      <div class="modes grab-extra-mode"><button data-mode="refresh" aria-pressed="false">刷新全部模式</button></div>
                    </div>
                  </details>
                </section>
                <section class="grab-pane" id="bili-pane-detail" data-grab-panel="detail" role="tabpanel" aria-labelledby="bili-grab-detail" inert aria-hidden="true">
                  <div class="detail-pending" data-pending></div>
                  <label class="detail-setting"><span>抓取速度</span><select data-detail-speed aria-label="抓取速度" title="补详情和获取实时数据共用；按实际请求间隔，每 20 个请求长休息">
                    <option value="cautious">稳妥 · 间隔 5–8 秒</option>
                    <option value="standard">标准 · 间隔 2–5 秒</option>
                    <option value="quicker">较快 · 间隔 1.5–3 秒</option>
                  </select></label>
                  <div class="detail-primary-options">
                    <label class="bothrow" data-bothrow><input type="checkbox" data-both checked aria-describedby="bili-both-note"><span data-bothtxt></span></label>
                    <div class="fnote option-note" id="bili-both-note">新建抓列表任务时生效，每页增加一次请求；继续上次沿用原任务设置。</div>
                    <label class="bothrow" data-ovrow><input type="checkbox" data-wantov><span data-wantovtxt></span></label>
                    <div class="fnote" data-detail-estimate></div>
                  </div>
                  <div class="btns grab-run"><button class="p" data-act="detail">开始补详情</button></div>
                  <details class="grab-options">
                    <summary>更多设置</summary>
                    <div class="grab-options-body">
                      <div class="fnote" data-detailnote></div>
                      <details class="manual-tools manual-collect" data-manual style="display:none">
                        <summary>手动采集当前稿件</summary><div class="hint" data-arccur></div>
                        <div class="btns grab-run"><button data-act="collect">采集当前稿件</button></div>
                        <div class="btns" style="margin-top:6px"><button data-act="prev" data-prevbtn><span class="l1">↑ 上个</span></button><button data-act="next" data-nextbtn><span class="l1">↓ 下个</span></button></div>
                        <div class="fnote">读取当前页面；缺少平均播放进度时自动补取。</div>
                      </details>
                    </div>
                  </details>
                </section>
              </div>
            </div>
          </div>
          <div class="view hide" id="bili-panel-cols" data-view="cols" role="tabpanel" aria-labelledby="bili-tab-cols">
            <div class="cols" data-cols></div>
            <div class="template-footer">
            <div class="pbar">
              <span>模板</span><select data-preset></select>
            </div>
            <div class="pacts">
              <button data-act="preset-saveas">另存为…</button>
              <button data-act="preset-overwrite" data-ov>覆盖</button>
              <button data-act="preset-rename" data-ren>重命名</button>
              <button data-act="preset-del" data-del>删除</button>
            </div>
            </div>

          </div>
          <div class="view hide" id="bili-panel-rows" data-view="rows" role="tabpanel" aria-labelledby="bili-tab-rows">
            <div class="filt">
              <input type="search" data-q placeholder="搜标题…" aria-label="搜标题或标签">
              <button type="button" class="date-filter-button" data-act="date-filter-toggle" data-date-toggle aria-label="按发布日期筛选" title="按发布日期筛选" aria-expanded="false" aria-controls="bili-date-filter"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M7 17h3"/></svg></button>
              <button type="button" class="tag-trigger tag-filter-button" data-act="tag-filter-toggle" data-tagf aria-expanded="false" aria-controls="bili-tag-filter" title="搜索和多选标签"><span data-taglabel>标签不限</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button>
            </div>
            <section class="tag-panel tag-filter-panel" id="bili-tag-filter" data-tagpanel hidden aria-label="标签筛选">
              <input class="tag-filter-search" type="search" data-tagsearch placeholder="搜索标签…" aria-label="搜索标签">
              <div class="tag-detail-options" role="group" aria-label="详情状态">
                <label><input type="radio" name="bili-tag-detail" data-tag-detail value="all" checked>详情不限</label>
                <label><input type="radio" name="bili-tag-detail" data-tag-detail value="yes">有详情</label>
                <label><input type="radio" name="bili-tag-detail" data-tag-detail value="no">无详情</label>
              </div>
              <label class="tag-none tag-option"><input type="checkbox" data-tag-none><span>无自定义标签</span></label>
              <div class="tag-filter-caption"><span>自定义标签 · 符合任一</span><span data-tagcount></span></div>
              <div class="tag-options" data-tagoptions></div>
              <details class="advanced advanced-filters">
                <summary>更多筛选与操作</summary>
                <label class="detail-setting"><span>完整度</span><select data-stf><option value="">完整度不限</option><option value="full">数据全齐</option><option value="noext">缺扩展指标</option><option value="nocore">缺核心数据</option></select></label>
                <div class="frow"><span class="lab">排序</span><select data-sort style="flex:1;max-width:none"></select><button class="chip" data-act="sort-dir" data-sortdir>↓</button></div>
                <div class="cbar"><span>数值条件 <b data-rulecnt></b></span><button data-act="rules-toggle" data-ruletoggle>展开</button><button data-act="rule-add">+ 加一条</button></div>
                <div class="rules" data-rules style="display:none"></div>
                <div class="cbar filter-summary"><span data-fcnt></span><button data-act="filt-clear">清空筛选</button></div>
                <div class="fsum" data-fsum></div>
                <div class="cbar"><button data-act="sel-inv">反选当前筛选结果</button></div>
              </details>
              <div class="tag-filter-actions"><button data-act="tag-filter-clear">清空</button><button data-act="tag-filter-done">完成</button></div>
            </section>
            <div class="date-panel date-filter-panel" id="bili-date-filter" data-date-panel role="group" aria-label="发布日期范围" hidden>
              <div class="date-filter-fields">
                <div class="date-filter-field">
                  <span>开始日期</span>
                  <div class="date-filter-inputs" data-date-from role="group" aria-label="开始日期">
                    <input type="text" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="yyyy" data-date-part="year" aria-label="开始日期的年">
                    <span class="date-separator" aria-hidden="true">/</span>
                    <input type="text" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="mm" data-date-part="month" aria-label="开始日期的月">
                    <span class="date-separator" aria-hidden="true">/</span>
                    <input type="text" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="dd" data-date-part="day" aria-label="开始日期的日">
                    <button type="button" class="date-picker-button" data-act="date-picker-from" aria-label="从日历选择开始日期" title="从日历选择开始日期">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>
                    </button>
                    <input type="date" class="date-native-picker" data-from min="0001-01-01" max="9999-12-31" tabindex="-1" aria-hidden="true">
                  </div>
                </div>
                <div class="date-filter-field">
                  <span>结束日期</span>
                  <div class="date-filter-inputs" data-date-to role="group" aria-label="结束日期">
                    <input type="text" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="yyyy" data-date-part="year" aria-label="结束日期的年">
                    <span class="date-separator" aria-hidden="true">/</span>
                    <input type="text" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="mm" data-date-part="month" aria-label="结束日期的月">
                    <span class="date-separator" aria-hidden="true">/</span>
                    <input type="text" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="dd" data-date-part="day" aria-label="结束日期的日">
                    <button type="button" class="date-picker-button" data-act="date-picker-to" aria-label="从日历选择结束日期" title="从日历选择结束日期">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>
                    </button>
                    <input type="date" class="date-native-picker" data-to min="0001-01-01" max="9999-12-31" tabindex="-1" aria-hidden="true">
                  </div>
                </div>
              </div>
              <div class="date-filter-error" data-date-error hidden role="alert"></div>
              <div class="date-filter-actions"><button data-act="date-filter-clear">清除</button><button class="p" data-act="date-filter-apply">应用</button></div>
            </div>
            <div class="cbar selection-bar"><span data-selinfo></span>
              <button class="icon-action" data-act="sel-all" title="全选当前筛选结果" aria-label="全选当前筛选结果"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="m7.5 12 3 3 6-6"/></svg></button>
              <button class="icon-action" data-act="sel-none" title="清空所有勾选" aria-label="清空所有勾选"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="m8.5 8.5 7 7m0-7-7 7"/></svg></button>
            </div>
            <div class="selection-hint" data-selection-hint hidden></div>
            <div class="list" data-list role="list" tabindex="0" aria-label="稿件列表，使用上下方向键浏览"></div>
            <div class="btns" style="margin-top:8px"><button class="p" data-act="refresh-selected" data-refbtn title="请先勾选需要更新的稿件" disabled>获取实时数据</button></div>
            <div class="tag-actions" role="group" aria-label="标签操作">
              <button class="tag-edit" data-act="tag-sel" data-tagbtn title="编辑勾选稿件的自定义标签"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 4h7l9 9-7 7-9-9V4Z"/><circle cx="7.5" cy="7.5" r="1"/></svg><span data-tagbtnlabel>编辑标签</span></button><span class="tag-divider" aria-hidden="true"></span>
              <button class="tag-icon" data-act="imp-toggle" data-imptoggle aria-label="导入自定义标签" title="导入自定义标签" aria-expanded="false" aria-controls="bili-tag-import"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 5h7l5 5v4l-5 5-7-7V5Z"/><circle cx="6.5" cy="8.5" r=".8"/><path d="M19 5v13m-3-3 3 3 3-3"/></svg></button>
              <button class="tag-icon" data-act="tag-export" aria-label="导出全库自定义标签" title="导出全库自定义标签"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 5h7l5 5v4l-5 5-7-7V5Z"/><circle cx="6.5" cy="8.5" r=".8"/><path d="M19 19V6m-3 3 3-3 3 3"/></svg></button>
            </div>
            <div class="imp" id="bili-tag-import" data-imp style="display:none">
              <div class="imp-heading">导入标签</div>
              <textarea data-imptext spellcheck="false" placeholder='key 写标题或 BV 号都行，脚本自己判断：

{
  "升压芯片 TPS61290 怎么选": ["技术", "重点"],
  "BV1xx411c7mD": "活动"
}

也认导出的数组写法。'></textarea>
              <div class="improw">
                <input type="file" data-impfile accept=".json,application/json,text/plain">
              </div>
              <div class="improw">
                <span>导入方式</span>
                <label class="rmode"><input type="radio" name="impmode" data-m="merge" checked>追加到已有标签</label>
                <label class="rmode"><input type="radio" name="impmode" data-m="replace">覆盖已有标签</label>
              </div>
              <div class="impprev" data-impprev style="display:none"></div>
              <div class="btns">
                <button class="p" data-act="imp-apply" data-impapply disabled
                  style="grid-column:1 / -1">导入</button>
              </div>
              <div class="cbar" style="margin:6px 0 0">
                <span></span>
                <button data-act="imp-preview">重新预览</button>
                <button data-act="imp-clear">清空输入</button>
              </div>
            </div>
            <div class="btns" style="margin-top:10px"><button data-act="copy">复制</button><button data-act="csv">导出 CSV</button></div>
          </div>
        </div>
        <div class="st empty" data-st role="status" aria-live="polite" aria-atomic="true"><span class="st-icon" data-st-icon aria-hidden="true"></span><span class="st-copy" data-st-copy></span><button type="button" class="st-expand" data-st-expand data-act="expand-status" aria-expanded="false" hidden>展开</button><button type="button" class="st-dismiss" data-act="dismiss-status" aria-label="关闭提示" title="关闭提示">×</button></div>
        <span class="sr-only" data-action-feedback role="status" aria-live="polite" aria-atomic="true"></span>
      </div>`;
    document.documentElement.appendChild(host);

    const launcher = root.querySelector('.launcher');

    const $ = s => root.querySelector(s);
    ui = {
      host, root, launcher, wrap: $('.wrap'), body: $('.bd'),
      statusCopy: $('[data-st-copy]'), statusIcon: $('[data-st-icon]'),
      grabSwitch: $('[data-grab-switch]'), grabViewport: $('[data-grab-viewport]'),
      grabPanels: [...root.querySelectorAll('[data-grab-panel]')], grabOptionsLabel: $('[data-grab-options-label]'),
      grabTabs: [...root.querySelectorAll('[data-grab-view]')],
      datePanel: $('[data-date-panel]'), dateToggle: $('[data-date-toggle]'), dateError: $('[data-date-error]'),
      tagLabel: $('[data-taglabel]'), tagBtnLabel: $('[data-tagbtnlabel]'),
      warn: $('[data-warn]'),
      manual: $('[data-manual]'), arcCur: $('[data-arccur]'),
      prevBtn: $('[data-prevbtn]'), nextBtn: $('[data-nextbtn]'),
      hint: $('[data-hint]'),
      bothRow: $('[data-bothrow]'), both: $('[data-both]'), bothTxt: $('[data-bothtxt]'),
      detailNote: $('[data-detailnote]'),
      dateRow: $('[data-daterow]'), since: $('[data-since]'),
      resume: $('[data-resume]'), resumeTxt: $('[data-resume-txt]'),
      pending: $('[data-pending]'), speed: $('[data-detail-speed]'), detailEstimate: $('[data-detail-estimate]'),
      wantOv: $('[data-wantov]'), wantOvTxt: $('[data-wantovtxt]'),
      listBtn: $('[data-act="list"]'), detailBtn: $('[data-act="detail"]'),
      cols: $('[data-cols]'),
      preset: $('[data-preset]'), ovBtn: $('[data-ov]'), renBtn: $('[data-ren]'), delBtn: $('[data-del]'),
      copy: $('[data-act="copy"]'), csv: $('[data-act="csv"]'),
      status: $('[data-st]'), list: $('[data-list]'), count: $('[data-cnt]'),
      statusExpand: $('[data-st-expand]'), actionFeedback: $('[data-action-feedback]'),
      statusByScope: {}, progressByScope: {}, statusTimer: null, statusSerial: 0,
      statusEpoch: 0, statusHovered: false, statusFocused: false, buttonFeedbackTimers: new Map(),
      q: $('[data-q]'), tagF: $('[data-tagf]'), stF: $('[data-stf]'),
      tagPanel: $('[data-tagpanel]'), tagSearch: $('[data-tagsearch]'), tagOptions: $('[data-tagoptions]'),
      tagCount: $('[data-tagcount]'), tagNone: $('[data-tag-none]'),
      virtualRows: [], rowWindowStart: -1, rowWindowEnd: -1, rowFilterKey: '',
      selectionHint: $('[data-selection-hint]'),
      from: $('[data-from]'), to: $('[data-to]'),
      dateFrom: $('[data-date-from]'), dateTo: $('[data-date-to]'),
      rules: $('[data-rules]'), ruleToggle: $('[data-ruletoggle]'), ruleCnt: $('[data-rulecnt]'),
      sortSel: $('[data-sort]'), sortDir: $('[data-sortdir]'),
      fsum: $('[data-fsum]'), fcnt: $('[data-fcnt]'),
      selInfo: $('[data-selinfo]'),
      refBtn: $('[data-refbtn]'), tagBtn: $('[data-tagbtn]'),
      imp: $('[data-imp]'), impToggle: $('[data-imptoggle]'), impText: $('[data-imptext]'),
      impFile: $('[data-impfile]'), impPrev: $('[data-impprev]'), impApply: $('[data-impapply]'),
      tabs: [...root.querySelectorAll('[data-tab]')],
      views: [...root.querySelectorAll('.view')],
      modeBtns: [...root.querySelectorAll('[data-mode]')],
    };

    ui.sortSel.innerHTML = SORTS.map(s => `<option value="${s.key}">${esc(s.label)}</option>`).join('');

    /* ---- 筛选控件：改了就立刻重绘 ---- */
    ui.q.addEventListener('input', () => { filt.patch({ q: ui.q.value }); refresh(); });
    ui.tagSearch.addEventListener('input', renderTagFilter);
    ui.tagPanel.addEventListener('change', onTagFilterChange);
    ui.stF.addEventListener('change', () => { filt.patch({ st: ui.stF.value }); refresh(); });
    // 日期面板先编辑，点击应用后生效，与参考面板一致。
    ui.datePanel.addEventListener('input', onDatePartInput);
    ui.datePanel.addEventListener('compositionend', onDatePartInput);
    ui.datePanel.addEventListener('change', onDateFilterChange);
    ui.datePanel.addEventListener('paste', onDatePaste);
    ui.datePanel.addEventListener('keydown', onDatePartKeydown);
    ui.sortSel.addEventListener('change', () => { filt.patch({ sort: ui.sortSel.value }); refresh(); });
    ui.rules.addEventListener('change', onRuleChange);
    ui.rules.addEventListener('input', onRuleChange);

    // click 保留 shiftKey；键盘空格也会触发 click，避免 change 丢失修饰键。
    ui.list.addEventListener('click', onRowCheck);
    ui.list.addEventListener('scroll', () => renderRowWindow(), { passive: true });
    ui.list.addEventListener('keydown', onListKeydown);
    ui.cols.addEventListener('change', onColToggle);
    ui.preset.addEventListener('change', onPresetPick);
    ui.both.addEventListener('change', () => {
      if (running || collecting) { ui.both.checked = arcBoth; return; }
      try {
        uiState.patch({ arcBoth: ui.both.checked });
        arcBoth = ui.both.checked; refresh();
      } catch (err) { ui.both.checked = arcBoth; say(err.message || String(err), 'err', 'grab-detail'); }
    });
    ui.speed.addEventListener('change', () => {
      if (running || collecting) { ui.speed.value = detailSpeed; return; }
      const next = Object.hasOwn(DETAIL_SPEEDS, ui.speed.value) ? ui.speed.value : 'standard';
      try {
        uiState.patch({ detailSpeed: next });
        detailSpeed = next; refresh();
      } catch (err) { ui.speed.value = detailSpeed; say(err.message || String(err), 'err', 'grab-detail'); }
    });
    ui.wantOv.addEventListener('change', () => {
      if (running || collecting) { ui.wantOv.checked = wantOv; return; }
      try {
        uiState.patch({ wantOv: ui.wantOv.checked });
        wantOv = ui.wantOv.checked; refresh();
      } catch (err) { ui.wantOv.checked = wantOv; say(err.message || String(err), 'err', 'grab-detail'); }
    });

    // 改了 JSON 先作废旧计划（防止拿旧计划导入），停手 500ms 后自动重新预览
    ui.impText.addEventListener('input', () => {
      invalidatePlan();
      clearTimeout(impTimer);
      impTimer = setTimeout(() => {
        if ((ui.impText.value || '').trim()) doImpPreview();
      }, 500);
    });
    ui.impFile.addEventListener('change', onImpFile);
    ui.imp.addEventListener('change', e => {
      const r = e.target.closest && e.target.closest('input[name="impmode"]');
      if (!r) return;
      impMode = r.getAttribute('data-m');
      if (impPlan) doImpPreview(); else updateImpApply();
    });

    root.addEventListener('click', e => {
      const scope = currentStatusScope(), epoch = ui.statusEpoch;
      onClick(e).catch(err => { if (ui && ui.statusEpoch === epoch) say(err.message || String(err), 'err', scope); });
    });
    ui.status.addEventListener('mouseenter', () => { ui.statusHovered = true; renderStatus(); });
    ui.status.addEventListener('mouseleave', () => { ui.statusHovered = false; renderStatus(); });
    ui.status.addEventListener('focusin', () => { ui.statusFocused = true; renderStatus(); });
    ui.status.addEventListener('focusout', e => { ui.statusFocused = ui.status.contains(e.relatedTarget); renderStatus(); });
    ui.onVisibility = () => renderStatus();
    document.addEventListener('visibilitychange', ui.onVisibility);
    root.addEventListener('keydown', e => {
      const tab = e.target.closest('[data-tab], [data-grab-view]');
      if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const group = tab.hasAttribute('data-tab') ? ui.tabs : ui.grabTabs;
      const index = group.indexOf(tab);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? group.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + group.length) % group.length;
      group[next].click(); group[next].focus();
    });

    const d = new Date();
    d.setDate(d.getDate() - 90);
    ui.since.value = fmtDate(d);

    initDrag(ui.cols);
    ui.dragDisposers = [makeDraggable($('.wrap'), $('[data-drag]')), makeDraggable($('.wrap'), launcher, true)];

    const st = uiState.read();
    if (st.arcBoth === false) arcBoth = false;
    ui.both.checked = arcBoth;
    // 退粉/充电默认不勾：它是每条多一个请求的事，得让人自己开
    if (st.wantOv === true) wantOv = true;
    ui.wantOv.checked = wantOv;
    detailSpeed = Object.hasOwn(DETAIL_SPEEDS, st.detailSpeed) ? st.detailSpeed : 'standard';
    ui.speed.value = detailSpeed;
    if (DUR_FMTS.some(f => f.key === st.durFmt)) durFmt = st.durFmt;

    syncFilterInputs();
    routeTabs();
    refresh();
    selectTab(st.activeTab || 'grab', false);
    selectGrabView(st.grabView || 'list', false);
    if (st.collapsed || st.hidden) setCollapsed(true);

    // 两个子页同时参与布局；设置开合、断点提示和窄屏换行时同步可见页高度。
    ui.grabObserver = new ResizeObserver(sizeGrabViewport);
    ui.grabPanels.forEach(panel => ui.grabObserver.observe(panel));

    // 菜单条目在页面加载完后就已存在（实测收起状态下也在 DOM 里），
    // 可以直接把方向按钮的提示补上
    setTimeout(updateHints, 1200);

    // 创作中心是 SPA，页面切了不刷新。盯着 URL 变化换采集区，并刷新「当前稿件」那一行。
    let lastHref = location.href;
    ui.watchTimer = setInterval(() => {
      if (!ui) return;
      try { syncAccount(); } catch (e) { say(e.message, 'err', 'global'); return; }
      if (location.href !== lastHref) {
        lastHref = location.href;
        routeTabs();
        refresh();
        setTimeout(updateHints, 1000);
      } else if (onArcPage() && !running) {
        renderArcCur();
      }
    }, 1500);
  }

  function makeDraggable(box, handle, isLauncher = false) {
    let drag = null;
    const down = e => {
      if (e.button !== 0 || (!isLauncher && e.target.closest('button'))) return;
      const rect = box.getBoundingClientRect();
      drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false, id: e.pointerId };
      handle.setPointerCapture(e.pointerId);
    };
    const move = e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
      drag.moved = true; e.preventDefault();
      box.style.right = 'auto'; box.style.bottom = 'auto';
      box.style.left = Math.max(0, Math.min(innerWidth - box.offsetWidth, drag.left + e.clientX - drag.x)) + 'px';
      box.style.top = Math.max(0, Math.min(innerHeight - box.offsetHeight, drag.top + e.clientY - drag.y)) + 'px';
    };
    const up = e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved && isLauncher && ui) {
        ui.skipLauncherClick = true;
        setTimeout(() => { if (ui) ui.skipLauncherClick = false; }, 0);
      }
      drag = null;
      if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    };
    handle.addEventListener('pointerdown', down);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
    return () => {
      handle.removeEventListener('pointerdown', down); handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
    };
  }

  const STATUS_DURATION = { info: 3500, ok: 4500, warn: 10000 };
  const STATUS_SCOPES = ['grab-list', 'grab-detail', 'rows', 'cols', 'global'];
  function currentStatusScope() {
    if (!ui) return 'grab-list';
    const tab = ui.tabs && ui.tabs.find(button => button.getAttribute('aria-selected') === 'true');
    const name = tab ? tab.getAttribute('data-tab') : 'grab';
    return name === 'grab' ? 'grab-' + (ui.grabSwitch && ui.grabSwitch.getAttribute('data-view') === 'detail' ? 'detail' : 'list') : name;
  }
  function statusState(msg, kind) {
    const duration = STATUS_DURATION[kind] || 0;
    return { msg, kind, remaining: duration, autoHide: duration > 0, expanded: false, revision: ++ui.statusSerial };
  }
  function pauseStatusTimer() {
    if (!ui || !ui.statusTimer) return;
    const { id, scope, revision, deadline } = ui.statusTimer;
    clearTimeout(id);
    const state = ui.statusByScope[scope];
    if (state && state.revision === revision) state.remaining = Math.max(0, deadline - Date.now());
    ui.statusTimer = null;
  }
  function displayedStatus() {
    const scope = ui.statusByScope.global && ui.statusByScope.global.msg ? 'global' : currentStatusScope();
    let state = ui.statusByScope[scope];
    // 进度独立保存：普通操作不抢占，警告到时关闭后还能继续看到最新进度。
    if (!(state && state.msg && (state.kind === 'err' || state.kind === 'warn')) && ui.progressByScope[scope])
      state = ui.progressByScope[scope];
    return { scope, state };
  }
  function renderStatus() {
    if (!ui || !ui.statusByScope) return;
    pauseStatusTimer();
    for (const state of Object.values(ui.statusByScope)) {
      if (state.autoHide && state.remaining <= 0) { state.msg = ''; state.autoHide = false; }
    }
    const { scope, state } = displayedStatus();
    const msg = state && state.msg || '', kind = msg ? state.kind : '';
    ui.status.className = 'st' + (msg ? ' ' + kind : ' empty')
      + (kind === 'err' || kind === 'warn' ? ' dismissible' : '') + (msg && state.expanded ? ' expanded' : '');
    ui.status.setAttribute('aria-live', kind === 'progress' ? 'off' : kind === 'err' ? 'assertive' : 'polite');
    ui.statusCopy.textContent = msg;
    ui.statusIcon.textContent = kind === 'ok' ? '✓' : kind === 'err' || kind === 'warn' ? '!' : kind === 'info' ? '·' : '';
    ui.status.title = msg;
    ui.statusExpand.hidden = !msg || !(state.expanded || ui.statusCopy.scrollHeight > ui.statusCopy.clientHeight + 1);
    ui.statusExpand.textContent = state && state.expanded ? '收起' : '展开';
    ui.statusExpand.setAttribute('aria-expanded', String(!!(state && state.expanded)));
    ui.wrap.style.setProperty('--bili-status-extra', `${Math.max(0, ui.status.offsetHeight - 40)}px`);
    if (!msg || !state.autoHide || state.expanded || ui.statusHovered || ui.statusFocused || document.hidden || ui.wrap.classList.contains('is-collapsed')) return;
    const owner = ui, revision = state.revision, deadline = Date.now() + state.remaining;
    const id = setTimeout(() => {
      if (ui !== owner || !ui.statusTimer || ui.statusTimer.id !== id) return;
      ui.statusTimer = null;
      const current = ui.statusByScope[scope];
      if (!current || current.revision !== revision) return;
      current.msg = ''; current.autoHide = false; current.remaining = 0;
      renderStatus();
    }, state.remaining);
    ui.statusTimer = { id, scope, revision, deadline };
  }
  // 同步操作可默认归当前区域；异步任务固定传入发起区域，并核对账号与任务代次。
  function say(msg, kind, scope = currentStatusScope()) {
    if (!ui) return;
    if (!STATUS_SCOPES.includes(scope)) throw new Error('未知的提示区域：' + scope);
    const resolved = msg ? kind || 'info' : '';
    const previous = ui.statusByScope[scope];
    if (msg && previous && previous.kind === 'err' && previous.msg) {
      if (resolved !== 'err' && resolved !== 'progress') return;
      if (resolved === 'err' && previous.msg === msg) return;
    }
    pauseStatusTimer();
    if (resolved === 'progress') ui.progressByScope[scope] = statusState(msg, resolved);
    else ui.statusByScope[scope] = statusState(msg, resolved);
    renderStatus();
  }
  function clearStatus(scope) {
    pauseStatusTimer();
    delete ui.statusByScope[scope]; delete ui.progressByScope[scope];
    renderStatus();
  }
  function finishStatus(msg, kind, scope) {
    if (!ui) return;
    delete ui.progressByScope[scope];
    say(msg, kind, scope);
  }
  function taskReporter(scope, context) {
    const owner = ui, epoch = ui.statusEpoch;
    clearStatus(scope);
    clearStatus('global');
    if (scope !== 'grab-detail') delete ui.progressByScope['grab-detail'];
    return (msg, kind = 'progress') => {
      if (ui !== owner || ui.statusEpoch !== epoch || !sameAccountContext(context)) return;
      if (kind !== 'progress') delete ui.progressByScope[scope];
      say(msg, kind, scope);
    };
  }
  function clearActionFeedback() {
    if (!ui) return;
    for (const [button, timer] of ui.buttonFeedbackTimers) { clearTimeout(timer); button.classList.remove('mp-confirmed'); }
    ui.buttonFeedbackTimers.clear(); ui.actionFeedback.textContent = '';
  }
  function flashActionButton(button, announcement) {
    if (!ui || !button) return;
    const owner = ui;
    clearTimeout(ui.buttonFeedbackTimers.get(button));
    button.classList.add('mp-confirmed');
    const timer = setTimeout(() => {
      if (ui !== owner || owner.buttonFeedbackTimers.get(button) !== timer) return;
      button.classList.remove('mp-confirmed'); owner.buttonFeedbackTimers.delete(button);
    }, 1200);
    ui.buttonFeedbackTimers.set(button, timer);
    ui.actionFeedback.textContent = announcement;
  }

  function selectTab(name, persist = true) {
    pauseStatusTimer();
    if (!['grab', 'cols', 'rows'].includes(name)) name = 'grab';
    ui.tabs.forEach(button => {
      const on = button.getAttribute('data-tab') === name;
      button.classList.toggle('on', on); button.setAttribute('aria-selected', String(on)); button.tabIndex = on ? 0 : -1;
    });
    ui.views.forEach(view => view.classList.toggle('hide', view.getAttribute('data-view') !== name));
    ui.body.classList.toggle('cols-active', name === 'cols');
    ui.body.classList.toggle('rows-active', name === 'rows');
    ui.body.scrollTop = 0;
    if (name === 'rows') renderRowWindow(true);
    if (name === 'grab') sizeGrabViewport();
    renderStatus();
    if (persist) uiState.patch({ activeTab: name });
  }
  function sizeGrabViewport() {
    if (!ui) return;
    const name = ui.grabViewport.getAttribute('data-view');
    const panel = ui.grabPanels.find(pane => pane.getAttribute('data-grab-panel') === name);
    const height = panel && panel.scrollHeight;
    if (height && ui.grabViewport.style.height !== `${height}px`) ui.grabViewport.style.height = `${height}px`;
  }
  function selectGrabView(name, persist = true) {
    pauseStatusTimer();
    name = name === 'detail' ? 'detail' : 'list';
    const previous = ui.grabSwitch.getAttribute('data-view');
    ui.grabSwitch.setAttribute('data-view', name);
    ui.grabViewport.setAttribute('data-view', name);
    ui.grabPanels.forEach(panel => {
      const selected = panel.getAttribute('data-grab-panel') === name;
      panel.inert = !selected; panel.setAttribute('aria-hidden', String(!selected));
    });
    ui.grabTabs.forEach(button => {
      const on = button.getAttribute('data-grab-view') === name;
      button.setAttribute('aria-selected', String(on)); button.tabIndex = on ? 0 : -1;
    });
    if (previous !== name) ui.body.scrollTop = 0;
    sizeGrabViewport();
    renderStatus();
    if (persist) uiState.patch({ grabView: name });
  }
  function setCollapsed(c) {
    pauseStatusTimer();
    ui.wrap.classList.toggle('is-collapsed', c);
    ui.root.querySelectorAll('[data-act="toggle"]').forEach(button => button.setAttribute('aria-expanded', String(!c)));
    if (!c) sizeGrabViewport();
    // 拖动后的坐标在展开时重新限制，确保面板始终留在视口内。
    if (!c && ui.wrap.style.left) {
      ui.wrap.style.left = Math.min(parseFloat(ui.wrap.style.left) || 0, Math.max(0, innerWidth - ui.wrap.offsetWidth - 12)) + 'px';
      ui.wrap.style.top = Math.min(parseFloat(ui.wrap.style.top) || 0, Math.max(0, innerHeight - ui.wrap.offsetHeight - 12)) + 'px';
    }
    uiState.patch({ collapsed: c, hidden: false });
    renderStatus();
  }
  function setHidden(h) {
    if (!h) { setCollapsed(false); return; }
    if (running || collecting) { stopTask(); say('正在停止…完成后可关闭', 'progress', runningAction === 'list' ? 'grab-list' : runningAction === 'refresh-selected' ? 'rows' : 'grab-detail'); return; }
    pauseStatusTimer(); clearActionFeedback();
    document.removeEventListener('visibilitychange', ui.onVisibility);
    clearInterval(ui.watchTimer);
    ui.grabObserver.disconnect();
    (ui.dragDisposers || []).forEach(dispose => dispose());
    ui.host.remove(); ui = null;
  }

  function routeTabs() {
    if (!ui) return;
    const k = onArcPage();
    ui.manual.style.display = k ? '' : 'none';
    if (k !== lastKind) { lastKind = k; }
  }

  /* ---- 列设置的拖动排序 ---- */
  function initDrag(box) {
    let el = null;
    const under = y => [...box.querySelectorAll('.crow:not(.drag)')]
      .find(r => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; });

    box.addEventListener('mousedown', e => {
      const grip = e.composedPath().find(n => n.classList && n.classList.contains('grip'));
      if (!grip) return;
      el = grip.closest('.crow');
      if (!el) return;
      el.classList.add('drag'); dragLock = true; e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!el) return;
      const a = under(e.clientY);
      if (a) box.insertBefore(el, a); else box.appendChild(el);
    });
    document.addEventListener('mouseup', () => {
      if (!el) return;
      el.classList.remove('drag'); el = null; dragLock = false;
      const order = [...box.querySelectorAll('.crow[data-col]')].map(x => x.getAttribute('data-col'));
      cfg.patch({ order });
      refresh();
      say('列顺序已保存', 'ok');
    });
  }

  function onColToggle(e) {
    const sk = e.target.closest && e.target.closest('.sk');
    if (sk) {
      const c = cfg.read();
      const col = sk.getAttribute('data-col');
      const i = c.sum.indexOf(col);
      if (sk.checked) { if (i < 0) c.sum.push(col); } else if (i >= 0) c.sum.splice(i, 1);
      cfg.write(c); refresh();
      say(`互动量 = ${sumCols().join(' + ') || '（空）'}`, 'ok');
      return;
    }
    const box = e.target.closest('.ck');
    if (!box) return;
    const c = cfg.read();
    const col = box.getAttribute('data-col');
    const i = c.off.indexOf(col);
    if (box.checked) { if (i >= 0) c.off.splice(i, 1); } else if (i < 0) c.off.push(col);
    cfg.write(c);
    box.closest('.crow').classList.toggle('off', !box.checked);
    refresh();
  }

  /* ---- 模板 ---- */
  function renderPresets() {
    const cur = cfg.read().preset;
    const names = presets.names();
    const star = presetDirty() ? ' *' : '';
    ui.preset.innerHTML = '<option value="">默认</option>' + names.map(n =>
      `<option value="${esc(n)}"${n === cur ? ' selected' : ''}>${esc(n)}${n === cur ? star : ''}</option>`).join('')
      + '<optgroup label="列操作"><option value="" data-col-command="all">全选所有列</option><option value="" data-col-command="none">取消所有列</option></optgroup>';
    if (!cur || names.indexOf(cur) < 0) ui.preset.value = '';
    const has = !!ui.preset.value;
    ui.ovBtn.disabled = !has; ui.renBtn.disabled = !has; ui.delBtn.disabled = !has;
    ui.ovBtn.classList.toggle('hot', has && presetDirty());
  }

  function onPresetPick() {
    const command = ui.preset.selectedOptions[0]?.getAttribute('data-col-command');
    if (command) {
      cfg.patch({ off: command === 'all' ? [] : EXPORT_SCHEMA.map(c => c.col) });
      refresh(); say(command === 'all' ? '已勾选全部列' : '已取消全部勾选', 'ok'); return;
    }
    const name = ui.preset.value;
    if (!name) { cfg.reset(); say('已切回默认设置', 'ok'); }
    else if (presets.apply(name)) say(`已套用模板「${name}」`, 'ok');
    refresh();
  }

  function askName(tip, dflt) {
    const s = (prompt(tip, dflt || '') || '').trim();
    if (!s) return '';
    if (s === '默认') { say('「默认」是保留名字，换一个', 'err'); return ''; }
    return s;
  }

  /* ==========================================================================
   * 16. 重绘
   * ========================================================================== */
  function refresh() {
    if (!ui || dragLock) return;
    const L = lib.read();
    const pending = lib.pending({ overview: wantOv });
    const pend = pending.length;

    renderLibrarySummary();

    if (migrated) {
      ui.warn.className = 'warnbar info';
      ui.warn.innerHTML = migrated.merged
        ? `已从旧库补回 ${migrated.added} 条稿件，补全 ${migrated.completed} 条的空字段或标签；当前共 ${migrated.total} 条。当前进度、原始旧库与首次认领前保护副本保留。`
        : migrated.from === 'merged'
        ? `已从「内容数据一站抓取」的合并库里迁入 <b>${migrated.total}</b> 条稿件`
          + `（覆盖进度 ${migrated.donePn} 页也一起搬过来了）。`
          + '<br>标签和「详情已补」的标记全都在，接着用就行，不用重抓。合并库没有被删。'
        : migrated.from === 'unowned' ? `已将旧库 ${migrated.total} 条稿件复制到当前 UID；原始旧库保留。`
        : `已从旧的「B站稿件数据采集 5.x」迁入 <b>${migrated.total}</b> 条。`
          + '<br>列名统一过了：投币量→投币、弹幕量→弹幕、涨粉数→涨粉、视频长度→时长，'
          + '旧的导出表格对不上是正常的。';
      ui.warn.style.display = '';
    } else {
      ui.warn.style.display = 'none';
    }

    ui.modeBtns.forEach(b => {
      const key = b.getAttribute('data-mode'), on = key === mode;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.title = MODE_HINT[key];
    });
    ui.hint.textContent = MODE_HINT[mode];
    ui.grabOptionsLabel.textContent = mode === 'refresh' ? '更多设置 · 刷新全部模式' : '更多设置';
    ui.dateRow.style.display = mode === 'inc' ? 'none' : '';
    ui.both.checked = arcBoth;

    ui.bothTxt.textContent = '抓列表时同时获取完播率和涨粉';
    ui.both.disabled = ui.wantOv.disabled = ui.speed.disabled = running || collecting;
    ui.speed.value = detailSpeed;
    ui.pending.textContent = pend ? `待补详情：${pend} 条` : '暂无待补详情';
    ui.detailBtn.disabled = running ? runningAction !== 'detail' : collecting || !pend;
    ui.wantOv.checked = wantOv;
    ui.wantOvTxt.textContent = '同时补退粉和充电';
    const estimate = estimateDetailRequests(pending, { overview: wantOv });
    const na = L.rows.filter(r => detailDone(r) && r._progNA).length;
    const ovNA = wantOv ? L.rows.filter(r => overviewDone(r) && r._overviewNA).length : 0;
    const missing = [na ? `${na} 条的平均播放进度接口未提供` : '', ovNA ? `${ovNA} 条的退粉/充电接口未完整提供` : ''].filter(Boolean);
    ui.detailEstimate.textContent = (pend ? `本次全部待补项约 ${estimate.min === estimate.max ? estimate.max : `${estimate.min}–${estimate.max}`} 个请求，可随时停止。` : '')
      + (missing.length ? missing.join('；') + '，已有值保留。' : '');

    // 6.0 升上来的库会突然冒出一大批「还没补详情」。不说清楚，看着像脚本抽风
    const stale = lib.stale().length;
    ui.detailNote.textContent =
      '播放分析与退粉/充电分别记录获取状态，只补尚未完成的部分；缺少 cid 时会增加一次查询。'
      + '接口未提供的指标保留已有值，不会填成 0；需要重试时在稿件页勾选后「获取实时数据」。'
      + '该操作与补详情共用速度；单独抓列表仍使用默认节奏。'
      + (stale ? `　⚠ 其中 ${stale} 条是 6.0 补过的 —— 6.0 取错了字段，`
        + '平均播放进度一直是空的，所以它们要用新接口再补一遍。已有的数字和标签不会动。' : '');
    ui.count.textContent = String(L.rows.length);

    // 勾选的内容可能已经被清库/删行删掉了，清理一下
    if (sel.size) {
      const live = new Set(L.rows.map(r => r._id));
      for (const k of [...sel]) if (!live.has(k)) sel.delete(k);
    }

    renderArcCur();
    renderTagFilter();
    syncFilterInputs();
    renderRules();
    renderFilterSummary();
    renderRows();

    const n = scopeRows().length;
    ui.copy.disabled = ui.csv.disabled = !n;
    ui.copy.textContent = n ? `复制 ${n} 条` : '复制';
    ui.csv.textContent = n ? `导出 ${n} 条` : '导出 CSV';
    renderScope();

    renderCols(scopeRows()[0] || L.rows[0] || {});
    renderResume();
    renderPresets();
    updateImpApply();
    renderAccount();
    sizeGrabViewport();
  }

  function renderArcCur() {
    if (!ui || !onArcPage()) return;
    const s = currentArcState();
    if (!s) { ui.arcCur.textContent = '正在等数据区加载…'; return; }
    if (!s.row) {
      ui.arcCur.innerHTML = `当前页面：<b>${esc(cut(s.title, 22))}</b> · <span style="color:#c76b00">库里还没有</span>`;
      return;
    }
    const c = completeness(s.row);
    const label = { full: '数据全齐', noext: '缺扩展指标', nocore: '缺核心数据' }[c];
    const color = c === 'full' ? '#0a9e4a' : (c === 'noext' ? '#c76b00' : '#d33');
    ui.arcCur.innerHTML = `当前页面：<b>${esc(cut(s.title, 22))}</b> · `
      + `<span style="color:${color}">${label}</span>`
      + (s.row.数据时间 ? ` · 上次 ${esc(s.row.数据时间)}` : '');
  }

  function renderCols(sample) {
    const picked = cfg.read().sum;
    const out = [];
    for (const { c, on } of orderedSchema()) {
      const v = cellOf(sample, c);
      const cls = 'crow' + (c.calc ? ' calc' : '') + (on ? '' : ' off');
      let chip = '';
      if (c.col === '时长' || c.col === '平均播放进度') {
        const label = durFmt === 'cn' ? '时分秒' : '时:分:秒';
        chip = `<button class="chip" data-act="dur-toggle" title="${esc('两列共用时长格式；点击切换为 ' + durFmtAt(nextDurFmt()).fn(4830))}">${label}</button>`;
      } else if (c.col === '互动量') {
        chip = `<button class="chip" data-act="sum-edit" title="${esc(sumCols().join(' + ') || '未选任何项')}">${sumCols().length} 项 ${sumOpen ? '▴' : '▾'}</button>`;
      }
      const tags = [];
      if (c.detail) tags.push('详情');
      if (c.only) tags.push(c.only.join('/') + '专有');
      const tag = tags.length ? `<span class="tag">${esc(tags.join(' '))}</span>` : '';
      out.push(`<div class="${cls}" data-col="${esc(c.col)}">
          <span class="grip" title="按住上下拖动调整顺序">⠿</span>
          <input type="checkbox" class="ck" data-col="${esc(c.col)}"${on ? ' checked' : ''} title="勾选才导出">
          <span class="cn">${esc(headerName(c))}${tag}</span>
          <span class="cv${v === '' ? ' miss' : ''}" title="${esc(v)}">${v === '' ? '—' : esc(v)}</span>
          ${chip}
        </div>`);

      if (c.col === '互动量' && sumOpen) {
        const ops = EXPORT_SCHEMA.filter(x => x.sumable).map(x =>
          `<label><input type="checkbox" class="sk" data-col="${esc(x.col)}"${picked.indexOf(x.col) >= 0 ? ' checked' : ''}>${esc(x.col)}</label>`).join('');
        out.push(`<div class="sub"><div class="h">互动量 = 勾选项相加</div>
            <div class="ops">${ops}</div></div>`);
      }
    }
    ui.cols.innerHTML = out.join('');
  }

  /* ---- 筛选控件的双向同步 ---- */
  function publicationDateKey(value) {
    const parts = cell(value).trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
      || cell(value).trim().match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!parts) return 0;
    const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return 0;
    return year * 10000 + month * 100 + day;
  }

  function clearDateFilterError() {
    ui.dateError.textContent = '';
    ui.dateError.hidden = true;
  }

  function datePartInputs(group) {
    return [...group.querySelectorAll('[data-date-part]')];
  }

  function setDateParts(group, value) {
    const match = cell(value).match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})$/);
    datePartInputs(group).forEach((input, index) => { input.value = match ? match[index + 1] : ''; });
    const picker = group.querySelector('.date-native-picker');
    if (picker) picker.value = match && publicationDateKey(value) ? match.slice(1).join('-') : '';
  }

  function readDateParts(group) {
    const parts = datePartInputs(group).map(input => input.value.trim());
    if (parts.every(value => !value)) return '';
    if (parts.some((value, index) => !/^\d+$/.test(value) || value.length !== [4, 2, 2][index])) return null;
    return parts.join('-');
  }

  function onDatePartInput(e) {
    const input = e.target.closest('[data-date-part]');
    if (!input || e.isComposing) return;
    const clean = input.value.replace(/\D/g, '').slice(0, input.maxLength);
    if (input.value !== clean) input.value = clean;
    clearDateFilterError();
    const parts = datePartInputs(input.closest('.date-filter-inputs'));
    const index = parts.indexOf(input);
    if (index < 2 && input.value.length === input.maxLength
      && input.selectionStart === input.value.length && e.inputType?.startsWith('insert')) parts[index + 1].focus();
  }

  function onDatePaste(e) {
    const input = e.target.closest('[data-date-part]');
    if (!input) return;
    const value = (e.clipboardData?.getData('text') || '').trim();
    const match = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
      || value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!match) return;
    e.preventDefault();
    const group = input.closest('.date-filter-inputs');
    setDateParts(group, `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`);
    clearDateFilterError();
    datePartInputs(group)[2].focus();
  }

  function onDatePartKeydown(e) {
    const input = e.target.closest('[data-date-part]');
    if (e.key === 'Escape') {
      e.preventDefault(); closeDateFilterPanel(); ui.dateToggle.focus({ preventScroll: true }); return;
    }
    if (e.key === 'Enter' && input) { e.preventDefault(); applyDateFilter(); return; }
    if (!input || e.key !== 'Backspace' || input.value) return;
    const parts = datePartInputs(input.closest('.date-filter-inputs'));
    const previous = parts[parts.indexOf(input) - 1];
    if (previous) { e.preventDefault(); previous.focus(); previous.setSelectionRange(previous.value.length, previous.value.length); }
  }

  function onDateFilterChange(e) {
    const picker = e.target.closest('.date-native-picker');
    if (!picker) { clearDateFilterError(); return; }
    if (picker.value && !/^\d{4}-\d{2}-\d{2}$/.test(picker.value)) {
      ui.dateError.textContent = '年份必须是 4 位'; ui.dateError.hidden = false; return;
    }
    setDateParts(picker.closest('.date-filter-inputs'), picker.value);
    clearDateFilterError();
  }

  function openNativeDatePicker(group) {
    const picker = group.querySelector('.date-native-picker');
    const current = readDateParts(group);
    picker.value = current && publicationDateKey(current) ? current : '';
    try {
      if (typeof picker.showPicker !== 'function') throw new Error('unsupported');
      picker.showPicker();
    } catch (_) {
      ui.dateError.textContent = '此浏览器无法打开日历，请手动输入日期'; ui.dateError.hidden = false;
    }
  }

  function closeDateFilterPanel() {
    ui.datePanel.hidden = true;
    ui.dateToggle.setAttribute('aria-expanded', 'false');
    clearDateFilterError();
  }

  function openDateFilterPanel() {
    const f = filt.read();
    tagPanelOpen = false; renderTagFilter();
    setDateParts(ui.dateFrom, f.from); setDateParts(ui.dateTo, f.to);
    clearDateFilterError();
    ui.datePanel.hidden = false;
    ui.dateToggle.setAttribute('aria-expanded', 'true');
    datePartInputs(ui.dateFrom)[0].focus({ preventScroll: true });
  }

  function applyDateFilter() {
    const from = readDateParts(ui.dateFrom), to = readDateParts(ui.dateTo);
    const fromKey = from ? publicationDateKey(from) : 0, toKey = to ? publicationDateKey(to) : 0;
    if (from === null || to === null || (from && !fromKey) || (to && !toKey)) {
      ui.dateError.textContent = '请输入完整有效的日期（yyyy/mm/dd）'; ui.dateError.hidden = false; return;
    }
    if (fromKey && toKey && fromKey > toKey) {
      ui.dateError.textContent = '开始日期不能晚于结束日期'; ui.dateError.hidden = false; return;
    }
    filt.patch({ from, to }); closeDateFilterPanel(); refresh();
  }

  function clearDateFilter() {
    filt.patch({ from: '', to: '' });
    setDateParts(ui.dateFrom, ''); setDateParts(ui.dateTo, '');
    closeDateFilterPanel(); refresh();
  }

  function syncFilterInputs() {
    const f = filt.read();
    if (ui.q.value !== f.q) ui.q.value = f.q;
    if (ui.stF.value !== f.st) ui.stF.value = f.st;
    if (!ui.datePanel || ui.datePanel.hidden) {
      setDateParts(ui.dateFrom, f.from);
      setDateParts(ui.dateTo, f.to);
    }
    if (ui.sortSel.value !== f.sort) ui.sortSel.value = f.sort;
    ui.sortDir.textContent = f.desc ? '↓' : '↑';
    if (ui.dateToggle) {
      ui.dateToggle.classList.toggle('active', !!(f.from || f.to));
      ui.dateToggle.title = f.from || f.to ? `发布日期：${f.from || '不限'} 至 ${f.to || '不限'}` : '按发布日期筛选';
      ui.dateToggle.setAttribute('aria-label', ui.dateToggle.title);
    }
    ui.sortDir.title = f.desc ? '当前：从大到小 / 从新到旧' : '当前：从小到大 / 从旧到新';
    ui.ruleCnt.textContent = f.rules.length ? String(f.rules.length) : '';
    ui.ruleToggle.textContent = rulesOpen ? '收起' : '展开';
    ui.rules.style.display = rulesOpen ? '' : 'none';
  }

  function renderTagFilter() {
    const f = filt.read();
    const query = ui.tagSearch.value.trim().toLowerCase();
    // 搜索只缩小候选列表；已选标签始终保存在筛选中，不因搜索或标签暂时缺失被清除。
    const tags = [...new Set([...lib.allTags(), ...f.tags])].sort();
    const candidates = tags.filter(t => t.toLowerCase().includes(query));
    const detailLabel = f.detail === 'yes' ? '有详情' : f.detail === 'no' ? '无详情' : '';
    let label = f.untagged ? '无自定义标签' : f.tags.length > 1 ? `已选 ${f.tags.length} 个标签` : f.tags.length ? f.tags[0] : '标签不限';
    if (detailLabel) label = label === '标签不限' ? detailLabel : `${label} · ${detailLabel}`;
    if (ui.tagLabel) ui.tagLabel.textContent = label; else ui.tagF.textContent = label + ' ⌕';
    ui.tagF.title = f.tags.length ? f.tags.join(' 或 ') : '搜索和多选标签';
    ui.tagF.setAttribute('aria-expanded', String(tagPanelOpen));
    ui.tagF.setAttribute('aria-label', '标签筛选：' + label);
    ui.tagF.classList?.toggle('active', f.untagged || !!f.tags.length || f.detail !== 'all' || !!f.st || !!f.rules.length);
    if (ui.root) ui.root.querySelectorAll('[data-tag-detail]').forEach(input => { input.checked = input.value === f.detail; });
    ui.tagPanel.hidden = !tagPanelOpen;
    ui.tagNone.checked = f.untagged;
    ui.tagCount.textContent = f.untagged ? '无标签' : `已选 ${f.tags.length} 项`;
    const scroll = ui.tagOptions.scrollTop;
    ui.tagOptions.innerHTML = candidates.length ? candidates.map(t =>
      `<label class="tag-option"><input type="checkbox" data-tag-option value="${esc(t)}"${f.tags.includes(t) ? ' checked' : ''}><span>${esc(t)}</span></label>`).join('')
      : '<div class="fnote">没有匹配的标签</div>';
    ui.tagOptions.scrollTop = scroll;
  }

  function updateTagSelection(kind, value, checked) {
    const f = filt.read();
    if (kind === 'none') {
      f.untagged = checked;
      if (checked) f.tags = [];
    } else {
      f.tags = checked ? [...new Set([...f.tags, value])] : f.tags.filter(t => t !== value);
      if (checked) f.untagged = false;
    }
    filt.write(f);
  }

  function onTagFilterChange(e) {
    const box = e.target;
    if (box.matches('[data-tag-detail]')) { filt.patch({ detail: box.value }); }
    else if (box.matches('[data-tag-none]')) updateTagSelection('none', '', box.checked);
    else if (box.matches('[data-tag-option]')) updateTagSelection('tag', box.value, box.checked);
    else return;
    refresh();
  }

  function renderRules() {
    const f = filt.read();
    const cols = numColumns();
    if (!f.rules.length) {
      ui.rules.innerHTML = '<div class="fnote">还没有数值条件。点「+ 加一条」，'
        + '比如「播放量 ≥ 1000」或「互动率 ≤ 2」。<br>'
        + '可选的列就是列设置里的数字列 —— 以后加一列数据，这儿自动就能筛它。</div>';
      return;
    }
    ui.rules.innerHTML = f.rules.map((r, i) => {
      const opt = cols.map(c => `<option value="${esc(c)}"${c === r.col ? ' selected' : ''}>${esc(c)}</option>`).join('');
      const ops = OPS.map(o => `<option value="${o}"${o === r.op ? ' selected' : ''}>${o}</option>`).join('');
      const pct = (r.col === '互动率' || r.col === '完播率') ? '<span class="unit">%</span>' : '';
      const dur = (r.col === '时长' || r.col === '平均播放进度') ? '<span class="unit">秒</span>' : '';
      return `<div class="rule" data-i="${i}">
          <select class="rc" data-rc>${opt}</select>
          <select class="ro" data-ro>${ops}</select>
          <input type="number" data-rv value="${esc(r.v)}" step="any">
          ${pct}${dur}
          <button class="del" data-act="rule-del" data-i="${i}" title="删掉这条">×</button>
        </div>`;
    }).join('')
      + '<div class="fnote">没有该指标的稿件会被排除 —— 比如「完播率」只有抓过列表的才有，'
      + '「平均播放进度」只有补过详情、而且接口真给了数的才有。</div>';
  }

  function onRuleChange(e) {
    const row = e.target.closest && e.target.closest('.rule');
    if (!row) return;
    const i = Number(row.getAttribute('data-i'));
    const f = filt.read();
    if (!f.rules[i]) return;
    const rc = row.querySelector('[data-rc]'), ro = row.querySelector('[data-ro]'), rv = row.querySelector('[data-rv]');
    f.rules[i] = { col: rc.value, op: ro.value, v: rv.value === '' ? 0 : Number(rv.value) };
    filt.write(f);
    // 改的是数字输入框就别整段重绘，否则光标会被踢出来
    if (e.target === rv) { renderFilterSummary(); renderRows(); renderScope(); }
    else refresh();
  }

  function renderFilterSummary() {
    const label = filterLabel();
    ui.fsum.textContent = label || '没开任何筛选条件，范围就是全库';
    ui.fsum.className = 'fsum' + (label ? '' : ' none');
    const summary = ui.root && ui.root.querySelector('.filter-summary');
    if (summary) summary.hidden = !label;
    const total = lib.read().rows.length;
    const n = filtered().length;
    ui.fcnt.textContent = isFiltering() ? `筛出 ${n} / ${total} 条` : `全库 ${total} 条`;
  }

  function renderRows() {
    const rows = filtered();
    const total = lib.read().rows.length;
    syncRowOrder(rows);
    const filterKey = JSON.stringify([accountContext().id, filt.read(), rows.map(row => row._id)]);
    if (filterKey !== ui.rowFilterKey) {
      ui.rowFilterKey = filterKey;
      ui.list.scrollTop = 0;
    }
    ui.virtualRows = rows;
    const dates = rows.map(row => row.发布日期).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date || '')).sort();
    ui.selInfo.textContent = `共 ${rows.length} 条` + (dates.length ? `（${dates[0]}—${dates[dates.length - 1]}）` : '');
    const visibleIds = new Set(rows.map(row => row._id));
    const hiddenSelected = [...sel].filter(id => !visibleIds.has(id)).length;
    ui.selectionHint.textContent = hiddenSelected
      ? `已勾选 ${hiddenSelected} 条不在当前筛选结果内；对已勾选稿件的操作仍包含它们。` : '';
    ui.selectionHint.hidden = !hiddenSelected;

    // 排掉没有 BV 号的行（手动采集时页面没给号的那些）
    const selDetailable = lib.read().rows.filter(r => sel.has(r._id) && detailable(r));
    const refreshingSelected = running && runningAction === 'refresh-selected';
    ui.refBtn.disabled = refreshingSelected ? false : !selDetailable.length || running || collecting;
    ui.refBtn.textContent = refreshingSelected ? '停止' : '获取实时数据';
    ui.refBtn.title = refreshingSelected ? '停止获取，已取得的数据会保留'
      : selDetailable.length ? `只更新已勾选的 ${selDetailable.length} 条稿件：列表和详情指标一起更新`
      : '请先勾选有 BV 号的稿件';
    ui.tagBtn.disabled = !sel.size;
    if (ui.tagBtnLabel) ui.tagBtnLabel.textContent = '编辑标签';
    else ui.tagBtn.textContent = sel.size ? `标签… ${sel.size} 条` : '标签…';

    if (!rows.length) {
      ui.rowWindowStart = ui.rowWindowEnd = -1;
      ui.list.innerHTML = `<div class="more">${total ? '没有符合条件的稿件' : '稿件库还是空的'}</div>`;
      return;
    }
    renderRowWindow(true);
  }

  function rowViewportHeight() {
    return ui.list.clientHeight || (typeof innerHeight === 'number' ? innerHeight : 900) * 0.28;
  }

  function renderRowWindow(force = false) {
    const rows = ui.virtualRows || [];
    if (!rows.length) return;
    const list = ui.list;
    const visible = Math.max(1, Math.ceil(rowViewportHeight() / ROW_HEIGHT));
    const start = Math.max(0, Math.min(Math.floor(list.scrollTop / ROW_HEIGHT) - ROW_OVERSCAN,
      rows.length - visible - ROW_OVERSCAN * 2));
    const end = Math.min(rows.length, start + visible + ROW_OVERSCAN * 2);
    if (!force && start === ui.rowWindowStart && end === ui.rowWindowEnd) return;
    ui.rowWindowStart = start; ui.rowWindowEnd = end;
    const active = ui.root && ui.root.activeElement;
    const focusedRow = active && active.closest && active.closest('.it');
    const focusedId = focusedRow ? active.getAttribute('data-id') : '';
    const focusedIndex = focusedId ? rows.findIndex(row => row._id === focusedId) : -1;
    const focusedSelector = active && active.classList.contains('t') ? '.t' : '.rk';
    if (focusedRow && (focusedIndex < start || focusedIndex >= end)) list.focus({ preventScroll: true });
    const curArc = currentArcState();
    const curId = curArc ? curArc.id : '';
    const shown = rows.slice(start, end);
    const flagTip = {
      full: '核心数据和扩展指标都有',
      noext: '缺扩展指标 —— 还没「补详情」（或者是 6.0 用旧接口补的，得再补一遍）',
      nocore: '连播放量都没有 —— 视频请到「数据总览」再采一次',
    };
    const scrollTop = list.scrollTop;
    list.innerHTML = `<div aria-hidden="true" style="height:${start * ROW_HEIGHT}px"></div>` + shown.map((r, offset) => {
      const on = sel.has(r._id);
      const c = completeness(r);
      // 补过详情但接口没给平均播放进度 —— 标出来，免得看着像脚本漏了
      const naTip = r._progNA ? '（已补详情，但接口没给平均播放进度）' : '';
      const finPct = finishPct(r);
      const tags = (r._tags || []).map(t => '#' + t).join(' ');
      return `<div class="it${fresh.has(r._id) ? ' new' : ''}${on ? ' sel' : ''}${r._id === curId ? ' cur' : ''}"
         data-index="${start + offset}" role="listitem" aria-posinset="${start + offset + 1}" aria-setsize="${rows.length}">
         <input type="checkbox" class="rk" aria-label="选择稿件：${esc(r.标题)}" data-id="${esc(r._id)}"${on ? ' checked' : ''}>
         <span class="d">${esc(r.发布日期 || '')}</span>
         <span class="t" data-id="${esc(r._id)}" data-open="${esc(r.链接)}" role="link" tabindex="0" title="${esc(r.标题)} · 播放 ${esc(r.播放量 || '—')} · 完播率 ${finPct === null ? '—' : esc(finPct.toFixed(2) + '%')}">${esc(r.标题 || '(无标题)')}</span>
         ${tags ? `<span class="tags" title="${esc(tags)}">${esc(tags)}</span>` : ''}
         ${c !== 'full' || r._progNA ? `<span class="flag ${c}" title="${esc(flagTip[c] + naTip)}">${r._progNA ? '待核查' : c === 'noext' ? '无详情' : '缺核心'}</span>` : ''}
       </div>`;
    }).join('') + `<div aria-hidden="true" style="height:${(rows.length - end) * ROW_HEIGHT}px"></div>`;
    if (list.scrollTop !== scrollTop) list.scrollTop = scrollTop;
    if (focusedIndex >= start && focusedIndex < end)
      list.querySelector(`.it[data-index="${focusedIndex}"] ${focusedSelector}`)?.focus({ preventScroll: true });
  }

  function focusVirtualRow(index, selector = '.rk') {
    const rows = ui.virtualRows || [];
    if (!rows.length) return;
    const next = Math.max(0, Math.min(rows.length - 1, index));
    const top = next * ROW_HEIGHT;
    const viewport = rowViewportHeight();
    if (top < ui.list.scrollTop) ui.list.scrollTop = top;
    else if (top + ROW_HEIGHT > ui.list.scrollTop + viewport)
      ui.list.scrollTop = top + ROW_HEIGHT - viewport;
    renderRowWindow(true);
    ui.list.querySelector(`.it[data-index="${next}"] ${selector}`)?.focus({ preventScroll: true });
  }

  function onListKeydown(e) {
    const target = e.target.closest && e.target.closest('.rk, .t');
    if (target && target.classList.contains('t') && e.key === 'Enter') {
      e.preventDefault(); target.click(); return;
    }
    if (e.target !== ui.list && !target) return;
    const rows = ui.virtualRows || [];
    if (!rows.length) return;
    const current = target ? Number(target.closest('.it').getAttribute('data-index')) : Math.floor(ui.list.scrollTop / ROW_HEIGHT);
    const page = Math.max(1, Math.floor(rowViewportHeight() / ROW_HEIGHT));
    let next;
    if (e.key === 'ArrowDown') next = target ? current + 1 : current;
    else if (e.key === 'ArrowUp') next = target ? current - 1 : current;
    else if (e.key === 'PageDown') next = current + page;
    else if (e.key === 'PageUp') next = current - page;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = rows.length - 1;
    else return;
    e.preventDefault();
    focusVirtualRow(next, target && target.classList.contains('t') ? '.t' : '.rk');
  }

  /**
   * 作用域说明。勾选跨筛选保留，所以要明确点出「勾了的有几条不在当前筛选里」——
   * 不然「筛出 3 条却导出了 10 条」看着像 bug。
   */
  function renderScope() {
    let txt = scopeLabel();
    if (sel.size) {
      const inView = new Set(filtered().map(r => r._id));
      const out = [...sel].filter(id => !inView.has(id)).length;
      if (out) txt += `（其中 ${out} 条不在当前筛选结果里）`;
    }
    ui.copy.title = `复制：${txt}`;
    ui.csv.title = `导出：${txt}`;
  }

  function syncRowOrder(rows) {
    const key = JSON.stringify(rows.map(r => r._id));
    if (rowOrderKey !== key) {
      selectionAnchor = null;
      rowOrderKey = key;
    }
  }

  function applyRowSelection(id, checked, shiftKey) {
    const rows = filtered();
    syncRowOrder(rows);
    const target = rows.findIndex(r => r._id === id);
    if (target < 0) return;
    const anchor = selectionAnchor == null ? -1 : rows.findIndex(r => r._id === selectionAnchor);
    const first = shiftKey && anchor >= 0 ? Math.min(anchor, target) : target;
    const last = shiftKey && anchor >= 0 ? Math.max(anchor, target) : target;
    for (let i = first; i <= last; i++) {
      if (checked) sel.add(rows[i]._id); else sel.delete(rows[i]._id);
    }
    selectionAnchor = id;
  }

  function onRowCheck(e) {
    const box = e.target.closest && e.target.closest('.rk');
    if (!box) return;
    applyRowSelection(box.getAttribute('data-id'), box.checked, e.shiftKey === true);
    refresh();
  }

  function renderResume() {
    const p = progress.read();
    if (!p) { ui.resume.style.display = 'none'; return; }
    const w = new Date(p.at || Date.now());
    const name = { inc: '增量更新', older: '补抓更早', refresh: '刷新全部', full: '重新全抓' }[p.mode] || '上次';
    ui.resumeTxt.textContent = `「${name}」${p.complete ? '待写入主库' : '已暂存'} ${p.rows.length} 条`
      + `（${w.getMonth() + 1}/${w.getDate()} ${pad(w.getHours())}:${pad(w.getMinutes())}）`;
    ui.resume.style.display = '';
  }

  /* ---- 标签 JSON 导入 ---- */
  function invalidatePlan() {
    impPlan = null;
    if (!ui) return;
    ui.impPrev.style.display = 'none';
    updateImpApply();
  }

  /** 让动作按钮自己把「点下去会发生什么」说清楚 */
  function updateImpApply() {
    if (!ui) return;
    const n = impPlan ? impPlan.affected : 0;
    ui.impApply.disabled = !n;
    ui.impApply.textContent = n
      ? `${impMode === 'replace' ? '覆盖' : '追加'}导入到 ${n} 条`
      : '导入（先粘贴或选文件）';
  }

  /** 读文件文本。优先 Blob.text()，绕开 FileReader 在某些油猴沙箱里的怪毛病 */
  function readFileText(f) {
    if (typeof f.text === 'function') return f.text();
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = () => reject(fr.error || new Error('读取失败'));
      try { fr.readAsText(f, 'utf-8'); } catch (e) { reject(e); }
    });
  }

  /**
   * 选了文件。每一步都要么成功、要么出声 ——
   * 把重置 input 和触发预览写在同一个回调里的话，重置那行一抛错预览就跟着没了，
   * 而 FileReader 回调里的异常不会冒出来，表现就是「毫无反应」。
   */
  async function onImpFile(e) {
    const input = e.target;
    const f = input.files && input.files[0];
    if (!f) return;
    const owner = ui, epoch = ui.statusEpoch;

    say(`正在读取 ${f.name}…`, 'info', 'rows');
    let text = '';
    try { text = await readFileText(f); }
    catch (err) {
      if (ui === owner && ui.statusEpoch === epoch) say(`读不出这个文件：${(err && err.message) || err}。可以打开文件把内容直接粘到上面的框里`, 'err', 'rows');
      return;
    }
    if (ui !== owner || ui.statusEpoch !== epoch) return;

    ui.impText.value = text;
    try { input.value = ''; } catch (err) { /* 有些环境不让重置 */ }
    say(`已读入 ${f.name}（${text.length} 字符）`, 'ok', 'rows');
    try { doImpPreview(); }
    catch (err) { showImpPrev('预览时出错：' + esc((err && err.message) || err), true); }
  }

  function doImpPreview() {
    invalidatePlan();
    const text = (ui.impText.value || '').trim();
    if (!text) { showImpPrev('先粘贴 JSON，或者选一个 .json 文件', true); return; }

    const parsed = parseTagJson(text);
    if (parsed.error) { showImpPrev(esc(parsed.error), true); return; }

    const plan = planTagImport(parsed.entries);
    impPlan = plan;

    const lines = [];
    lines.push(`解析出 <b>${plan.entries}</b> 条，能对上 <b>${plan.affected}</b> 条内容`
      + `（${impMode === 'replace' ? '覆盖已有标签' : '追加到已有标签'}）`);
    if (plan.fuzzy) lines.push(`<span class="warn">${plan.fuzzy} 条是靠标题模糊匹配的，建议核对</span>`);
    if (plan.dup) lines.push(`<span class="warn">${plan.dup} 条标题在库里重名，会同时打给多条</span>`);
    if (plan.ambiguous.length) {
      lines.push(`<span class="warn">${plan.ambiguous.length} 条有歧义、已跳过：</span>`);
      plan.ambiguous.slice(0, 5).forEach(x => lines.push('· ' + esc(x)));
      if (plan.ambiguous.length > 5) lines.push(`· …另外 ${plan.ambiguous.length - 5} 条`);
    }
    if (plan.unmatched.length) {
      lines.push(`<span class="warn">${plan.unmatched.length} 条没匹配上：</span>`);
      plan.unmatched.slice(0, 5).forEach(x => lines.push('· ' + esc(x)));
      if (plan.unmatched.length > 5) lines.push(`· …另外 ${plan.unmatched.length - 5} 条`);
    }
    showImpPrev(lines.join('<br>'), false);
    updateImpApply();
    if (plan.unmatched.length || plan.ambiguous.length) {
      console.log('[B站稿件数据] 没匹配上的：', plan.unmatched, '有歧义的：', plan.ambiguous);
    }
  }

  function showImpPrev(html, isErr) {
    ui.impPrev.innerHTML = html;
    ui.impPrev.className = 'impprev' + (isErr ? ' err' : '');
    ui.impPrev.style.display = '';
  }

  function cutoffTs() {
    const v = ui.since.value;
    if (!v) return 0;
    const [y, m, d] = v.split('-').map(Number);
    if (!y || !m || !d) return 0;
    return new Date(y, m - 1, d, 0, 0, 0).getTime();
  }

  function planFor(m) {
    const L = lib.read();
    const base = { mode: m, both: arcBoth };
    if (m === 'inc') return Object.assign(base, { startPn: 1, stopAtTs: lib.newestTs(), cutoffTs: 0 });
    if (m === 'older') {
      return Object.assign(base, {
        startPn: L.doneBoth === arcBoth ? (L.donePn || 0) + 1 : 1, stopAtTs: 0, cutoffTs: cutoffTs(),
      });
    }
    // full 成功后替换，refresh 逐页合并且保留库内其他稿件。
    return Object.assign(base, { startPn: 1, stopAtTs: 0, cutoffTs: cutoffTs() });
  }

  /* ==========================================================================
   * 17. 事件
   * ========================================================================== */
  async function onClick(e) {
    const b = e.target.closest('[data-act], [data-tab], [data-grab-view], [data-mode], [data-days], [data-fdays], .t');
    if (!b) return;

    if (b.classList.contains('t')) {
      const link = b.getAttribute('data-open');
      if (link) window.open(link, '_blank');
      else say('这条没有链接（页面没给 BV 号）', 'warn');
      return;
    }
    const tab = b.getAttribute('data-tab');
    if (tab) { selectTab(tab); return; }
    const grab = b.getAttribute('data-grab-view');
    if (grab) { selectGrabView(grab); return; }
    const m = b.getAttribute('data-mode');
    if (m) { if (!running) { mode = m; refresh(); } return; }
    const days = b.getAttribute('data-days');
    if (days != null) {
      if (days === '0') ui.since.value = '';
      else { const d = new Date(); d.setDate(d.getDate() - Number(days)); ui.since.value = fmtDate(d); }
      return;
    }
    const act = b.getAttribute('data-act');
    if (syncAccount()) { say('账号已变化，请在当前账号下重新操作。', 'warn', 'global'); return; }
    if ((running || collecting) && ['lib-clear', 'drop', 'row-del', 'imp-apply', 'tag-sel', 'prev', 'next', 'claim-legacy'].includes(act)) {
      say('采集进行中，请先停止再修改数据。', 'warn'); return;
    }
    if (collecting && ['list', 'resume', 'detail', 'refresh-selected'].includes(act)) { say('当前稿件正在采集，请稍后再试。', 'warn'); return; }
    if (act === 'claim-legacy') {
      const ctx = requireAccount();
      if (!confirm(`确认旧库属于 UID ${ctx.id}？\n首次认领会先保存保护副本，再补回缺少的稿件、空字段和标签。\n已有非空数据和当前抓取进度保留；空库会接回旧进度。原始旧库保留。`)) return;
      migrated = migrate(true);
      refresh(); renderAccount();
      say(migrated ? `已补回 ${migrated.added == null ? migrated.total : migrated.added} 条，补全 ${migrated.completed || 0} 条，当前共 ${migrated.total} 条`
        : '未找到旧库；当前数据未改变，请核对是否在原油猴脚本中升级。', migrated ? 'ok' : 'warn');
      return;
    }


    if (act === 'dismiss-status') {
      const { scope } = displayedStatus();
      say('', '', scope); return;
    }
    if (act === 'expand-status') {
      const { state } = displayedStatus();
      if (state) { state.expanded = !state.expanded; renderStatus(); }
      return;
    }
    if (act === 'tag-filter-done') { tagPanelOpen = false; renderTagFilter(); return; }
    if (act === 'date-picker-from' || act === 'date-picker-to') {
      openNativeDatePicker(act === 'date-picker-from' ? ui.dateFrom : ui.dateTo); return;
    }
    if (act === 'date-filter-toggle') {
      if (ui.datePanel.hidden) openDateFilterPanel(); else closeDateFilterPanel(); return;
    }
    if (act === 'date-filter-clear') { clearDateFilter(); return; }
    if (act === 'date-filter-apply') { applyDateFilter(); return; }

    /* ---- 面板 ---- */
    if (act === 'close') { setHidden(true); return; }
    if (act === 'toggle') { if (!ui.skipLauncherClick) setCollapsed(!ui.wrap.classList.contains('is-collapsed')); return; }
    if (act === 'lib-clear') {
      const n = lib.read().rows.length;
      if (!n || !confirm(`清空稿件库里的 ${n} 条记录？不可撤销。`)) return;
      lib.clear(); progress.clear(); fresh = new Set(); sel = new Set(); mode = 'full'; migrated = null;
      refresh(); say('稿件库已清空');
      return;
    }
    if (act === 'drop') { progress.clear(); refresh(); say('已丢弃中断的进度'); return; }
    if (act === 'row-del') {
      const id = b.getAttribute('data-id');
      if (!id) return;
      lib.remove(id); sel.delete(id); refresh(); say('已删掉这条');
      return;
    }

    /* ---- 列设置 ---- */
    if (act === 'sum-edit') { sumOpen = !sumOpen; refresh(); return; }
    if (act === 'col-all') {
      const allOn = activeSchema().length === EXPORT_SCHEMA.length;
      cfg.patch({ off: allOn ? EXPORT_SCHEMA.map(x => x.col) : [] });
      refresh(); say(allOn ? '已取消全部勾选' : '已勾选全部列', 'ok');
      return;
    }
    if (act === 'col-reset') { cfg.reset(); refresh(); say('已恢复默认设置', 'ok'); return; }
    if (act === 'preset-saveas') {
      const cur = cfg.read().preset;
      const name = askName('另存为新模板，起个名字：', cur ? cur + ' 副本' : '');
      if (!name) return;
      if (presets.names().indexOf(name) >= 0 && !confirm(`模板「${name}」已存在，覆盖它？`)) return;
      presets.save(name); cfg.patch({ preset: name }); refresh();
      say(`已另存为模板「${name}」`, 'ok');
      return;
    }
    if (act === 'preset-overwrite') {
      const name = ui.preset.value; if (!name) return;
      presets.save(name); refresh(); say(`模板「${name}」已更新`, 'ok');
      return;
    }
    if (act === 'preset-rename') {
      const old = ui.preset.value; if (!old) return;
      const name = askName('模板重命名：', old);
      if (!name || name === old) return;
      if (presets.names().indexOf(name) >= 0 && !confirm(`已有模板「${name}」，覆盖它？`)) return;
      presets.rename(old, name); cfg.patch({ preset: name }); refresh();
      say(`已重命名为「${name}」`, 'ok');
      return;
    }
    if (act === 'preset-del') {
      const name = ui.preset.value; if (!name) return;
      if (!confirm(`删除模板「${name}」？（不影响内容库和当前列设置）`)) return;
      presets.remove(name); cfg.patch({ preset: '' }); refresh();
      say(`模板「${name}」已删除`, 'ok');
      return;
    }

    /* ---- 筛选 ---- */
    if (act === 'tag-filter-toggle') {
      tagPanelOpen = !tagPanelOpen;
      renderTagFilter();
      if (tagPanelOpen) ui.tagSearch.focus();
      return;
    }
    if (act === 'tag-filter-clear') {
      filt.patch({ tags: [], untagged: false, detail: 'all', st: '', rules: [] }); refresh(); return;
    }
    if (act === 'filt-clear') {
      filt.clear(); refresh();
      say(sel.size ? '筛选已清空（勾选还留着，作用域仍是勾选的那些）' : '筛选已清空', 'ok');
      return;
    }
    if (act === 'rules-toggle') { rulesOpen = !rulesOpen; refresh(); return; }
    if (act === 'rule-add') {
      const f = filt.read();
      const used = f.rules.map(r => r.col);
      const col = numColumns().find(c => used.indexOf(c) < 0) || numColumns()[0];
      f.rules.push({ col, op: '≥', v: 0 });
      filt.write(f); rulesOpen = true; refresh();
      return;
    }
    if (act === 'rule-del') {
      const i = Number(b.getAttribute('data-i'));
      const f = filt.read();
      f.rules.splice(i, 1);
      filt.write(f); refresh();
      return;
    }
    if (act === 'sort-dir') { filt.patch({ desc: !filt.read().desc }); refresh(); return; }
    if (act === 'sel-all') { resetSelectionAnchor(); filtered().forEach(r => sel.add(r._id)); refresh(); return; }
    if (act === 'sel-none') { resetSelectionAnchor(); sel.clear(); refresh(); return; }
    if (act === 'sel-inv') {
      resetSelectionAnchor();
      filtered().forEach(r => { if (sel.has(r._id)) sel.delete(r._id); else sel.add(r._id); });
      refresh(); return;
    }

    /* ---- 标签 ---- */
    if (act === 'imp-toggle') {
      const open = ui.imp.style.display === 'none';
      ui.imp.style.display = open ? '' : 'none';
      ui.impToggle.setAttribute('aria-expanded', String(open));
      return;
    }
    if (act === 'imp-preview') { doImpPreview(); return; }
    if (act === 'imp-clear') { ui.impText.value = ''; invalidatePlan(); say('已清空输入'); return; }
    if (act === 'imp-apply') {
      if (!impPlan || !impPlan.affected) return;
      const n = applyTagImport(impPlan, impMode);
      invalidatePlan();
      ui.impText.value = '';
      refresh();
      say(`已给 ${n} 条${impMode === 'replace' ? '覆盖' : '追加'}标签`, 'ok');
      return;
    }
    if (act === 'tag-export') {
      const rows = lib.read().rows.filter(r => (r._tags || []).length);
      if (!rows.length) { say('库里还没有任何标签', 'err'); return; }
      download(`B站稿件标签_${dateStamp()}.json`, tagsToJson(), 'application/json');
      say(`已导出 ${rows.length} 条的标签，改完可以再导回来`, 'ok');
      return;
    }
    if (act === 'tag-sel') {
      if (!sel.size) return;
      const ids = [...sel];
      const tip = `给勾选的 ${ids.length} 条稿件加标签，逗号分隔。\n`
        + '要移除某个标签就在前面加减号，例如  -旧标签\n'
        + '清空全部标签输入  -*\n'
        + '示例：技术,活动,-废弃';
      const s = (prompt(tip, '') || '').trim();
      if (!s) return;
      const add = [], del = [];
      for (let t of s.split(/[,，]/)) {
        t = t.trim();
        if (!t) continue;
        if (t[0] === '-') { const x = t.slice(1).trim(); if (x) del.push(x); }
        else add.push(t);
      }
      if (!add.length && !del.length) return;
      const n = lib.tag(ids, add, del);
      refresh();
      const bits = [];
      if (add.length) bits.push('加 ' + add.join('/'));
      if (del.length) bits.push('去 ' + (del.indexOf('*') >= 0 ? '全部' : del.join('/')));
      say(`${n} 条已更新标签：${bits.join('，')}`, 'ok');
      return;
    }

    /* ---- 导出 ---- */
    if (act === 'copy' || act === 'csv') {
      const rows = scopeRows();
      if (!rows.length) return;
      const cols = headerFor().length;
      const owner = ui, epoch = ui.statusEpoch, context = accountContext();
      const scope = scopeLabel().replace('范围：', '');
      if (act === 'copy') {
        const ok = await copyText(toTSV(rows));
        if (ui !== owner || ui.statusEpoch !== epoch || !sameAccountContext(context)) return;
        if (ok) flashActionButton(b, `已复制 ${rows.length} 行 × ${cols} 列（${scope}）`);
        else say('复制失败，请重新尝试或导出 CSV。', 'err', 'rows');
      } else {
        download(`B站稿件数据_${dateStamp()}.csv`, toCSV(rows), 'text/csv');
        flashActionButton(b, `已导出 ${rows.length} 行 × ${cols} 列`);
      }
      return;
    }

    /* ---- 时长写法：点一下换下一种 ---- */
    if (act === 'dur-toggle') {
      durFmt = nextDurFmt();
      uiState.patch({ durFmt });
      refresh();
      return;
    }

    /* ---- 稿件：采集 / 切换 ---- */
    // 采集现在可能要发接口请求，中间有段等待 —— 把按钮先锁上，
    // 否则连点几下会对同一条稿件发好几轮请求
    if (act === 'collect') {
      if (collecting || running) return;
      const context = requireAccount();
      const report = taskReporter('grab-detail', context);
      collecting = true;
      b.disabled = true;
      const label = b.textContent;
      b.textContent = '采集中…';
      try { refresh(); await withTask(() => doCollect()); }
      catch (err) { report(String((err && err.message) || err), err.name === 'AbortError' ? 'warn' : 'err'); }
      finally {
        collecting = false; b.disabled = false; b.textContent = label;
        delete ui.progressByScope['grab-detail']; renderStatus(); refresh();
      }
      return;
    }
    if (act === 'prev') { switchBy(-1); return; }
    if (act === 'next') { switchBy(1); return; }

    /* ---- 稿件页：只获取勾选项的最新列表与详情数据 ---- */
    if (act === 'refresh-selected') {
      if (running) {
        if (runningAction === act) { stopTask(); say('正在停止…', 'progress', 'rows'); }
        else say('其他采集任务正在执行，请先停止。', 'warn');
        return;
      }
      const todo = lib.read().rows.filter(r => sel.has(r._id) && detailable(r)).map(r => ({ ...r }));
      if (!todo.length) { say('请先勾选需要更新且有 BV 号的稿件。', 'warn'); return; }
      const skipped = sel.size - todo.length;
      const context = requireAccount();
      const timing = { ...DETAIL_SPEEDS[detailSpeed] };
      const report = taskReporter('rows', context);
      running = true; runningAction = act; aborted = false;
      ui.listBtn.disabled = ui.detailBtn.disabled = true;
      report(`正在获取 ${todo.length} 条勾选稿件的实时数据…`);
      try {
        refresh();
        const out = await refreshSelected(todo, (state, tip) => {
          report(`获取实时数据 · 共 ${state.total} 条 · 列表 ${state.listDone}/${state.total}`
            + ` · 详情 ${state.detailDone}/${state.total} · ${state.requests} 个请求${tip ? ' · ' + tip : ''}`);
          if (sameAccountContext(context)) renderRows();
        }, { timing });
        if (!sameAccountContext(context)) return;
        const notes = [];
        if (skipped) notes.push(`${skipped} 条无 BV 号，已跳过`);
        if (out.missing) notes.push(`${out.missing} 条未在两个列表中全部找到，缺失字段保留原值`);
        if (out.detailNA) notes.push(`${out.detailNA} 条未取得平均播放进度，保留原值`);
        if (out.overviewNA) notes.push(`${out.overviewNA} 条退粉/充电未完整提供，保留原值`);
        report(`${out.stopped ? '已停止' : '获取完成'}：列表 ${out.listDone}/${out.total} 条，详情 ${out.detailDone}/${out.total} 条（${out.requests} 个请求）。已取得的数据已保存`
          + (notes.length ? '；' + notes.join('；') : ''), out.stopped || notes.length ? 'warn' : 'ok');
      } catch (err) {
        report(`获取中断：${String(err.message || err)} 已保存的数据保留；可重新点击以重试。`, 'err');
      } finally {
        running = false; runningAction = ''; aborted = false;
        ui.listBtn.disabled = false;
        refresh();
      }
      return;
    }

    /* ---- 抓列表（两个源共用） ---- */
    if (act === 'list' || act === 'resume') {
      if (running) {
        if (runningAction === 'list') { stopTask(); say('正在停止…', 'progress', 'grab-list'); }
        else say('其他采集任务正在执行，请先停止。', 'warn');
        return;
      }
      const saved = act === 'resume' ? progress.read() : null;
      if (act === 'resume' && !saved) { refresh(); return; }

      let plan;
      if (saved) {
        plan = {
          mode: saved.mode, both: !!saved.both,
          stopAtTs: saved.stopAtTs, cutoffTs: saved.cutoffTs, resume: saved,
        };
      } else {
        plan = planFor(mode);
        if (plan.mode === 'full' && lib.read().rows.length
          && !confirm('「重新全抓」成功后将以本次结果替换整个稿件库，确定？')) return;
        if (progress.read() && !confirm('开始新任务会替换未完成的进度，确定？')) return;
        requireAccount();
        // 由 crawlList 先写恢复点；原库在重新全抓成功前保持可用。

      }

      const context = requireAccount();
      const report = taskReporter('grab-list', context);
      running = true; runningAction = 'list'; aborted = false; fresh = new Set();
      ui.listBtn.textContent = '停止'; ui.detailBtn.disabled = true;
      report('开始抓稿件列表…');
      try {
        refresh();
        const out = await crawlList(SOURCE, plan, (n, st, tip) =>
          report(`已翻 ${st.pages} 页 / ${st.reqs} 个请求 · 暂存 ${n} 条`
            + `${st.reached ? ' · 到 ' + st.reached : ''}${tip ? ' · ' + tip : ''}`));
        requireAccount(context);
        const previousIds = new Set(lib.read().rows.map(r => r._id));
        const { added, updated, total } = commitListResult(out, plan);
        if (!(plan.mode === 'full' && out.stopped))
          out.rows.forEach(r => { if (!previousIds.has(r._id)) fresh.add(r._id); });
        const extra = [];
        if (updated) extra.push(`顺手更新 ${updated} 条`);
        if (out.stat.skipped) extra.push(`跳过 ${out.stat.skipped} 条`);
        let head;
        if (out.stopped) head = plan.mode === 'full' ? `已暂停，暂存 ${out.rows.length} 条，原库保留` : `已停止，新增 ${added} 条`;
        else if (!added && plan.mode === 'inc') head = '完成：没有新稿件';
        else if (!added) head = `完成：没有新增，库里共 ${total} 条`;
        else head = `完成：新增 ${added} 条，库里共 ${total} 条`;
        const pend = lib.pending({ overview: wantOv }).length;
        report(`${head}（${out.stat.reqs} 个请求）${extra.length ? '，' + extra.join('、') : ''}`
          + (out.reason === 'limit' ? '。已到本次页数上限，请继续上次' : '')
          + (pend ? `。还有 ${pend} 条可以「补详情」` : ''), out.stopped || out.reason === 'limit' || out.stat.skipped ? 'warn' : 'ok');
      } catch (err) {
        report(String((err && err.message) || err), 'err');
      } finally {
        running = false; runningAction = ''; aborted = false;
        ui.listBtn.textContent = '开始抓列表';
        if (mode === 'full' && lib.read().rows.length) mode = 'inc';
        refresh();
      }
      return;
    }

    /* ---- 抓取页：补尚未采集的详情 ---- */
    if (act === 'detail') {
      const btn = ui.detailBtn;
      if (running) {
        if (runningAction === act) { stopTask(); say('正在停止…', 'progress', 'grab-detail'); }
        else say('其他采集任务正在执行，请先停止。', 'warn');
        return;
      }
      const options = { overview: wantOv, timing: { ...DETAIL_SPEEDS[detailSpeed] } };
      const todo = lib.pending(options).map(r => ({ ...r }));
      if (!todo.length) return;
      const context = requireAccount();
      const report = taskReporter('grab-detail', context);
      running = true; runningAction = act; aborted = false;
      const label = btn.textContent;
      btn.textContent = '停止';
      ui.listBtn.disabled = true;
      ui.wantOv.disabled = true;
      ui.refBtn.disabled = true;
      report(`补详情，共 ${todo.length} 条…`);
      try {
        refresh();
        const out = await crawlDetails(todo, (done, total, failed, tip) =>
          report(`补详情 ${done}/${total} · ${getCurrentTask()?.requests || 0} 个请求${failed ? ` · ${failed} 条失败` : ''}${tip ? ' · ' + tip : ''}`),
        options);
        if (!sameAccountContext(context)) return;
        const bits = [];
        if (out.failed) bits.push(`${out.failed} 条没取到`);
        if (out.detailNA) bits.push(`${out.detailNA} 条的平均播放进度接口未提供，已有值保留`);
        if (out.overviewNA) bits.push(`${out.overviewNA} 条的退粉/充电接口未完整提供，已有值保留`);
        const left = lib.pending(options).length;
        if (left) bits.push(`还剩 ${left} 条没补`);
        report(`${out.stopped ? '已停止' : out.failed ? '部分完成' : '完成'}：处理 ${out.done}/${out.total} 条，保存播放分析 ${out.graphDone} 条、退粉/充电 ${out.overviewDone} 条（${out.requests} 个请求）`
          + (bits.length ? '；' + bits.join('；') : '，本次待补项已处理完毕'),
          out.stopped || out.failed || left || out.detailNA || out.overviewNA ? 'warn' : 'ok');
        if (out.fails.length) console.log('[B站稿件数据] 没取到的：', out.fails);
      } catch (err) {
        report(`补详情中断：${String((err && err.message) || err)} 已保存的部分保留，下次继续待补项。`, 'err');
      } finally {
        running = false; runningAction = ''; aborted = false;
        btn.textContent = label;
        ui.listBtn.disabled = false;
        ui.wantOv.disabled = false;
        refresh();
      }
      return;
    }
  }

  /* ==========================================================================
   * 18. 启动
   * ========================================================================== */
  function syncAccount() {
    const next = detectAccount();
    if (next.id === activeAccount.id && next.session === activeAccount.session) return false;
    stopTask();
    activeAccount = next;
    sel.clear(); fresh.clear(); impPlan = null; migrated = null;
    resetSelectionAnchor();
    if (ui) {
      pauseStatusTimer(); clearActionFeedback();
      ui.statusEpoch++;
      ui.statusByScope = {}; ui.progressByScope = {};
      if (ui.impText) ui.impText.value = '';
      renderAccount(); refresh();
      say('账号或登录会话已变化，旧任务已停止。', 'warn', 'global');
    }
    return true;
  }
  function renderAccount() {
    if (!ui) return;
    const node = ui.root.querySelector('[data-account-name]');
    if (node) node.textContent = node.title = 'B站稿件 · ' + accountContext().name;
    ui.root.querySelectorAll('[data-act="claim-legacy"]').forEach(claim => { claim.disabled = !accountContext().id || running || collecting; });
    const warning = ui.root.querySelector('[data-claim]');
    if (warning) {
      const hasLegacy = [LIB_KEY, MERGED_KEY, ...LEGACY_ARC].some(key => {
        if (rawRead(key, '')) return true;
        try { return !!localStorage.getItem(key); } catch (_) { return false; }
      });
      const pendingClaim = accountContext().id && !!rawRead(scopedKey(LEGACY_CLAIM_KEY), '');
      warning.hidden = !pendingClaim && (!hasLegacy || !!migrated);
    }
  }
  function mountAccount() { renderAccount(); }

  function renderLibrarySummary() {
    if (!ui) return;
    const target = ui.root.querySelector('[data-library-summary]');
    if (!target) return;
    const library = lib.read();
    const last = library.rows[library.rows.length - 1];
    target.textContent = `稿件库 ${library.rows.length} 条` + (last ? ` · ${last.发布日期 || '日期未知'} → ${library.rows[0].发布日期 || '日期未知'}` : '');
  }
  function commitListResult(out, plan) {
    requireAccount(out.context);
    const L = lib.read();
    let result;
    if (plan.mode === 'full') {
      if (out.stopped) return { added: 0, updated: 0, total: L.rows.length };
      const byId = new Map(L.rows.map(r => [r._id, r]));
      const rows = out.rows.map(r => mergeFields(byId.get(r._id) || {}, r));
      lib.write({ ...L, rows, donePn: out.donePages, doneBoth: !!plan.both });
      result = { added: rows.filter(r => !byId.has(r._id)).length, updated: rows.filter(r => byId.has(r._id)).length, total: rows.length };
    } else {
      const coverage = out.stopped ? L.donePn : Math.max(L.doneBoth === !!plan.both ? L.donePn : 0, out.donePages);
      result = lib.merge(out.rows, coverage, out.seen, { approx: SOURCE.approx });
      if (!out.stopped) lib.write({ ...lib.read(), doneBoth: !!plan.both });
    }
    if (!out.stopped && (plan.mode === 'inc' || !plan.cutoffTs)) {
      const saved = lib.read();
      if (Object.prototype.hasOwnProperty.call(saved, 'restoreKnownIds')) {
        delete saved.restoreKnownIds;
        lib.write(saved);
      }
    }
    // 主库写入并读回核验成功后，才删除恢复点。失败可直接继续上次，不必重抓。
    if (!out.stopped) progress.clear();
    return result;
  }

  function start() {
    if (document.getElementById(PANEL_ID)) return;
    try { build(); mountDataManager(); mountAccount(); }
    catch (e) {
      if (ui) { say(e.message || String(e), 'err', 'global'); try { mountDataManager(); } catch (_) {} try { mountAccount(); } catch (_) {} }
      else console.error('[B站稿件数据] 初始化失败：', e.message);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  /**
   * 暴露给浏览器控制台调试用。
   * ⚠ 必须挂到 unsafeWindow：脚本带了 @grant 就跑在油猴沙箱里，
   *   沙箱的 window 和页面的 window 不是同一个，挂在 window 上
   *   DevTools 控制台（页面上下文）根本看不见。
   */
  if (typeof window !== 'undefined') {
    const hostWin = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
    hostWin.__BILI_ARC__ = window.__BILI_ARC__ = {
      lib, progress, cfg, presets, filt, migrate,
      createAccountBackup, createRawRecoveryExport, validateBackup, planBackupRestore, applyBackupRestore, backupFileName,
      FILTERS, filtered, scopeRows, scopeLabel, filterLabel, activeFilters, isFiltering,
      testRule, numOf, numColumns, completeness, detailDone, DETAIL_V, EMPTY_FILTER,
      EXPORT_SCHEMA, orderedSchema, activeSchema, sumCols, sumValue, rate, finishPct,
      headerFor, toCSV, toTSV, cellOf,
      mapArcA, mapArcB, cidOf, pickLive, numStr, absorb,
      enrichOne, enrichArc, crawlList, crawlDetails, refreshSelected, listPriority, stopTask,
      fetchArcA, fetchArcB, fetchArcGraph, fetchArcView: fetchArcCid, fetchArcOverview,
      SOURCE, planFor, detailable, setPace, commitListResult,
      DETAIL_SPEEDS, estimateDetailRequests, overviewDone, OVERVIEW_V,
      _setTimingForTests: setTimingForTests,
      _ui: () => ui, _say: say, _renderStatus: renderStatus, _clearStatus: clearStatus,
      _setWantOv: v => { wantOv = !!v; },
      collectOverview, collectPlay, doCollect, progViaApi, guessDur, locateCurrent, getDoc, currentArcState,
      parseTagJson, planTagImport, applyTagImport, tagsToJson, linkKey, titleKey, makeId,
      cleanNum, durToSec, cnDurToSec, fmtDur, fmtDurCn, showDur, DUR_FMTS, nextDurFmt, tsOf,
      _setDurFmt: v => { durFmt = v; },
      _sel: () => sel, _setSel: v => { sel = new Set(v); },
      _setBoth: v => { arcBoth = !!v; },
      _refresh: () => refresh(),
    };
  }
})();
