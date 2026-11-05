// ==UserScript==
// @name         公众号文章数据一站抓取
// @namespace    https://github.com/malafeiniao/mp-stats-grabber
// @version      3.5.44
// @description  在公众号后台「发表记录」页一站抓齐文章数据：列表批量拿基础指标，再按需补全完读率/时长/收藏等详情指标。本地文章库 + 增量更新，列可勾选拖动排序、可存模板。
// @author       malafeiniao
// @homepageURL  https://github.com/malafeiniao/social-media-userscripts
// @supportURL   https://github.com/malafeiniao/social-media-userscripts/issues
// @updateURL    https://raw.githubusercontent.com/malafeiniao/social-media-userscripts/main/wechat/wechat-article-stats-grabber.user.js
// @downloadURL  https://raw.githubusercontent.com/malafeiniao/social-media-userscripts/main/wechat/wechat-article-stats-grabber.user.js
// @match        *://mp.weixin.qq.com/cgi-bin/appmsgpublish*
// @run-at       document-idle
// @grant        GM_setClipboardText
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @noframes
// ==/UserScript==

/* ============================================================================
 * 使用说明
 * ----------------------------------------------------------------------------
 * 装好后打开公众号后台「发表记录」（网址含 appmsgpublish），右下角出面板。
 * 标题栏的「–」可收起为小图标。拖动图标后会就近展开，拖动展开的面板后图标也会跟随到新位置。刷新后保留收起状态、位置和标签页。
 *
 * 数据分两步拿，因为来自两个地方：
 *   第 1 步「抓列表」—— 一个请求拿 20 篇的 标题/日期/链接/阅读/点赞/在看/分享/留言/划线/转载
 *   第 2 步「补详情」—— 逐篇获取 完读率/平均阅读时长/收藏/赞赏/听全文/阅读后关注
 *     优先使用新版详情；明确不兼容时再请求一次旧版。旧版未提供的收藏保持原值或空白。
 *   抓取页顶部可滑动切换两组设置，切换不会发请求；在对应页点「开始」才执行。
 *   补详情会逐篇处理所有待补文章，可随时停止；已完成的文章立即写入库。
 *
 * 抓列表提供增量更新、补抓更早、重新全抓三种模式。
 *
 * 抓到的都进本地「文章库」，关浏览器也在。日常增量通常只需抓新列表和新文章详情；
 * 30 天内的详情仍可能变化，需要最终快照时可在统计窗口结束后手动刷新。
 *
 * 「列设置」页签里：勾选决定导出哪些列，拖 ⠿ 调顺序，可以存成模板复用。
 *
 * 「文章」页签里可以只挑几篇干活：
 *   · 滚动列表可浏览文章，底部的刷新、标签、复制和导出按钮保持可见。
 *   · 标签按钮可搜索并多选，符合任一标签的文章都会显示；详情状态可独立筛选。
 *   · 普通点击复选框设定起点，Shift 点击另一篇可勾选或取消两端之间的当前筛选结果。
 *   · 搜标题 / 按发布日期范围（yyyy/mm/dd）及标签筛选；「有详情」「无详情」是自动更新的状态标签
 *   · 行首打勾选中后有两个刷新按钮，分别对应两个数据源：
 *     「刷新实时数」阅读/点赞/在看/分享/留言/划线/转载 —— 从列表取，不受 30 天限制，
 *                  按发布时间算出所在页直接请求，同页多篇共用一个请求
 *     「刷新详情数」完读率/时长/收藏/赞赏/听全文/阅读后关注 —— 从单篇数据页取，
 *                  优先新版、必要时回退旧版，且微信只统计发表后 30 天内
 *     「收藏待核查」表示最近一次新版详情未返回有效收藏值，可勾选后再次刷新详情数。
 *   · 「编辑标签」给勾选的文章批量打标签：逗号分隔；前面加减号表示移除，如 -旧标签；
 *     输入 -* 清空该行全部标签。标签存在库里，重抓不会丢，也能作为一列导出。
 *   · 点「导入标签」图标可粘贴 JSON 或选 .json 文件，key 写标题或链接都行，
 *     脚本自己判断。导入前必须先「预览」——会告诉你能对上几篇、哪些没对上、
 *     哪些标题有歧义被跳过，确认了再点「导入」。可选追加或覆盖已有标签。
 *     「导出标签」图标把全库自定义标签导成 JSON，改完能原样导回来。
 *   · 导出 / 复制 的范围：勾了行就只要勾的；没勾但有筛选就是筛选结果；都没有才是全库。
 *     按钮上会写明这次是几篇。
 *   · 「数据管理」可下载当前账号的完整 JSON 备份，包含全库字段、标签，
 *     以及未完成抓取中已保存的记录，不受勾选、筛选和列设置影响。
 *     「导入备份文件」先校验，再可预览仅补回缺失文章的范围及已有文章差异。
 *     预览后可确认补回缺失文章；先保存恢复前副本，已有文章和抓取进度保持原样。
 *     预览后数据有变化须重新预览；恢复前副本可单独下载，本版不提供删除。
 *
 * 多账号：文章库和抓取进度按账号（uin）分开存，切号自动切库，面板顶部
 *   写着当前是哪个号。列设置和模板是全局共享的 —— 报表口径应该一致。
 *   分库之前留下的旧库没有账号归属，面板会问你要不要归到当前账号，
 *   不会自动认领（万一你升级时正好停在另一个号上就记错账了）。
 *
 * 数据的更新逻辑：
 *   重抓可修正 —— 发布日期、发布时间；旧记录缺日期可在「抓列表」手动修复
 *   写一次就不动 —— 链接、手工标签
 *   每次重抓覆盖 —— 所有数字、标题，并更新最近获取时间
 *   「补详情」只处理从来没补过的；已经补过的要更新，用「刷新选中详情」。
 *
 * ⚠ 两个数据源的分工（很重要，微信有 30 天限制）：
 *   阅读量/点赞/在看/分享/留言/划线/转载 只认列表。列表数据持续更新，
 *                              实测 47 天前发的文章阅读量还在涨。
 *   完读率/平均阅读时长/收藏/    只认详情页。而单篇数据页「仅统计发表后 30 天内
 *   赞赏/听全文/阅读后关注       的数据」，超期就冻结，拿不到更新。
 *   每篇只保存一个「最近获取时间」，列表或详情成功获取时更新。
 *   它是最近一次成功获取的时间，不是所有指标共同的统计截止时间。
 *   超过 30 天仍可取到详情旧值，但刷新请求时间不会让统计窗口延长。
 *   详情页的重名指标与列表可能不同，只留在库内排查，不覆盖列表列。
 *
 * ⚠ 默认请求间隔是 2~5 秒随机，每 15 个请求歇一次长的。补详情与刷新选中详情
 *   共用面板里的速度设置；列表和其它后台请求继续使用默认节奏。
 * ============================================================================ */

(function () {
  "use strict";

  /* ==========================================================================
   * 1. 节奏与开关
   * ========================================================================== */
  const PAGE_SIZE = 20; // 列表每次请求抓几条群发
  const DELAY_MIN = 2000; // 请求间隔下限（随机，别改成固定值）
  const DELAY_MAX = 5000;
  const REST_EVERY = 15; // 每这么多个请求歇一次长的
  const REST_MIN = 8000;
  const REST_MAX = 15000;
  const MAX_PAGES = 400; // 保险丝
  const DETAIL_SPEEDS = {
    cautious: { min: 5000, max: 8000, restMin: 12000, restMax: 20000 },
    standard: {
      min: DELAY_MIN,
      max: DELAY_MAX,
      restMin: REST_MIN,
      restMax: REST_MAX,
    },
    quicker: { min: 1500, max: 3000, restMin: REST_MIN, restMax: REST_MAX },
  };
  const SKIP_DELETED = true; // 跳过已删除的文章
  const ROW_HEIGHT = 32; // 虚拟列表的固定行高，需与 .it CSS 一致
  const ROW_OVERSCAN = 10; // 可视区上下预渲染的行数

  /* ==========================================================================
   * 2. 字段来源（全部实测确认过，别按直觉改）
   * --------------------------------------------------------------------------
   * 列表页 publish_page → publish_list[].publish_info（HTML 转义的 JSON 串）
   *   sent_info.time                 发布时间戳
   *   appmsg_info[].read_num         阅读量
   *   appmsg_info[].old_like_num     点赞（👍）   ← 不是 like_num
   *   appmsg_info[].like_num         在看（♡）   ← 早年「赞」叫 like，后来改名「在看」
   *   appmsg_info[].share_num        分享
   *   appmsg_info[].comment_num      留言
   *   appmsg_info[].line_info.line_count 划线人数
   *   appmsg_info[].reprint_num      被转载次数
   *
   * 单篇数据页（服务端内联，可以直接 fetch，不用渲染）→ article_data_new
   *   read_uv                        阅读量
   *   like_cnt                       点赞（👍）
   *   zaikan_cnt                     在看（♡）
   *   share_uv                       分享
   *   comment_cnt                    留言
   *   collection_uv                  收藏
   *   praise_money                   赞赏（元）
   *   listen_uv / listen_pv          听全文；优先用 UV，缺失时用 PV，库内记录实际来源
   *   read_pv / share_pv             阅读、分享的次数，和列表字段分列保存
   *   follow_after_read_uv           阅读后关注人数
   *   avg_article_read_time          平均阅读时长，单位「秒」（页面显示的分钟是四舍五入的）
   *   finished_read_pv_ratio         完读率，0~1 的小数，精度比页面上的整数百分比高
   *   interaction_ratio              详情页给出的互动率，可能与列表字段算出的互动率不同
   * 同一处还有 subs_transform.send_uv = 送达人数（默认不导出，想要在下面加一列）
   * ========================================================================== */

  const EXPORT_SCHEMA = [
    { col: "标题", from: "标题" },
    { col: "发布日期", from: "发布日期" },
    { col: "发布时间", from: "发布时间" },
    { col: "阅读量", from: "阅读量", num: true },
    { col: "点赞", from: "点赞", num: true, sumable: true },
    { col: "在看", from: "在看", num: true, sumable: true },
    { col: "分享", from: "分享", num: true, sumable: true },
    { col: "留言", from: "留言", num: true, sumable: true },
    { col: "划线人数", from: "划线人数", num: true },
    { col: "被转载次数", from: "被转载次数", num: true },
    { col: "收藏", from: "收藏", num: true, sumable: true, detail: true },
    {
      col: "互动量",
      calc: true,
      deps: () => sumCols(),
      value: (row) => sumValue(row),
    },
    {
      col: "互动率",
      calc: true,
      value: (row) => {
        const read = num(row["阅读量"]);
        if (!read) return "";
        return ((sumValue(row) / read) * 100).toFixed(2) + "%";
      },
    },
    {
      col: "听全文",
      value: (row) => listenValue(row),
      num: true,
      sumable: true,
      detail: true,
    },
    {
      col: "阅读后关注人数",
      from: "阅读后关注人数",
      num: true,
      sumable: true,
      detail: true,
    },
    {
      col: "平均阅读时长",
      detail: true,
      // 原始值就是秒，切成分钟时才换算。表头跟着写成「(秒)」或「(分钟)」
      header: () => `平均阅读时长(${durUnit()})`,
      value: (row) => {
        const s = row["_durSec"];
        if (s === "" || s == null) return "";
        return durUnit() === "秒" ? String(num(s)) : (num(s) / 60).toFixed(2);
      },
    },
    {
      col: "完读率",
      detail: true,
      value: (row) => {
        const r = row["_finishRatio"];
        if (r === "" || r == null) return "";
        return (num(r) * 100).toFixed(2) + "%";
      },
    },
    { col: "赞赏", from: "赞赏", num: true, sumable: true, detail: true },
    { col: "标签", value: (row) => articleTags(row).join(" ") },
    { col: "链接", from: "链接" },
    { col: "最近获取时间", from: "最近获取时间" },
  ];

  const DEFAULT_SUM = ["点赞", "在看", "分享", "留言", "收藏"];
  // 兼容 3.5.17～3.5.20 的配置迁移；这些详情侧重复列不再出现在前台。
  const DETAIL_SOURCE_COLUMNS = [
    "详情阅读次数",
    "详情点赞",
    "详情分享次数",
    "详情互动率",
  ];
  const EXTRA_LIST_COLUMNS = ["划线人数", "被转载次数"];
  const DEFAULT_OFF = ["赞赏", ...EXTRA_LIST_COLUMNS];
  const DUR_UNITS = ["秒", "分钟"];

  // 这些会随时间变化，重抓到就覆盖
  // 发布日期/时间也列进来：早先未通知的文章拿不到时间戳、日期是空的，
  // 加进来重抓时才会被判定为「变了」并覆盖修正
  const VOLATILE = [
    "发布日期",
    "发布时间",
    "标题",
    "阅读量",
    "点赞",
    "在看",
    "分享",
    "留言",
    "划线人数",
    "被转载次数",
    "收藏",
    "赞赏",
    "听全文",
    "阅读后关注人数",
    "_durSec",
    "_finishRatio",
    "最近获取时间",
  ];

  // 获取时间不算「数据变了」，否则每次抓都报一堆假的更新
  const TIME_KEYS = ["最近获取时间"];

  const PANEL_ID = "mp-article-data-panel";

  /* ---- 账号隔离 ----------------------------------------------------------
   * 一个浏览器里会切换多个公众号，文章库必须按账号分开存，
   * 否则切号之后：增量更新拿新号的列表和旧号最新那篇比时间、页码估算全错、
   * 补详情用旧号的 appmsgid 配新号的 token —— 全线失效。
   *
   * token 不能当账号标识：它是登录会话级的，同一个号每次登录都变。
   * 实测页面里有 uin（数字账号 ID）/ user_name（微信号）/ nick_name（昵称），
   * 优先级就按这个来 —— uin 最稳，改昵称也不变。
   * ---------------------------------------------------------------------- */
  function detectAccount() {
    const g = (typeof unsafeWindow !== "undefined" && unsafeWindow) || window;
    const pick = {};

    // 先试标准全局（有些页面版本有 wx.data）
    try {
      const d = (g.wx && g.wx.data) || (window.wx && window.wx.data);
      if (d)
        ["uin", "user_name", "nick_name"].forEach((k) => {
          if (d[k]) pick[k] = String(d[k]);
        });
    } catch (e) {
      /* ignore */
    }

    // 再从内联脚本里翻。同一个键可能出现多次（埋点 URL 里也有 uin=0 这种），
    // 所以全都收集起来挑一个合理的，不能拿第一个就走。
    const all = [...document.scripts].map((s) => s.textContent).join("\n");
    // 分两种写法抓：带引号的（值可能是中文，所以捕获组必须用 [^"']，
    // 不能用 \w —— \w 不含中文，昵称会整个匹配不上）和不带引号的（一般是数字）
    const grabAll = (k) => {
      const out = [];
      let m, re;
      re = new RegExp(
        "[\"']?" + k + "[\"']?\\s*[:=]\\s*[\"']([^\"']{1,80})[\"']",
        "g",
      );
      while ((m = re.exec(all))) out.push(m[1]);
      re = new RegExp(
        "[\"']?" + k + "[\"']?\\s*[:=]\\s*([\\w.@=+/-]{1,80})",
        "g",
      );
      while ((m = re.exec(all))) out.push(m[1]);
      return out;
    };
    if (!pick.uin) {
      const c = grabAll("uin").filter((v) => /^\d{5,}$/.test(v)); // 排除埋点里的 uin=0
      if (c.length) pick.uin = c[0];
    }
    if (!pick.user_name) {
      const c = grabAll("user_name").filter(
        (v) => v.length >= 2 && v !== "null",
      );
      if (c.length) pick.user_name = c[0];
    }
    if (!pick.nick_name) {
      const c = grabAll("nick_name").filter(
        (v) => v.length >= 1 && v !== "null",
      );
      if (c.length) pick.nick_name = c[0];
    }

    const id = pick.uin || pick.user_name || pick.nick_name || "";
    return {
      id: id ? String(id) : "unknown",
      known: !!id,
      name: pick.nick_name || pick.user_name || pick.uin || "未识别的账号",
      wxid: pick.user_name || "",
    };
  }

  function accountTitle(a) {
    if (!a.known) return "未识别的账号";
    const name = String(a.name || "未识别的账号");
    const id =
      [a.wxid, a.id]
        .map((v) => String(v || "").trim())
        .find((v) => v && v !== name) || "";
    return id ? `${name}（${id}）` : name;
  }

  let acct = detectAccount();

  // 库和抓取进度按账号分开；列设置和模板全局共享（口径要一致）
  const libKey = () => "mp_pub_lib::" + acct.id;
  const progKey = () => "mp_pub_progress::" + acct.id;
  const dismissKey = () => "mp_pub_legacy_dismiss::" + acct.id;
  const LEGACY_LIB_KEY = "mp_publish_lib_v1"; // 分库之前的老数据，没有账号归属
  const CFG_KEY = "mp_pub_cols_v1";
  const PRESET_KEY = "mp_pub_presets_v1";
  const DETAIL_SOURCE_COLS_MIGRATED_KEY = "mp_pub_detail_source_cols_v1";
  const EXTRA_LIST_COLS_MIGRATED_KEY = "mp_pub_extra_list_cols_v1";
  const LISTEN_COL_MIGRATED_KEY = "mp_pub_listen_col_v1";
  const LISTEN_UNIFIED_MIGRATED_KEY = "mp_pub_listen_unified_v1";
  const DETAIL_DUP_COLS_REMOVED_KEY = "mp_pub_detail_dup_cols_removed_v1";
  const FETCH_TIME_COL_MIGRATED_KEY = "mp_pub_fetch_time_col_v1";
  const UNUSED_EXPORT_COLS_REMOVED_KEY = "mp_pub_unused_export_cols_removed_v1";
  const UI_COLLAPSED_KEY = "mp_pub_ui_collapsed_v1";
  const UI_OPEN_POSITION_KEY = "mp_pub_ui_open_position_v1";
  const UI_ICON_POSITION_KEY = "mp_pub_ui_icon_position_v1";
  const UI_ACTIVE_TAB_KEY = "mp_pub_ui_active_tab_v1";
  const UI_GRAB_VIEW_KEY = "mp_pub_grab_view_v1";
  const DETAIL_SETTINGS_KEY = "mp_pub_detail_settings_v1";

  /* ==========================================================================
   * 3. 小工具
   * ========================================================================== */

  function num(v) {
    if (v == null || v === "") return 0;
    const n = parseFloat(
      String(v)
        .replace(/,/g, "")
        .replace(/[^\d.\-]/g, ""),
    );
    return isFinite(n) ? n : 0;
  }

  const pad = (n) => String(n).padStart(2, "0");
  const fmtDate = (d) =>
    `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const stampNow = () => {
    const d = new Date();
    return `${fmtDate(d)} ${fmtTime(d)}`;
  };
  const fetchTimeKey = (value) => {
    const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{1,2})/.exec(
      value,
    );
    return m
      ? Number(`${m[1]}${pad(+m[2])}${pad(+m[3])}${pad(+m[4])}${pad(+m[5])}`)
      : -1;
  };
  function latestFetchTime(...values) {
    let latest = "";
    for (const value of values) {
      const time = cell(value).trim();
      if (!time) continue;
      const key = fetchTimeKey(time);
      const latestKey = fetchTimeKey(latest);
      if (
        !latest ||
        (key >= 0 || latestKey >= 0 ? key > latestKey : time > latest)
      )
        latest = time;
    }
    return latest;
  }

  // 旧库行按需迁移：只保留一个时间字段，避免每篇继续存两份来源时间。
  function normalizeFetchTime(row) {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      (!("数据时间" in row) && !("详情时间" in row))
    )
      return row;
    const next = Object.assign({}, row);
    const latest = latestFetchTime(
      next.最近获取时间,
      next.数据时间,
      next.详情时间,
    );
    delete next.数据时间;
    delete next.详情时间;
    if (latest) next.最近获取时间 = latest;
    return next;
  }

  function mergeArticleRows(old, incoming) {
    const before = normalizeFetchTime(old || {});
    const after = normalizeFetchTime(incoming || {});
    const merged = Object.assign({}, before, after);
    const latest = latestFetchTime(before.最近获取时间, after.最近获取时间);
    if (latest) merged.最近获取时间 = latest;
    return merged;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const cell = (v) => String(v == null ? "" : v);
  // 详情状态随抓取结果变化，不写入手工标签，避免状态过期。
  const detailTag = (row) => (row._detail ? "有详情" : "无详情");
  const customTagLabel = (tag) =>
    ["有详情", "无详情"].includes(tag) ? `自定义:${tag}` : tag;
  const articleTags = (row) => [
    detailTag(row),
    ...(row._tags || []).map(customTagLabel),
  ];
  const esc = (s) =>
    String(s).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );

  /* ==========================================================================
   * 4. 存储
   * ========================================================================== */
  function rawRead(key, dflt) {
    try {
      return typeof GM_getValue === "function"
        ? GM_getValue(key, dflt)
        : localStorage.getItem(key) || dflt;
    } catch (e) {
      return dflt;
    }
  }
  function rawWrite(key, val) {
    try {
      if (typeof GM_setValue === "function") GM_setValue(key, val);
      else localStorage.setItem(key, val);
      return true;
    } catch (e) {
      return false;
    }
  }

  function storageError(message) {
    const error = new Error(message);
    error.name = "StorageError";
    return error;
  }

  function requireWriteResult(ok, message) {
    if (!ok) throw storageError(message);
    return true;
  }

  function requiredWrite(key, value, message) {
    return requireWriteResult(rawWrite(key, value), message);
  }

  // 文章和恢复进度不能把“读失败/格式损坏”当成空库，否则后续写入会覆盖原数据。
  // 界面位置等偏好仍用 rawRead 的默认值，不影响这条数据保护边界。
  function readStoredJson(key, label) {
    let raw;
    try {
      raw = typeof GM_getValue === "function"
        ? GM_getValue(key, "")
        : localStorage.getItem(key);
    } catch (_) {
      throw storageError(`${label}读取失败，已停止操作，请稍后重试`);
    }
    if (raw == null || raw === "") return null;
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("invalid stored object");
      return value;
    } catch (_) {
      throw storageError(`${label}格式异常，已停止操作，原数据未被覆盖`);
    }
  }

  function readStoredRows(key, label) {
    const value = readStoredJson(key, label);
    if (value == null) return null;
    if (!Array.isArray(value.rows) || value.rows.some(
      (row) => !row || typeof row !== "object" || Array.isArray(row),
    )) throw storageError(`${label}格式异常，已停止操作，原数据未被覆盖`);
    return normalizeStoredRows(value, key);
  }

  let suppressReadMigration = false;
  function normalizeStoredRows(value, key) {
    let changed = false;
    for (let i = 0; i < value.rows.length; i++) {
      const normalized = normalizeFetchTime(value.rows[i]);
      if (normalized !== value.rows[i]) {
        value.rows[i] = normalized;
        changed = true;
      }
    }
    if (changed && !suppressReadMigration) rawWrite(key, JSON.stringify(value));
    return value;
  }

  function detailSettings() {
    let saved = {};
    try {
      saved = JSON.parse(rawRead(DETAIL_SETTINGS_KEY, "{}")) || {};
    } catch (_) {
      /* 用默认值 */
    }
    const settings = {
      speed: Object.prototype.hasOwnProperty.call(DETAIL_SPEEDS, saved.speed)
        ? saved.speed
        : "standard",
    };
    if (Object.prototype.hasOwnProperty.call(saved, "batch")) {
      rawWrite(DETAIL_SETTINGS_KEY, JSON.stringify(settings));
    }
    return settings;
  }

  function saveDetailSettings(speed) {
    const next = {
      speed: Object.prototype.hasOwnProperty.call(DETAIL_SPEEDS, speed)
        ? speed
        : "standard",
    };
    rawWrite(DETAIL_SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  /**
   * 有没有哪个值真变了。只比较新数据里确实带了的字段——
   * 列表抓来的行没有详情字段，不能因为它「缺」就判成变了。
   */
  function bumped(a, b) {
    return VOLATILE.some(
      (k) => TIME_KEYS.indexOf(k) < 0 && k in b && cell(a[k]) !== cell(b[k]),
    );
  }

  /**
   * 文章库。doneBegin = 从最新往回已经连续覆盖了多少条群发条目，
   * 「补抓更早」靠它知道从哪个 begin 接着请求，而不是从 0 重翻。
   */
  const lib = {
    read() {
      const v = readStoredRows(libKey(), "文章库");
      return v
        ? {
          rows: v.rows, doneBegin: Number(v.doneBegin) || 0, at: v.at || 0,
          ...(Object.prototype.hasOwnProperty.call(v, "restoreStopAtTs")
            ? { restoreStopAtTs: v.restoreStopAtTs } : {}),
        }
        : { rows: [], doneBegin: 0, at: 0 };
    },
    write(v) {
      // 顺手记下这份数据属于谁 —— 存下来的东西应该自己说明来历，
      // 不然只剩一个 uin 数字，回头借用/排查都得猜
      return rawWrite(
        libKey(),
        JSON.stringify({
          rows: v.rows.map(normalizeFetchTime),
          doneBegin: v.doneBegin,
          at: Date.now(),
          acctId: acct.id,
          acctName: acct.name,
          ...(Object.prototype.hasOwnProperty.call(v, "restoreStopAtTs")
            ? { restoreStopAtTs: v.restoreStopAtTs } : {}),
        }),
      );
    },
    clear() {
      requiredWrite(libKey(), "", "文章库清理失败，请稍后重试");
    },

    /**
     * @param newRows  新文章（会新增）
     * @param doneBegin 覆盖进度，null = 不动
     * @param seenRows 顺路看到的，只刷新已有记录、不新增（页面已下载，白捡）
     * @param clearRestoreBaseline 正常增量完成时，随同一次主库保存清除恢复前停止点
     */
    merge(newRows, doneBegin, seenRows, clearRestoreBaseline = false) {
      const cur = lib.read();
      const byLink = new Map(cur.rows.map((r) => [r.链接, r]));
      let added = 0,
        updated = 0;

      for (const r of newRows || []) {
        const old = byLink.get(r.链接);
        if (old) {
          if (bumped(old, r)) updated++;
          byLink.set(r.链接, mergeArticleRows(old, r)); // 保住已有的详情字段
        } else {
          byLink.set(r.链接, normalizeFetchTime(r));
          added++;
        }
      }
      for (const r of seenRows || []) {
        const old = byLink.get(r.链接);
        if (!old) continue;
        if (bumped(old, r)) updated++;
        // 即使数值未变，也记录本次成功获取的时间；详情字段仍由旧行保留。
        byLink.set(r.链接, mergeArticleRows(old, r));
      }

      const rows = [...byLink.values()].sort(
        (a, b) => (b._ts || 0) - (a._ts || 0),
      );
      const next = {
        ...cur,
        rows,
        doneBegin: doneBegin == null ? cur.doneBegin : doneBegin,
      };
      if (clearRestoreBaseline) delete next.restoreStopAtTs;
      requireWriteResult(lib.write(next), "文章库保存失败，本次合并未保存，请稍后重试");
      return { added, updated, total: rows.length };
    },

    /** 把一篇的详情字段写回去 */
    patch(link, fields) {
      const cur = lib.read();
      const i = cur.rows.findIndex((r) => r.链接 === link);
      if (i < 0) return false;
      cur.rows[i] = mergeArticleRows(cur.rows[i], fields);
      return lib.write(cur);
    },

    newestTs() {
      const value = lib.read();
      // 恢复可能补入较新的文章；增量仍须回到恢复前的停止点，补齐中间未抓到的记录。
      // 0 表示恢复前为空库，不能用真假判断把它误当成没有标记。
      if (Object.prototype.hasOwnProperty.call(value, "restoreStopAtTs")) return value.restoreStopAtTs;
      const r = value.rows;
      return r.length ? r[0]._ts || 0 : 0;
    },

    /** 还从来没补过详情的 */
    pending() {
      return lib
        .read()
        .rows.filter(
          (r) => !r._detail && r._appmsgid && cell(r.发布日期).trim(),
        );
    },

    /** 库里用过的所有标签 */
    allTags() {
      const s = new Set();
      for (const r of lib.read().rows) for (const t of r._tags || []) s.add(t);
      return [...s].sort();
    },

    /**
     * 批量改标签。add / del 都是数组；del 里出现 '*' 表示清空该行标签。
     * 标签存在行上，不在 VOLATILE 里，所以重抓列表或刷新详情都不会把它冲掉。
     */
    tag(links, add, del) {
      const cur = lib.read();
      const set = new Set(links);
      let n = 0;
      for (const r of cur.rows) {
        if (!set.has(r.链接)) continue;
        let t = (r._tags || []).slice();
        if (del.indexOf("*") >= 0) t = [];
        else t = t.filter((x) => del.indexOf(x) < 0);
        for (const a of add) if (t.indexOf(a) < 0) t.push(a);
        r._tags = t;
        n++;
      }
      requireWriteResult(lib.write(cur), "文章库保存失败，标签修改未保存，请稍后重试");
      return n;
    },
  };

  /* ==========================================================================
   * 标签的 JSON 导入 / 导出
   * --------------------------------------------------------------------------
   * 认这几种写法，自动判断 key 是标题还是链接：
   *   {"文章标题": ["专栏","重点"], "https://mp.weixin.qq.com/s/xxx": ["活动"]}
   *   {"标题": "专栏,重点"}                         值是字符串也行，按逗号拆
   *   [{"标题":"…","标签":["专栏"]}, {"链接":"…","tags":"活动"}]
   * 导出用数组那种写法：既好读好改，链接又能精确匹配回来。
   * ========================================================================== */

  /** 链接归一化：只留 /s/xxx 那一段，去掉 ?chksm= 之类的尾巴 */
  function linkKey(u) {
    const s = String(u == null ? "" : u).trim();
    const m = s.match(/mp\.weixin\.qq\.com(\/s\/[A-Za-z0-9_\-=%]+)/);
    if (m) return m[1];
    return s.replace(/[?#].*$/, "").replace(/\/+$/, "");
  }

  /** 标题归一化：忽略空白和全角/半角标点差异，方便手打的标题也能对上 */
  function titleKey(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .replace(/[\s　]+/g, "")
      .replace(/[｜]/g, "|")
      .replace(/[，]/g, ",")
      .replace(/[：]/g, ":")
      .replace(/[！]/g, "!")
      .replace(/[？]/g, "?")
      .replace(/[“”„]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[（]/g, "(")
      .replace(/[）]/g, ")")
      .trim();
  }

  function parseTagJson(text) {
    let data;
    try {
      data = JSON.parse(String(text || ""));
    } catch (e) {
      return { error: "JSON 格式不对：" + ((e && e.message) || e) };
    }

    const entries = [];
    const push = (key, tags) => {
      key = String(key == null ? "" : key).trim();
      if (!key) return;
      let t = [];
      if (Array.isArray(tags)) t = tags;
      else if (typeof tags === "string") t = tags.split(/[,，]/);
      else if (tags != null) t = [String(tags)];
      t = t.map((x) => String(x).trim()).filter(Boolean);
      entries.push({
        key,
        tags: t,
        isLink: /^https?:\/\//i.test(key) || /mp\.weixin\.qq\.com/.test(key),
      });
    };

    if (Array.isArray(data)) {
      for (const o of data) {
        if (!o || typeof o !== "object") continue;
        push(
          o.链接 || o.link || o.url || o.标题 || o.title,
          o.标签 || o.tags || o.tag,
        );
      }
    } else if (data && typeof data === "object") {
      for (const k of Object.keys(data)) push(k, data[k]);
    } else {
      return { error: "JSON 顶层得是对象或数组" };
    }

    if (!entries.length) return { error: "没解析出任何条目" };
    return { entries };
  }

  /**
   * 先算出「会改哪些文章」，不落库。
   * 标题按 精确 → 归一化 → 唯一模糊包含 三级匹配；
   * 模糊命中多篇时算歧义，宁可报出来让人确认，也不瞎猜。
   */
  function planTagImport(entries) {
    const rows = lib.read().rows;
    const byLink = new Map();
    const byTitle = new Map();
    for (const r of rows) {
      byLink.set(linkKey(r.链接), r);
      const k = titleKey(r.标题);
      if (!byTitle.has(k)) byTitle.set(k, []);
      byTitle.get(k).push(r);
    }

    const hits = [],
      unmatched = [],
      ambiguous = [];
    let fuzzy = 0,
      dup = 0;

    for (const e of entries) {
      let matched = null,
        how = "";
      if (e.isLink) {
        const r = byLink.get(linkKey(e.key));
        if (r) {
          matched = [r];
          how = "链接";
        }
      } else {
        const k = titleKey(e.key);
        if (byTitle.has(k)) {
          matched = byTitle.get(k);
          how = matched.length > 1 ? "标题重名" : "标题";
          if (matched.length > 1) dup++;
        } else if (k) {
          const cands = rows.filter((r) => titleKey(r.标题).indexOf(k) >= 0);
          if (cands.length === 1) {
            matched = cands;
            how = "模糊";
            fuzzy++;
          } else if (cands.length > 1) {
            ambiguous.push(`${e.key}（${cands.length} 篇都像）`);
            continue;
          }
        }
      }
      if (!matched) {
        unmatched.push(e.key);
        continue;
      }
      hits.push({
        key: e.key,
        tags: e.tags,
        how,
        links: matched.map((r) => r.链接),
      });
    }

    const affected = new Set();
    hits.forEach((h) => h.links.forEach((l) => affected.add(l)));
    return {
      hits,
      unmatched,
      ambiguous,
      fuzzy,
      dup,
      affected: affected.size,
      entries: entries.length,
    };
  }

  function applyTagImport(plan, mode) {
    const cur = lib.read();
    const map = new Map(cur.rows.map((r) => [r.链接, r]));
    const touched = new Set();
    for (const h of plan.hits) {
      for (const link of h.links) {
        const r = map.get(link);
        if (!r) continue;
        if (mode === "replace" && !touched.has(link)) r._tags = h.tags.slice();
        else {
          const t = (r._tags || []).slice();
          for (const x of h.tags) if (t.indexOf(x) < 0) t.push(x);
          r._tags = t;
        }
        touched.add(link);
      }
    }
    requireWriteResult(lib.write(cur), "文章库保存失败，标签导入未保存，请稍后重试");
    return touched.size;
  }

  /** 导出成数组写法：好读好改，链接还能精确匹配回来 */
  function tagsToJson() {
    const rows = lib.read().rows.filter((r) => (r._tags || []).length);
    return JSON.stringify(
      rows.map((r) => ({ 标题: r.标题, 链接: r.链接, 标签: r._tags })),
      null,
      2,
    );
  }

  /** 「列设置」只预览当前账号的最新一篇。 */
  function sampleRow() {
    return lib.read().rows[0] || {};
  }

  /** 分库之前存下的老数据，没有账号归属 */
  function legacyLib() {
    const v = readStoredRows(LEGACY_LIB_KEY, "未归属的旧文章库");
    return v && v.rows.length ? v : null;
  }

  const progress = {
    read() {
      return readStoredRows(progKey(), "抓取进度");
    },
    write(v) {
      requiredWrite(
        progKey(),
        JSON.stringify(
          Object.assign({}, v, { rows: v.rows.map(normalizeFetchTime) }),
        ),
        "抓取进度保存失败，已停止抓取；本页结果未确认保存，请稍后重试",
      );
    },
    clear() {
      requiredWrite(progKey(), "", "抓取进度清理失败，已保存的文章仍保留，请稍后重试");
    },
  };

  /* ---- 列配置 + 模板 ---- */
  const cfg = {
    read() {
      let v = {};
      try {
        v = JSON.parse(rawRead(CFG_KEY, "{}")) || {};
      } catch (e) {
        v = {};
      }
      return {
        order: Array.isArray(v.order) ? v.order : [],
        off: Array.isArray(v.off) ? v.off : DEFAULT_OFF.slice(),
        sum: Array.isArray(v.sum) ? v.sum : DEFAULT_SUM.slice(),
        durUnit: DUR_UNITS.indexOf(v.durUnit) >= 0 ? v.durUnit : DUR_UNITS[0],
        preset: typeof v.preset === "string" ? v.preset : "",
      };
    },
    write(v) {
      rawWrite(CFG_KEY, JSON.stringify(v));
    },
    patch(kv) {
      cfg.write(Object.assign(cfg.read(), kv));
    },
    reset() {
      rawWrite(CFG_KEY, "{}");
    },
  };

  const SHAPE = ["order", "off", "sum", "durUnit"];
  const shapeOf = (c) => {
    const o = {};
    SHAPE.forEach((k) => {
      o[k] = c[k];
    });
    return o;
  };
  const sameShape = (a, b) =>
    JSON.stringify(shapeOf(a)) === JSON.stringify(shapeOf(b));

  const presets = {
    read() {
      try {
        const v = JSON.parse(rawRead(PRESET_KEY, "{}"));
        return v && typeof v === "object" ? v : {};
      } catch (e) {
        return {};
      }
    },
    write(v) {
      rawWrite(PRESET_KEY, JSON.stringify(v));
    },
    names() {
      return Object.keys(presets.read());
    },
    save(name) {
      const all = presets.read();
      // 存完整顺序，并写回 cfg，否则存完立刻会被判成「已改动」
      const full = orderedSchema().map((x) => x.c.col);
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
    remove(name) {
      const all = presets.read();
      delete all[name];
      presets.write(all);
    },
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

  // 旧列设置和模板已有 off 数组；只补 DEFAULT_OFF 不会让新增列默认关闭。
  // 每组新增列只迁移一次，之后用户手动勾开的列和模板选择都保持原样。
  function migrateDefaultOffColumns(key, columns) {
    if (rawRead(key, "") === "1") return;
    const addOff = (saved) => {
      if (!saved || typeof saved !== "object" || Array.isArray(saved))
        return false;
      const before = Array.isArray(saved.off) ? saved.off : DEFAULT_OFF;
      const after = [...new Set([...before, ...columns])];
      if (Array.isArray(saved.off) && after.length === before.length)
        return false;
      saved.off = after;
      return true;
    };
    try {
      const saved = JSON.parse(rawRead(CFG_KEY, "null"));
      if (addOff(saved)) rawWrite(CFG_KEY, JSON.stringify(saved));
    } catch (e) {
      /* 失效配置由 cfg.read() 使用默认值 */
    }
    try {
      const all = JSON.parse(rawRead(PRESET_KEY, "null"));
      if (all && typeof all === "object" && !Array.isArray(all)) {
        let changed = false;
        Object.values(all).forEach((saved) => {
          changed = addOff(saved) || changed;
        });
        if (changed) rawWrite(PRESET_KEY, JSON.stringify(all));
      }
    } catch (e) {
      /* 失效模板由 presets.read() 忽略 */
    }
    rawWrite(key, "1");
  }
  // 兼容 3.5.19 曾短暂出现的两个听全文列；下一步再合并为一个前台列。
  function migrateListenColumn() {
    if (rawRead(LISTEN_COL_MIGRATED_KEY, "") === "1") return;
    const hadOldOptional = rawRead(DETAIL_SOURCE_COLS_MIGRATED_KEY, "") === "1";
    const adjust = (saved) => {
      if (!saved || typeof saved !== "object" || Array.isArray(saved))
        return false;
      const off = Array.isArray(saved.off) ? saved.off : DEFAULT_OFF;
      const oldMainOn = !off.includes("听全文");
      // 直接从 3.5.16 升级时旧可选列根本不存在，不能把它误判为已开启。
      const oldCountOn =
        Array.isArray(saved.off) &&
        hadOldOptional &&
        !off.includes("详情听全文次数");
      const nextOff = new Set(off);
      nextOff.delete("详情听全文次数");
      nextOff.add("听全文人数");
      if (oldMainOn || oldCountOn) nextOff.delete("听全文");
      else nextOff.add("听全文");
      if (oldMainOn && oldCountOn) nextOff.delete("听全文人数");
      saved.off = [...nextOff];

      if (Array.isArray(saved.order)) {
        const bothInOrder =
          saved.order.includes("听全文") &&
          saved.order.includes("详情听全文次数");
        const mapped = saved.order.map((name) => {
          if (name === "详情听全文次数")
            return oldCountOn ? "听全文" : "听全文人数";
          if (name === "听全文" && oldCountOn && bothInOrder)
            return "听全文人数";
          return name;
        });
        saved.order = [...new Set(mapped)];
      }
      // 旧版自定义互动量若用了「听全文」，其含义是 UV，迁移后仍按人数计算。
      if (Array.isArray(saved.sum)) {
        saved.sum = [
          ...new Set(
            saved.sum.map((name) => (name === "听全文" ? "听全文人数" : name)),
          ),
        ];
      }
      return true;
    };
    try {
      const saved = JSON.parse(rawRead(CFG_KEY, "null"));
      if (adjust(saved)) rawWrite(CFG_KEY, JSON.stringify(saved));
    } catch (e) {
      /* 失效配置由 cfg.read() 使用默认值 */
    }
    try {
      const all = JSON.parse(rawRead(PRESET_KEY, "null"));
      if (all && typeof all === "object" && !Array.isArray(all)) {
        let changed = false;
        Object.values(all).forEach((saved) => {
          changed = adjust(saved) || changed;
        });
        if (changed) rawWrite(PRESET_KEY, JSON.stringify(all));
      }
    } catch (e) {
      /* 失效模板由 presets.read() 忽略 */
    }
    rawWrite(LISTEN_COL_MIGRATED_KEY, "1");
  }
  migrateListenColumn();
  migrateDefaultOffColumns(
    DETAIL_SOURCE_COLS_MIGRATED_KEY,
    DETAIL_SOURCE_COLUMNS,
  );
  migrateDefaultOffColumns(EXTRA_LIST_COLS_MIGRATED_KEY, EXTRA_LIST_COLUMNS);
  // 前台只保留「听全文」一列：任一旧列开启则保留开启，模板顺序与自定义求和同步合并。
  function migrateUnifiedListenColumn() {
    if (rawRead(LISTEN_UNIFIED_MIGRATED_KEY, "") === "1") return;
    const adjust = (saved) => {
      if (!saved || typeof saved !== "object" || Array.isArray(saved))
        return false;
      const off = Array.isArray(saved.off) ? saved.off : DEFAULT_OFF;
      const on = !off.includes("听全文") || !off.includes("听全文人数");
      const nextOff = new Set(off);
      nextOff.delete("听全文人数");
      nextOff.delete("详情听全文次数");
      if (on) nextOff.delete("听全文");
      else nextOff.add("听全文");
      saved.off = [...nextOff];
      if (Array.isArray(saved.order)) {
        saved.order = [
          ...new Set(
            saved.order.map((name) =>
              name === "听全文人数" || name === "详情听全文次数"
                ? "听全文"
                : name,
            ),
          ),
        ];
      }
      if (Array.isArray(saved.sum)) {
        saved.sum = [
          ...new Set(
            saved.sum.map((name) =>
              name === "听全文人数" || name === "详情听全文次数"
                ? "听全文"
                : name,
            ),
          ),
        ];
      }
      return true;
    };
    try {
      const saved = JSON.parse(rawRead(CFG_KEY, "null"));
      if (adjust(saved)) rawWrite(CFG_KEY, JSON.stringify(saved));
    } catch (e) {
      /* 失效配置由 cfg.read() 使用默认值 */
    }
    try {
      const all = JSON.parse(rawRead(PRESET_KEY, "null"));
      if (all && typeof all === "object" && !Array.isArray(all)) {
        let changed = false;
        Object.values(all).forEach((saved) => {
          changed = adjust(saved) || changed;
        });
        if (changed) rawWrite(PRESET_KEY, JSON.stringify(all));
      }
    } catch (e) {
      /* 失效模板由 presets.read() 忽略 */
    }
    rawWrite(LISTEN_UNIFIED_MIGRATED_KEY, "1");
  }
  migrateUnifiedListenColumn();
  function removeDetailComparisonColumns() {
    if (rawRead(DETAIL_DUP_COLS_REMOVED_KEY, "") === "1") return;
    const removed = new Set(DETAIL_SOURCE_COLUMNS);
    const adjust = (saved) => {
      if (!saved || typeof saved !== "object" || Array.isArray(saved))
        return false;
      for (const key of ["off", "order", "sum"]) {
        if (Array.isArray(saved[key]))
          saved[key] = saved[key].filter((name) => !removed.has(name));
      }
      return true;
    };
    try {
      const saved = JSON.parse(rawRead(CFG_KEY, "null"));
      if (adjust(saved)) rawWrite(CFG_KEY, JSON.stringify(saved));
    } catch (e) {
      /* 失效配置由 cfg.read() 使用默认值 */
    }
    try {
      const all = JSON.parse(rawRead(PRESET_KEY, "null"));
      if (all && typeof all === "object" && !Array.isArray(all)) {
        let changed = false;
        Object.values(all).forEach((saved) => {
          changed = adjust(saved) || changed;
        });
        if (changed) rawWrite(PRESET_KEY, JSON.stringify(all));
      }
    } catch (e) {
      /* 失效模板由 presets.read() 忽略 */
    }
    rawWrite(DETAIL_DUP_COLS_REMOVED_KEY, "1");
  }
  removeDetailComparisonColumns();
  function migrateFetchTimeColumn() {
    if (rawRead(FETCH_TIME_COL_MIGRATED_KEY, "") === "1") return;
    const oldNames = new Set(["数据时间", "详情时间"]);
    const newName = "最近获取时间";
    const adjust = (saved) => {
      if (!saved || typeof saved !== "object" || Array.isArray(saved))
        return false;
      const off = Array.isArray(saved.off) ? saved.off : DEFAULT_OFF;
      const on = !off.includes("数据时间") || !off.includes("详情时间");
      const nextOff = new Set(
        off.filter((name) => !oldNames.has(name) && name !== newName),
      );
      if (!on) nextOff.add(newName);
      saved.off = [...nextOff];
      if (Array.isArray(saved.order)) {
        const nextOrder = [];
        let placed = false;
        for (const name of saved.order) {
          if (oldNames.has(name) || name === newName) {
            if (!placed) {
              nextOrder.push(newName);
              placed = true;
            }
          } else if (!nextOrder.includes(name)) nextOrder.push(name);
        }
        saved.order = nextOrder;
      }
      if (Array.isArray(saved.sum))
        saved.sum = saved.sum.filter((name) => !oldNames.has(name));
      return true;
    };
    try {
      const saved = JSON.parse(rawRead(CFG_KEY, "null"));
      if (adjust(saved)) rawWrite(CFG_KEY, JSON.stringify(saved));
    } catch (e) {
      /* 失效配置由 cfg.read() 使用默认值 */
    }
    try {
      const all = JSON.parse(rawRead(PRESET_KEY, "null"));
      if (all && typeof all === "object" && !Array.isArray(all)) {
        let changed = false;
        Object.values(all).forEach((saved) => {
          changed = adjust(saved) || changed;
        });
        if (changed) rawWrite(PRESET_KEY, JSON.stringify(all));
      }
    } catch (e) {
      /* 失效模板由 presets.read() 忽略 */
    }
    rawWrite(FETCH_TIME_COL_MIGRATED_KEY, "1");
  }
  migrateFetchTimeColumn();

  // 清理旧列设置与模板中的废弃列；封面已不再采集，历史文章原字段不在这里清理。
  function removeUnusedExportColumns() {
    if (rawRead(UNUSED_EXPORT_COLS_REMOVED_KEY, "") === "1") return;
    const removed = new Set(["封面图", "数据页链接"]);
    const adjust = (saved) => {
      if (!saved || typeof saved !== "object" || Array.isArray(saved))
        return false;
      let changed = false;
      for (const key of ["off", "order", "sum"]) {
        if (!Array.isArray(saved[key])) continue;
        const next = saved[key].filter((name) => !removed.has(name));
        if (next.length === saved[key].length) continue;
        saved[key] = next;
        changed = true;
      }
      return changed;
    };
    try {
      const saved = JSON.parse(rawRead(CFG_KEY, "null"));
      if (adjust(saved)) rawWrite(CFG_KEY, JSON.stringify(saved));
    } catch (e) {
      /* 失效配置由 cfg.read() 使用默认值 */
    }
    try {
      const all = JSON.parse(rawRead(PRESET_KEY, "null"));
      if (all && typeof all === "object" && !Array.isArray(all)) {
        let changed = false;
        Object.values(all).forEach((saved) => {
          changed = adjust(saved) || changed;
        });
        if (changed) rawWrite(PRESET_KEY, JSON.stringify(all));
      }
    } catch (e) {
      /* 失效模板由 presets.read() 忽略 */
    }
    rawWrite(UNUSED_EXPORT_COLS_REMOVED_KEY, "1");
  }
  removeUnusedExportColumns();

  function presetDirty() {
    const c = cfg.read();
    if (!c.preset) return false;
    const p = presets.read()[c.preset];
    return (
      !p ||
      !sameShape(
        c,
        Object.assign(
          { order: [], off: [], sum: [], durUnit: DUR_UNITS[0] },
          p,
        ),
      )
    );
  }

  /* ==========================================================================
   * 5. 列的顺序 / 勾选 / 派生
   * ========================================================================== */
  function orderedSchema() {
    const { order, off } = cfg.read();
    const left = new Map(EXPORT_SCHEMA.map((c) => [c.col, c]));
    const out = [];
    for (const name of order)
      if (left.has(name)) {
        out.push(left.get(name));
        left.delete(name);
      }
    for (const c of left.values()) out.push(c); // 以后新增的列排最后
    return out.map((c) => ({ c, on: off.indexOf(c.col) < 0 }));
  }
  const activeSchema = () =>
    orderedSchema()
      .filter((x) => x.on)
      .map((x) => x.c);

  const headerName = (c) =>
    typeof c.header === "function" ? c.header() : c.col;
  const durUnit = () => cfg.read().durUnit;

  function sumCols() {
    const picked = cfg.read().sum;
    return EXPORT_SCHEMA.filter(
      (c) => c.sumable && picked.indexOf(c.col) >= 0,
    ).map((c) => c.col);
  }
  function listenValue(row) {
    if (row._listenValue !== "" && row._listenValue != null)
      return row._listenValue;
    // 兼容升级前已抓的文章：3.5.17 起的 PV 和更早的 UV 均留在库里。
    if (row._dListenPv !== "" && row._dListenPv != null) return row._dListenPv;
    return row.听全文;
  }
  function sumValue(row) {
    return sumCols().reduce((s, col) => {
      const schema = EXPORT_SCHEMA.find((c) => c.col === col);
      return s + num(cellOf(row, schema));
    }, 0);
  }

  /**
   * 单篇数据页地址。规则实测：msgid = appmsgid + '_' + itemidx。
   * token 是登录会话级的，所以不入库，用的时候拿当前页面的现拼。
   * 默认跟随新版原生入口带 pageVersion=1。旧文章若明确返回系统错误(-1)，
   * 由 crawlDetails 等待后仅回退一次旧版；不能为兼容旧文章而统一移除该参数。
   */
  function pageToken() {
    try {
      return new URLSearchParams(location.search).get("token") || "";
    } catch (e) {
      return "";
    }
  }

  function detailUrl(r, version = "new") {
    if (!r || !r._appmsgid) return "";
    const token = pageToken();
    const pd = cell(r.发布日期).replace(/\//g, "-");
    if (!token || !pd) return "";
    return (
      "https://mp.weixin.qq.com/misc/appmsganalysis?action=detailpage" +
      `&msgid=${r._appmsgid}_${r._itemidx || 1}&publish_date=${pd}` +
      `&type=int${version === "legacy" ? "" : "&pageVersion=1"}&token=${token}&lang=zh_CN`
    );
  }

  function cellOf(r, c) {
    if (c.value) return cell(c.value(r));
    let v = cell(r[c.from]);
    if (c.num) v = v.replace(/,/g, "");
    return v;
  }

  /* ==========================================================================
   * 6. 解析
   * ========================================================================== */

  /**
   * 找到 marker 之后第一个 {，括号配对扫描出完整 JSON。
   * 不能用正则——嵌套花括号会让正则要么贪吃要么少吃。
   * 扫描要跳过字符串内部的花括号和 \" 转义引号。
   */
  function extractJsonAfter(text, marker) {
    const at = text.indexOf(marker);
    if (at < 0) return null;
    const start = text.indexOf("{", at + marker.length);
    if (start < 0) return null;

    let depth = 0,
      inStr = false,
      escd = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (escd) escd = false;
        else if (ch === "\\") escd = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  /** publish_info 是一层 HTML 转义过的 JSON 串 */
  function decodeEntities(s) {
    if (s.indexOf("&") < 0) return s;
    return s
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&"); // &amp; 必须最后
  }

  /** 页面注释说 publish_page 会转义引号，优先读 publish_page_noencode */
  function parsePublishPage(html) {
    for (const m of [
      "publish_page_noencode =",
      "publish_page_noencode=",
      "publish_page =",
      "publish_page=",
    ]) {
      const raw = extractJsonAfter(html, m);
      if (!raw) continue;
      try {
        const o = JSON.parse(raw);
        if (o && Array.isArray(o.publish_list)) return o;
      } catch (e) {
        /* 下一个 */
      }
    }
    return null;
  }

  /**
   * 按「群发条目」返回，不直接摊平。
   * 因为 begin 是按条目走的，只有一组组地数才能准确记住覆盖到第几条。
   * 一次群发可能是多图文，appmsg_info 里几篇共用同一个发布时间。
   */
  /**
   * 取这一条的发布时间戳。
   *
   * 两种发布方式的结构不一样，实测：
   *   群发（publish_type=101）→ sent_info.time
   *   发布 / 未通知（publish_type=1）→ 根本没有 sent_info，
   *     时间在 publish_info.create_time，appmsg_info[].line_info.send_time 也是同一个值
   * 早先只认 sent_info.time，未通知的文章就拿到 0 —— 没日期就拼不出数据页链接，
   * 详情永远补不上，而且排序会掉到最后。
   */
  function groupTs(info) {
    if (!info) return 0;
    const arts = info.appmsg_info || info.appmsgex || [];
    const cands = [
      info.sent_info && info.sent_info.time,
      info.publish_info && info.publish_info.create_time,
      ...arts.map((a) => a && a.line_info && a.line_info.send_time),
      info.create_time,
      info.update_time,
    ];
    for (const v of cands) {
      const n = Number(v);
      if (n > 1000000000 && n < 4000000000) return n;
    }
    return 0;
  }

  function groupsFromPage(page, stat) {
    const out = [];
    const at = stampNow();
    for (const item of page.publish_list || []) {
      let info = null;
      try {
        info = JSON.parse(decodeEntities(String(item.publish_info || "")));
      } catch (e) {
        stat.badItems++;
        out.push({ ts: 0, rows: [] });
        continue;
      }

      const ts = groupTs(info);
      const d = ts ? new Date(ts * 1000) : null;
      const rows = [];
      // 未通知的条目结构略有不同，文章数组有时挂在 appmsgex 上
      for (const a of (info && (info.appmsg_info || info.appmsgex)) || []) {
        if (!a) continue;
        if (SKIP_DELETED && a.is_deleted) {
          stat.deleted++;
          continue;
        }
        if (!a.content_url) {
          stat.noUrl++;
          continue;
        }
        const n = (k) => (typeof a[k] === "number" ? String(a[k]) : "");
        rows.push({
          发布日期: d ? fmtDate(d) : "",
          发布时间: d ? fmtTime(d) : "",
          标题: String(a.title || "").trim(),
          链接: String(a.content_url || "").trim(),
          阅读量: n("read_num"),
          点赞: n("old_like_num"), // 👍
          在看: n("like_num"), // ♡
          分享: n("share_num"),
          留言: n("comment_num"),
          划线人数:
            a.line_info && typeof a.line_info.line_count === "number"
              ? String(a.line_info.line_count)
              : "",
          被转载次数: n("reprint_num"),
          最近获取时间: at,
          _ts: ts,
          _appmsgid: a.appmsgid ? String(a.appmsgid) : "",
          _itemidx: a.itemidx ? String(a.itemidx) : "1",
        });
      }
      out.push({ ts, rows });
    }
    return out;
  }

  /** 从单篇数据页的 HTML 里抠 article_data_new / subs_transform。
   *  旧文章可能只返回 read_pv，没有 read_uv；两者都能证明这是详情数据，
   *  阅读、分享的 PV 和 UV 不能互相代替，字段写库时仍按各自含义处理。
   */
  function parseDetail(html) {
    for (const text of [html, decodeEntities(html)]) {
      const a = extractJsonAfter(text, "article_data_new");
      if (!a) continue;
      let data = null;
      try {
        data = JSON.parse(a);
      } catch (e) {
        continue;
      }
      if (
        !data ||
        (typeof data.read_uv !== "number" && typeof data.read_pv !== "number")
      )
        continue;
      let subs = null;
      const s = extractJsonAfter(text, "subs_transform");
      if (s) {
        try {
          subs = JSON.parse(s);
        } catch (e) {
          subs = null;
        }
      }
      return { data, subs };
    }
    return null;
  }

  /**
   * 详情 → 库里的字段。
   *
   * ⚠ 这里故意「不写」阅读量/点赞/在看/分享/留言那五个数。
   *   微信的单篇数据页只统计发表后 30 天内的数据，超期就冻结；
   *   而发表记录列表里的这五个数是一直活的（实测 47 天前的文章还在涨）。
   *   所以那五个数一律以列表为准，详情只负责列表拿不到的那几项。
   *   详情页自己报的重名指标存进 _d* 供内部排查，
   *   前台只导出列表的同名指标。
   */
  function detailFields(d, version = "new") {
    const A = d.data || {};
    const S = d.subs || {};
    const hasCollection = typeof A.collection_uv === "number" && Number.isFinite(A.collection_uv);
    // _detail 只表示成功取得详情；收藏状态描述本次响应，不推断文章永久不支持。
    const out = {
      _detail: 1,
      _detailVersion: version === "legacy" ? "legacy" : "new",
      _collectionStatus: hasCollection ? "available"
        : version === "legacy" ? "legacy_unavailable" : "missing",
      最近获取时间: stampNow(),
    };
    // 旧文章的返回会省略部分 UV 字段；未返回的字段保持库里的原值，
    // 不能用 PV 代替 UV，也不能用空值抹掉上次抓到的详情。
    const put = (name, value) => {
      if (typeof value === "number" && Number.isFinite(value))
        out[name] = String(value);
    };
    put("_dRead", A.read_uv);
    put("_dReadPv", A.read_pv);
    put("_dLike", A.like_cnt);
    put("_dZaikan", A.zaikan_cnt);
    put("_dShare", A.share_uv);
    put("_dSharePv", A.share_pv);
    put("_dComment", A.comment_cnt);
    put("收藏", A.collection_uv);
    put("赞赏", A.praise_money);
    put("听全文", A.listen_uv); // 历史存储键保留 UV
    put("_dListenPv", A.listen_pv);
    if (typeof A.listen_uv === "number" && Number.isFinite(A.listen_uv)) {
      put("_listenValue", A.listen_uv);
      out._listenSource = "uv";
    } else if (
      typeof A.listen_pv === "number" &&
      Number.isFinite(A.listen_pv)
    ) {
      put("_listenValue", A.listen_pv);
      out._listenSource = "pv";
    }
    put("_dInteractionRatio", A.interaction_ratio);
    put("阅读后关注人数", A.follow_after_read_uv);
    put("_durSec", A.avg_article_read_time); // 原始就是秒
    put("_finishRatio", A.finished_read_pv_ratio); // 0~1，精度比页面高
    put("_sendUv", S.send_uv); // 送达人数，默认不导出
    return out;
  }

  /* ==========================================================================
   * 7. 抓取
   * ========================================================================== */
  const FREQ_RE = /操作过于频繁|操作频繁|访问过于频繁|请求过于频繁|频率限制/i;
  const LOGIN_RE = /重新登录|登录已?(过期|超时|失效)|请先登录|scanlogin/i;
  const SYSTEM_ERROR_RE = /系统错误\s*[（(]\s*-1\s*[）)]/;

  // 详情页的正常脚本也可能带有通用错误文案；只依据页面可见文本判断。
  function visiblePageText(html) {
    return decodeEntities(
      String(html)
        .replace(/<!--[^]*?-->/g, " ")
        .replace(
          /<(script|style|template|noscript)\b[^>]*>[^]*?<\/\1\s*>/gi,
          " ",
        )
        .replace(/<[^>]+>/g, " "),
    );
  }

  function diagnose(html) {
    const visible = visiblePageText(html);
    if (LOGIN_RE.test(visible))
      return "返回页面提示登录状态失效，请刷新后台并重新登录。";
    if (FREQ_RE.test(visible))
      return "返回页面提示“操作过于频繁”，请稍后再试。";
    if (SYSTEM_ERROR_RE.test(visible))
      return "微信后台返回“系统错误(-1)”页面，未提供数据。";
    return null;
  }

  // 仅用于新版未解析出有效详情时。登录/限流优先停止，不能通过切换版本继续请求。
  function canRetryLegacyDetail(html) {
    const visible = visiblePageText(html);
    return SYSTEM_ERROR_RE.test(visible) && !LOGIN_RE.test(visible) && !FREQ_RE.test(visible);
  }

  /**
   * 请求列表时只保留这些结构性参数，其它一律丢掉。
   * ⚠ 关键是搜索关键词：页面上只要在搜索状态，location.href 里就带着它，
   *   照抄过来我们拿到的就是「搜索结果」而不是完整列表 ——
   *   条数变了、顺序变了，begin 的含义整个失效，按全库序号估的页码全对不上。
   */
  const LIST_KEEP = [
    "sub",
    "type",
    "free_publish_type",
    "sub_action",
    "token",
    "lang",
  ];

  function listUrl(begin) {
    const src = new URL(location.href);
    const u = new URL(src.origin + src.pathname);
    LIST_KEEP.forEach((k) => {
      const v = src.searchParams.get(k);
      if (v != null && v !== "") u.searchParams.set(k, v);
    });
    u.searchParams.set("begin", String(begin));
    u.searchParams.set("count", String(PAGE_SIZE));
    return u.toString();
  }

  /** 页面当前带了哪些会干扰列表的多余参数（用来提醒用户） */
  function listExtraParams() {
    const skip = LIST_KEEP.concat(["begin", "count"]);
    const out = [];
    try {
      new URL(location.href).searchParams.forEach((v, k) => {
        if (skip.indexOf(k) < 0 && v) out.push(k);
      });
    } catch (e) {
      /* ignore */
    }
    return out;
  }

  let aborted = false;
  let detailAbortController = null;

  function stopDetailCrawl() {
    aborted = true;
    if (detailAbortController) detailAbortController.abort();
  }

  function sleepOrStop(ms, signal) {
    if (!signal) return sleep(ms);
    if (signal.aborted) return Promise.resolve();
    return new Promise((resolve) => {
      let timer;
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", finish);
        resolve();
      };
      timer = setTimeout(finish, ms);
      signal.addEventListener("abort", finish, { once: true });
      if (signal.aborted) finish();
    });
  }

  /** 请求间隔 */
  async function pace(
    i,
    onTip,
    timing = DETAIL_SPEEDS.standard,
    signal = null,
  ) {
    const long = i > 0 && i % REST_EVERY === 0;
    const wait = long
      ? rand(timing.restMin, timing.restMax)
      : rand(timing.min, timing.max);
    if (onTip)
      onTip(
        long
          ? `歇 ${Math.round(wait / 1000)} 秒…`
          : `等 ${(wait / 1000).toFixed(1)} 秒…`,
      );
    await sleepOrStop(wait, signal);
  }

  async function grab(url, signal = null) {
    let res;
    try {
      res = await fetch(url, {
        credentials: "same-origin",
        ...(signal ? { signal } : {}),
      });
    } catch (e) {
      if (signal && signal.aborted) throw e;
      throw new Error("网络请求失败：" + ((e && e.message) || e));
    }
    if (res.status === 429) throw new Error("微信返回 HTTP 429（请求过多）");
    if (res.status === 503) throw new Error("微信服务暂时不可用（HTTP 503）");
    if (!res.ok) throw new Error(`请求失败：HTTP ${res.status}`);
    return res.text();
  }

  /** 第 1 步：抓列表 */
  async function crawlList(opts, onProgress) {
    const context = accountContext();
    const sameContext = () => sameAccountContext(context);
    const resume = opts.resume || null;
    const rows = resume ? resume.rows.slice() : [];
    const seen = new Set(rows.map((r) => r.链接));
    const stat = Object.assign(
      { pages: 0, deleted: 0, noUrl: 0, badItems: 0, total: 0, reached: "" },
      (resume && resume.stat) || {},
    );
    const startBegin = resume ? resume.startBegin : opts.startBegin || 0;
    // 合库成功但清理进度失败时，重试必须沿用原基线，不能再次累加覆盖页码。
    const baseDoneBegin = resume && Number.isFinite(resume.baseDoneBegin)
      ? resume.baseDoneBegin
      : lib.read().doneBegin;
    let begin = resume ? resume.begin : startBegin;
    let groups = resume ? resume.groups || 0 : 0;
    let reason = resume && ["known", "cutoff", "end"].includes(resume.completionReason)
      ? resume.completionReason
      : "";
    const fresh = resume && Array.isArray(resume.fresh) ? resume.fresh.slice() : [];

    const save = () => {
      if (!sameContext()) return;
      progress.write({
        kind: "list",
        mode: opts.mode,
        startBegin,
        begin,
        groups,
        baseDoneBegin,
        rows,
        fresh,
        stat,
        completionReason: ["known", "cutoff", "end"].includes(reason) ? reason : "",
        stopAtTs: opts.stopAtTs || 0,
        cutoffTs: opts.cutoffTs || 0,
        at: Date.now(),
      });
    };

    for (let loop = 0; loop < MAX_PAGES && !reason; loop++) {
      if (!sameContext()) {
        reason = "stopped";
        break;
      }
      if (aborted) {
        reason = "stopped";
        save();
        break;
      }

      let html;
      try {
        html = await grab(listUrl(begin));
      } catch (e) {
        if (!sameContext()) {
          reason = "stopped";
          break;
        }
        if (aborted) {
          reason = "stopped";
          save();
          break;
        }
        save();
        throw new Error(e.message + "（进度已保存，可「继续上次」）");
      }
      if (!sameContext()) {
        reason = "stopped";
        break;
      }
      if (aborted) {
        reason = "stopped";
        save();
        break;
      }

      const page = parsePublishPage(html);
      if (!page) {
        const why = diagnose(html);
        save();
        if (why) throw new Error(why);
        if (stat.pages === 0)
          throw new Error(
            "没解析出 publish_page —— 确认在「发表记录」页，且登录未过期",
          );
        throw new Error("列表页面无法解析，进度已保存，可「继续上次」");
      }

      stat.total = page.total_count || stat.total;
      stat.pages++;

      const gs = groupsFromPage(page, stat);
      if (!gs.length) {
        if (stat.total && begin < stat.total) {
          save();
          throw new Error("列表提前返回空页，进度已保存，可「继续上次」");
        }
        reason = "end";
        break;
      }

      let stop = "";
      for (const g of gs) {
        if (!stop) {
          if (opts.stopAtTs && g.ts && g.ts <= opts.stopAtTs) stop = "known";
          else if (opts.cutoffTs && g.ts && g.ts < opts.cutoffTs)
            stop = "cutoff";
        }
        // 越过停止点：这页反正下载完了，数字收下来刷新已有记录，但不新增、不推进覆盖进度
        if (stop) {
          for (const r of g.rows) fresh.push(r);
          continue;
        }
        for (const r of g.rows) {
          if (seen.has(r.链接)) continue;
          seen.add(r.链接);
          rows.push(r);
        }
        groups++;
        begin++;
      }

      if (rows.length) stat.reached = rows[rows.length - 1].发布日期;
      save();

      if (stop) {
        reason = stop;
        break;
      }
      if (stat.total && begin >= stat.total) {
        reason = "end";
        break;
      }

      onProgress(rows.length, stat, "");
      await pace(stat.pages, (tip) => onProgress(rows.length, stat, tip));
    }

    if (!reason) {
      reason = "limit";
      save();
    }
    const incomplete = reason === "stopped" || reason === "limit";
    if (sameContext()) {
      // 完成状态也先保存；主库提交失败时可直接重试，不必重复发请求。
      // 所有抓取模式都由调用方在主库保存成功后清理进度。
      save();
      onProgress(rows.length, stat, "");
    }
    return {
      rows,
      fresh,
      stat,
      groups,
      startBegin,
      baseDoneBegin,
      reason,
      stopped: incomplete,
      limited: reason === "limit",
    };
  }

  /**
   * 刷新指定文章的「实时数」（阅读/点赞/在看/分享/留言）。
   *
   * 列表按发布时间倒序排，begin 是按群发条目走的，所以能算出某篇文章
   * 大概落在第几页 —— 不用从 begin=0 一页页翻过去。
   * 同一页上的多篇文章共用一个请求，所以刷 251 篇也就十几个请求。
   *
   * 估算可能有偏移（比如中间有整组都被删掉的文章，它仍占一个 begin 位），
   * 所以命中不到的会往两边邻页找，找不到就报出来，不假装成功。
   */
  async function refreshLive(targets, onProgress) {
    const context = accountContext();
    const sameContext = () => sameAccountContext(context);
    const all = lib.read().rows;

    // 一个发布时间戳 = 一次群发 = 一个 begin 位
    const tsDesc = [...new Set(all.map((r) => r._ts))].sort((a, b) => b - a);
    const giOf = new Map();
    tsDesc.forEach((ts, i) => giOf.set(ts, i));

    const want = new Map(targets.map((r) => [r.链接, r]));
    const done = new Set();
    const pageOf = (gi) => Math.max(0, Math.floor(gi / PAGE_SIZE) * PAGE_SIZE);

    let totalGroups = 0; // 从返回里学到的 total_count，用来卡住上界
    // 库里的序号 ≠ 服务器上的 begin：中间可能有整组被跳过（比如全是已删除的文章，
    // 它仍占一个 begin 位）。每抓到一页就把真实偏移量学下来，后面的估算就准了。
    let offset = 0;

    const queue = [];
    const queued = new Set();
    const pushPage = (b) => {
      if (b < 0) return;
      if (totalGroups && b >= totalGroups) return;
      if (queued.has(b)) return;
      queued.add(b);
      queue.push(b);
    };
    const estPage = (r) => {
      const gi = giOf.get(r._ts);
      return gi == null ? null : pageOf(gi + offset);
    };
    targets.forEach((r) => {
      const p = estPage(r);
      if (p != null) pushPage(p);
    });

    let reqs = 0,
      updated = 0,
      rounds = 0;
    const MAX_REQS = Math.min(80, Math.max(10, queued.size * 3));

    for (let qi = 0; qi < queue.length && reqs < MAX_REQS; qi++) {
      if (aborted || !sameContext()) break;
      const begin = queue[qi];

      let html;
      try {
        html = await grab(listUrl(begin));
      } catch (e) {
        if (!sameContext()) break;
        throw new Error(e.message + `（已刷新 ${done.size} 篇）`);
      }
      if (!sameContext()) break;
      reqs++;

      const page = parsePublishPage(html);
      if (!page) {
        const why = diagnose(html);
        if (why) throw new Error(why + `（已刷新 ${done.size} 篇）`);
        continue;
      }
      totalGroups = page.total_count || totalGroups;

      const gs = groupsFromPage(page, { deleted: 0, noUrl: 0, badItems: 0 });
      const fresh = [];
      gs.forEach((g, j) =>
        g.rows.forEach((row) => {
          fresh.push(row);
          // 顺便学偏移：这一组在服务器上的真实位置 vs 库里算出来的位置
          const gi = giOf.get(row._ts);
          if (gi != null) offset = begin + j - gi;
        }),
      );

      // 这一页里凡是库里有的，实时数一律回填（不只是选中的，反正页面已经下载了）
      updated += lib.merge([], null, fresh).updated;
      fresh.forEach((row) => {
        if (want.has(row.链接)) done.add(row.链接);
      });

      onProgress(done.size, want.size, reqs, "");
      if (done.size >= want.size) break;

      if (qi === queue.length - 1) {
        const missed = [...want.entries()]
          .filter((e) => !done.has(e[0]))
          .map((e) => e[1]);

        // 先用刚学到的偏移重新估一遍没命中的
        missed.forEach((r) => {
          const p = estPage(r);
          if (p != null) pushPage(p);
        });

        // 还是见底就往邻页扩一圈，最多两圈
        if (qi === queue.length - 1 && rounds < 2) {
          rounds++;
          const step = PAGE_SIZE * rounds;
          const around = new Set();
          missed.forEach((r) => {
            const p = estPage(r);
            if (p != null) around.add(p);
          });
          // ⚠ 这里遍历的是 around，绝不能直接遍历 queued ——
          //   pushPage 会往 queued 里加，而 JS 的 Set 迭代器会访问遍历中新加的元素，
          //   就成了无限外扩，最后抛 "Set maximum size exceeded"。
          around.forEach((b) => {
            pushPage(b - step);
            pushPage(b + step);
          });
        }
      }

      if (qi < queue.length - 1)
        await pace(reqs, (tip) => onProgress(done.size, want.size, reqs, tip));
    }

    const missed = [...want.keys()]
      .filter((k) => !done.has(k))
      .map((k) => (want.get(k).标题 || k).slice(0, 20));
    return {
      done: done.size,
      total: want.size,
      reqs,
      updated,
      missed,
      stopped: aborted || !sameContext(),
    };
  }

  /* ---- 修复早期版本留下的空发布日期 -------------------------------
   * 旧版只认 sent_info.time，未通知文章会以 _ts=0 入库。平时增量抓取
   * 到最新一篇就停，不会重新经过这些旧记录。按后台完整列表只扫描一次，
   * 以文章 ID/序号或链接精确定位；找到后只回填日期字段，不动标签和详情。
   * 进度按账号保存，仅点击「修复缺日期文章」时扫描；打开面板不会自动扫描。
   * --------------------------------------------------------------- */
  const DATE_REPAIR_PREFIX = "mp_pub_date_repair_v1::";

  const needsDateRepair = (r) =>
    !cell(r.发布日期).trim() || !(Number(r._ts) > 0);
  const dateRepairId = (r) =>
    r._appmsgid ? `${r._appmsgid}_${r._itemidx || 1}` : "";
  const dateRepairKey = (r) => `${dateRepairId(r)}|${linkKey(r.链接)}`;

  function dateRepairProbes(missing, rows) {
    const dated = [];
    const seenTs = new Set();
    for (const row of [...rows].sort((a, b) => (b._ts || 0) - (a._ts || 0))) {
      const ts = Number(row._ts);
      const id = Number(row._appmsgid);
      if (!(ts > 0) || !(id > 0) || !Number.isSafeInteger(id) || seenTs.has(ts))
        continue;
      seenTs.add(ts);
      dated.push(id);
    }
    if (dated.length < PAGE_SIZE) return [];

    // appmsgid 大致随发表顺序变化，但并非严格单调；只用它缩小首轮探测范围，
    // 未命中仍会从第 0 页完整扫描，绝不据此直接回填日期。
    const probes = new Set();
    for (const row of missing) {
      const id = Number(row._appmsgid);
      if (!(id > 0) || !Number.isSafeInteger(id)) continue;
      let nearest = 0;
      for (let i = 1; i < dated.length; i++) {
        if (Math.abs(dated[i] - id) < Math.abs(dated[nearest] - id))
          nearest = i;
      }
      const base = Math.floor(nearest / PAGE_SIZE) * PAGE_SIZE;
      for (const delta of [0, -PAGE_SIZE, PAGE_SIZE]) {
        if (base + delta >= 0) probes.add(base + delta);
      }
    }
    return [...probes];
  }

  function newDateRepairState(keys, missing) {
    const probes = dateRepairProbes(missing, lib.read().rows);
    return {
      version: 1,
      knownKeys: keys,
      phase: probes.length ? "probe" : "scan",
      probes,
      probeIndex: 0,
      begin: 0,
      total: 0,
      exhausted: false,
    };
  }

  function readDateRepair(key) {
    const state = readStoredJson(key, "日期修复进度");
    if (state && !Array.isArray(state.knownKeys))
      throw storageError("日期修复进度格式异常，已停止操作，原数据未被覆盖");
    return state;
  }

  async function repairMissingDates(onProgress) {
    const context = accountContext();
    const accountId = context.id;
    const sameContext = () => sameAccountContext(context);
    const stateKey = DATE_REPAIR_PREFIX + accountId;
    const saveState = (state) => requiredWrite(
      stateKey, state ? JSON.stringify(state) : "",
      "日期修复进度保存失败，已停止修复；已保存的文章仍保留，请稍后重试",
    );
    let missing = lib.read().rows.filter(needsDateRepair);
    const initial = missing.length;
    let lastRemaining = initial;
    if (!initial) {
      saveState(null);
      return { pages: 0, repaired: 0, remaining: 0 };
    }

    let keys = missing.map(dateRepairKey).sort();
    let state = readDateRepair(stateKey);
    // 新的缺日期记录可能出现在已扫过的页面，必须从头开始查。
    // 上次已经扫完但仍有未命中的记录时，只有用户再次点击才重新扫描。
    if (
      !state ||
      state.version !== 1 ||
      state.exhausted ||
      keys.some((k) => !state.knownKeys.includes(k))
    ) {
      state = newDateRepairState(keys, missing);
      saveState(state);
    }
    state.begin = Math.max(0, Number(state.begin) || 0);
    state.total = Math.max(0, Number(state.total) || 0);
    state.probeIndex = Math.max(0, Number(state.probeIndex) || 0);
    if (!Array.isArray(state.probes) || state.phase !== "probe")
      state.phase = "scan";

    let pages = 0;
    for (let scanned = 0; scanned < MAX_PAGES; scanned++) {
      if (aborted || !sameContext()) break;

      missing = lib.read().rows.filter(needsDateRepair);
      lastRemaining = missing.length;
      if (!missing.length) {
        saveState(null);
        break;
      }
      keys = missing.map(dateRepairKey).sort();
      if (keys.some((k) => !state.knownKeys.includes(k))) {
        state = newDateRepairState(keys, missing);
        saveState(state);
      }
      if (state.phase === "probe" && state.probeIndex >= state.probes.length)
        state.phase = "scan";
      if (state.phase === "scan" && state.total && state.begin >= state.total) {
        state.exhausted = true;
        saveState(state);
        break;
      }
      const probing = state.phase === "probe";
      const requestBegin = probing
        ? state.probes[state.probeIndex]
        : state.begin;
      if (probing && state.total && requestBegin >= state.total) {
        state.probeIndex++;
        saveState(state);
        continue;
      }

      let html;
      try {
        html = await grab(listUrl(requestBegin));
      } catch (e) {
        throw new Error(`修复发布日期时${e.message}`);
      }
      if (aborted || !sameContext()) break;
      pages++;

      const page = parsePublishPage(html);
      if (!page)
        throw new Error(
          diagnose(html) || "发表记录返回的列表无法解析，稍后可继续修复。",
        );
      const groups = groupsFromPage(page, {
        deleted: 0,
        noUrl: 0,
        badItems: 0,
      });
      if (!groups.length) {
        if (probing) state.probeIndex++;
        else state.exhausted = true;
        saveState(state);
        if (onProgress)
          onProgress(pages, initial - missing.length, initial, "");
        if (state.exhausted) break;
        await pace(pages, (tip) => {
          if (onProgress)
            onProgress(pages, initial - missing.length, initial, tip);
        });
        continue;
      }

      const byId = new Map(
        missing.filter((r) => dateRepairId(r)).map((r) => [dateRepairId(r), r]),
      );
      const byLink = new Map(
        missing.filter((r) => linkKey(r.链接)).map((r) => [linkKey(r.链接), r]),
      );
      const cur = lib.read();
      let pagePatched = 0;
      for (const group of groups)
        for (const row of group.rows) {
          if (!row.发布日期 || !(row._ts > 0)) continue;
          const old =
            byId.get(dateRepairId(row)) || byLink.get(linkKey(row.链接));
          if (!old) continue;
          const i = cur.rows.findIndex((r) => r.链接 === old.链接);
          if (i < 0 || !needsDateRepair(cur.rows[i])) continue;
          cur.rows[i] = mergeArticleRows(cur.rows[i], {
            发布日期: row.发布日期,
            发布时间: row.发布时间,
            _ts: row._ts,
            最近获取时间: row.最近获取时间,
          });
          pagePatched++;
          byId.delete(dateRepairId(old));
          byLink.delete(linkKey(old.链接));
        }
      if (pagePatched) {
        cur.rows.sort((a, b) => (b._ts || 0) - (a._ts || 0));
        requireWriteResult(lib.write(cur), "文章库保存失败，日期修复未保存；进度未推进，请稍后重试");
        if (ui && acct.id === accountId) refresh();
      }

      if (probing) state.probeIndex++;
      else state.begin += groups.length;
      state.total = Number(page.total_count) || state.total;
      if (!probing && state.total && state.begin >= state.total)
        state.exhausted = true;
      saveState(state);
      const remainingAfterPage = lib.read().rows.filter(needsDateRepair).length;
      lastRemaining = remainingAfterPage;
      if (!remainingAfterPage) saveState(null);
      if (onProgress)
        onProgress(pages, initial - remainingAfterPage, initial, "");
      if (!remainingAfterPage || state.exhausted) break;
      await pace(pages, (tip) => {
        if (onProgress)
          onProgress(pages, initial - remainingAfterPage, initial, tip);
      });
    }
    const remaining = sameContext()
      ? lib.read().rows.filter(needsDateRepair).length
      : lastRemaining;
    return {
      pages,
      repaired: initial - remaining,
      remaining,
      stopped: aborted || !sameContext(),
      exhausted: state.exhausted,
    };
  }

  /**
   * 第 2 步：抓详情。新版优先，仅明确不兼容时等待后回退一次，抓完立刻写回库。
   * todo 由调用方决定：
   *   「补详情」传从来没补过的（lib.pending()）
   *   「刷新选中」传选中的那些，不管之前补过没有 —— 运营数据会变，必须能重复刷
   */
  async function crawlDetails(
    todo,
    onProgress,
    timing = DETAIL_SPEEDS.standard,
    signal = null,
  ) {
    let done = 0,
      failed = 0,
      noUrl = 0,
      requests = 0,
      legacyMissingCollection = 0,
      missingCollection = 0;
    const fails = [];
    const context = accountContext();
    const token = pageToken();
    const sameContext = () =>
      sameAccountContext(context) && pageToken() === token;
    const shouldStop = () => aborted || !!(signal && signal.aborted) || !sameContext();

    for (let i = 0; i < todo.length; i++) {
      if (shouldStop()) {
        aborted = true;
        break;
      }
      const r = todo[i];
      const url = detailUrl(r);
      if (!url) {
        // 连链接都拼不出来，压根没发请求 —— 要和「请求了但解析不出」分开报，
        // 否则一句「没解析出数据」会把真正的原因盖住
        failed++;
        noUrl++;
        const why = !r._appmsgid
          ? "缺 appmsgid"
          : !cell(r.发布日期)
            ? "缺发布日期"
            : "缺 token";
        fails.push(`${r.标题}（${why}）`);
        onProgress(done, todo.length, failed, "");
        // 大量旧行都缺链接信息时，让出事件循环以便「停止」立即生效。
        if (noUrl % 20 === 0) await sleep(0);
        continue;
      }

      let html, d = null, version = "new";
      for (const attempt of ["new", "legacy"]) {
        // 回退等待期间也可能停止、换账号或换登录会话。
        if (shouldStop()) break;
        version = attempt;
        try {
          requests++;
          html = await grab(attempt === "new" ? url : detailUrl(r, "legacy"), signal);
        } catch (e) {
          if (shouldStop()) break;
          throw new Error(e.message + `（已补 ${done} 篇，剩下的下次接着补）`);
        }
        // 响应回来后再核对账号，避免将旧账号或旧登录会话的响应写入库。
        if (shouldStop()) break;
        d = parseDetail(html);
        if (!d && attempt === "new" && canRetryLegacyDetail(html)) {
          await pace(
            requests,
            (tip) => onProgress(done, todo.length, failed, `尝试旧版详情 · ${tip}`),
            timing,
            signal,
          );
          continue;
        }
        break;
      }
      if (shouldStop()) {
        aborted = true;
        break;
      }

      if (!d) {
        const why = diagnose(html);
        if (why) throw new Error(why + `（本轮已补 ${done} 篇）`);
        failed++;
        fails.push(r.标题);
      } else {
        const fields = detailFields(d, version);
        if (!lib.patch(r.链接, fields)) {
          throw new Error(
            `文章库保存失败或文章未找到（已补 ${done} 篇，剩余文章可稍后继续）`,
          );
        }
        done++;
        if (fields._collectionStatus === "legacy_unavailable") legacyMissingCollection++;
        if (fields._collectionStatus === "missing") missingCollection++;
      }

      onProgress(done, todo.length, failed, "");
      if (shouldStop()) {
        aborted = true;
        break;
      }
      if (i < todo.length - 1) {
        await pace(
          requests,
          (tip) => onProgress(done, todo.length, failed, tip),
          timing,
          signal,
        );
      }
    }
    return {
      done,
      failed,
      noUrl,
      legacyMissingCollection,
      missingCollection,
      fails,
      total: todo.length,
      stopped: aborted || !!(signal && signal.aborted),
    };
  }

  /* ==========================================================================
   * 完整备份与只读校验
   * --------------------------------------------------------------------------
   * 直接读取当前账号的原始对象，不经 lib.read / progress.read 的历史字段迁移。
   * 备份保留未知字段及未完成进度；校验不恢复、不改库，也不执行续传位置。
   * ========================================================================== */
  const BACKUP_FORMAT = "mp-data-backup";
  const BACKUP_FORMAT_VERSION = 1;

  function backupUtf8Bytes(text) {
    let bytes = 0;
    for (const char of text) {
      const code = char.codePointAt(0);
      bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    }
    return bytes;
  }

  /**
   * @returns {{valid:boolean, errors:string[], warnings:string[], summary:object|null}}
   * 旧版本可缺少可选字段，但已有字段的类型和账号归属必须自洽。
   */
  function validateBackup(input, currentAccountId) {
    const errors = [];
    const warnings = [];
    const fail = (message) => {
      if (errors.length < 50) errors.push(message);
      else if (errors.length === 50) errors.push("另有格式错误，请先修正以上问题后重新校验");
    };
    const object = (value) => !!value && typeof value === "object" && !Array.isArray(value);
    const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
    const textValue = (value) => typeof value === "string" && !!value.trim();
    const numeric = (value) =>
      (typeof value === "number" && Number.isFinite(value)) ||
      (typeof value === "string" && !!value.trim() && Number.isFinite(Number(value)));
    const counter = (value, label) => {
      if (!numeric(value) || Number(value) < 0 || !Number.isInteger(Number(value)))
        fail(`${label}应为非负整数`);
    };
    let backup;
    let serialized;
    try {
      if (typeof input === "string") {
        serialized = input;
        backup = JSON.parse(input.replace(/^\uFEFF/, ""));
      } else {
        // 拒绝 JSON 无法无损表示的对象；不静默丢弃 undefined 或把 NaN 改成 null。
        serialized = JSON.stringify(input, (_key, value) => {
          if (["undefined", "function", "symbol", "bigint"].includes(typeof value) ||
              (typeof value === "number" && !Number.isFinite(value)))
            throw new Error("non JSON value");
          return value;
        }, 2);
        backup = JSON.parse(serialized);
      }
    } catch (_) {
      return { valid: false, errors: ["文件不是有效的 JSON 备份"], warnings, summary: null };
    }
    if (!object(backup))
      return { valid: false, errors: ["备份根节点应为对象"], warnings, summary: null };
    if (backup.format !== BACKUP_FORMAT)
      fail("文件不是本插件的完整备份（format 不匹配）");
    if (backup.formatVersion !== BACKUP_FORMAT_VERSION)
      fail("备份格式版本不支持，请使用与此备份兼容的插件版本");
    if (!textValue(backup.scriptVersion)) fail("缺少有效的插件版本 scriptVersion");
    if (!textValue(backup.exportedAt) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(backup.exportedAt) ||
        !Number.isFinite(Date.parse(backup.exportedAt)))
      fail("缺少有效的备份时间 exportedAt");

    const account = object(backup.account) ? backup.account : null;
    if (!account) fail("缺少账号信息 account");
    else {
      if (!textValue(account.id)) fail("账号 id 应为非空字符串");
      if (!textValue(account.name)) fail("账号 name 应为非空字符串");
      if (typeof account.wxid !== "string") fail("账号 wxid 应为字符串");
      if (typeof account.known !== "boolean") fail("账号 known 应为布尔值");
      else if (textValue(account.id) && account.known !== (account.id !== "unknown"))
        fail("账号识别状态与账号 id 不一致");
      if (account.known === false || account.id === "unknown")
        warnings.push("备份来自未识别的账号，不能据此确认实际公众号归属");
      if (currentAccountId && account.id && account.id !== String(currentAccountId))
        warnings.push("备份账号与当前账号不同；本次仅校验，不会导入或修改当前账号数据");
    }

    const checkOwner = (value, label) => {
      if (has(value, "acctId")) {
        if (!(textValue(value.acctId) || (typeof value.acctId === "number" && Number.isFinite(value.acctId))))
          fail(`${label}的账号 acctId 格式异常`);
        else if (account && String(value.acctId) !== account.id)
          fail(`${label}的账号归属与备份账号不一致`);
      }
      if (has(value, "acctName")) {
        if (typeof value.acctName !== "string") fail(`${label}的账号名称 acctName 应为字符串`);
        else if (account && value.acctName && value.acctName !== account.name)
          warnings.push(`${label}保存的账号名称与当前备份名称不同，可能是账号曾改名；已保留原名称`);
      }
    };
    const numberFields = [
      "阅读量", "点赞", "在看", "分享", "留言", "划线人数", "被转载次数", "收藏", "赞赏",
      "听全文", "阅读后关注人数", "_durSec", "_finishRatio", "_ts", "_sendUv", "_listenValue",
      "_dRead", "_dReadPv", "_dLike", "_dZaikan", "_dShare", "_dSharePv", "_dComment",
      "_dListenPv", "_dInteractionRatio",
    ];
    const checkRows = (rows, label, allowDuplicate = false) => {
      if (!Array.isArray(rows)) {
        fail(`${label}应为文章数组`);
        return [];
      }
      const links = new Set();
      let duplicateFound = false;
      rows.forEach((row, index) => {
        const name = `${label}第 ${index + 1} 条`;
        if (!object(row)) {
          fail(`${name}应为对象`);
          return;
        }
        if (!textValue(row.链接)) fail(`${name}缺少非空文章链接`);
        else {
          const link = row.链接.trim();
          if (links.has(link)) {
            if (allowDuplicate) duplicateFound = true;
            else fail(`${name}的文章链接重复`);
          }
          links.add(link);
        }
        if (has(row, "_tags") && (!Array.isArray(row._tags) || row._tags.some((tag) => typeof tag !== "string")))
          fail(`${name}的 _tags 应为字符串数组`);
        if (has(row, "_detail") && ![0, 1, false, true].includes(row._detail))
          fail(`${name}的 _detail 应为 0、1 或布尔值`);
        if (has(row, "_detailVersion") && !["new", "legacy"].includes(row._detailVersion))
          fail(`${name}的 _detailVersion 应为 new 或 legacy`);
        if (has(row, "_collectionStatus") && !["available", "legacy_unavailable", "missing"].includes(row._collectionStatus))
          fail(`${name}的 _collectionStatus 格式异常`);
        numberFields.forEach((key) => {
          if (!has(row, key) || row[key] == null || row[key] === "") return;
          // 历史指标可能是带百分号/分隔符的字符串；保留原值，只检查兼容的基本类型。
          if (typeof row[key] !== "string" && !(typeof row[key] === "number" && Number.isFinite(row[key])))
            fail(`${name}的 ${key} 应为数字、字符串或空值`);
        });
      });
      if (duplicateFound) warnings.push(`${label}包含重复链接，可能来自续传；已完整保留这些更新记录`);
      return rows.filter(object);
    };

    let rows = [];
    if (!object(backup.library)) fail("缺少文章库 library 对象");
    else {
      checkOwner(backup.library, "文章库");
      rows = checkRows(backup.library.rows, "文章库 rows");
      ["doneBegin", "at", "restoreStopAtTs"].forEach((key) => {
        if (has(backup.library, key)) counter(backup.library[key], `文章库 ${key}`);
      });
    }
    let pendingRows = [];
    let pendingUpdates = [];
    if (!has(backup, "pending")) fail("缺少 pending 字段；没有未完成进度时应为 null");
    else if (backup.pending !== null) {
      const pending = backup.pending;
      if (!object(pending)) fail("未完成进度 pending 应为对象或 null");
      else {
        checkOwner(pending, "未完成进度");
        pendingRows = checkRows(pending.rows, "未完成进度 rows");
        if (has(pending, "fresh")) pendingUpdates = checkRows(pending.fresh, "未完成进度 fresh", true);
        if (has(pending, "kind") && pending.kind !== "list") fail("未完成进度 kind 不受支持");
        if (has(pending, "mode") && !["inc", "older", "full"].includes(pending.mode))
          fail("未完成进度 mode 不受支持");
        ["startBegin", "begin", "groups", "baseDoneBegin", "stopAtTs", "cutoffTs", "at"].forEach((key) => {
          if (has(pending, key)) counter(pending[key], `未完成进度 ${key}`);
        });
        if (has(pending, "completionReason") &&
            !["", "known", "cutoff", "end", "stopped", "limit"].includes(pending.completionReason))
          fail("未完成进度 completionReason 不受支持");
        if (has(pending, "stat")) {
          if (!object(pending.stat)) fail("未完成进度 stat 应为对象");
          else {
            ["pages", "deleted", "noUrl", "badItems", "total"].forEach((key) => {
              if (has(pending.stat, key)) counter(pending.stat[key], `未完成进度 stat.${key}`);
            });
            if (has(pending.stat, "reached") && typeof pending.stat.reached !== "string")
              fail("未完成进度 stat.reached 应为字符串");
          }
        }
        warnings.push("包含未完成抓取中已保存的记录");
      }
    }

    const dates = [];
    rows.forEach((row) => {
      const match = typeof row.发布日期 === "string" && /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(row.发布日期.trim());
      if (match) {
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3])) {
          dates.push(`${match[1]}/${pad(Number(match[2]))}/${pad(Number(match[3]))}`);
          return;
        }
      }
      if (numeric(row._ts) && Number(row._ts) > 0) {
        const date = new Date(Number(row._ts) * 1000);
        if (Number.isFinite(date.getTime()) && date.getFullYear() <= 9999) dates.push(fmtDate(date));
      }
    });
    dates.sort();
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      summary: {
        accountName: account && typeof account.name === "string" ? account.name : "",
        accountId: account && typeof account.id === "string" ? account.id : "",
        exportedAt: typeof backup.exportedAt === "string" ? backup.exportedAt : "",
        articleCount: rows.length,
        pendingCount: pendingRows.length,
        pendingUpdateCount: pendingUpdates.length,
        taggedCount: rows.filter((row) => Array.isArray(row._tags) && row._tags.length).length,
        detailCount: rows.filter((row) => row._detail === 1 || row._detail === true).length,
        earliest: dates[0] || "",
        latest: dates[dates.length - 1] || "",
        bytes: backupUtf8Bytes(serialized),
      },
    };
  }

  function createAccountBackup() {
    const account = { id: acct.id, name: acct.name, wxid: acct.wxid, known: acct.known };
    const sameAccount = () => acct.id === account.id && detectAccount().id === account.id;
    if (!sameAccount()) throw storageError("账号已切换，请等待面板切换账号后再备份");
    // 固定本次账号的两个键；不枚举其它账号，也不读取页面 token 或 cookie。
    const library = readStoredJson("mp_pub_lib::" + account.id, "文章库") || { rows: [], doneBegin: 0, at: 0 };
    const pending = readStoredJson("mp_pub_progress::" + account.id, "抓取进度");
    if (!sameAccount()) throw storageError("账号已切换，本次备份已停止，请重新备份");
    const backup = {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      scriptVersion: "3.5.44",
      exportedAt: new Date().toISOString(),
      account,
      library,
      pending,
    };
    const checked = validateBackup(backup, account.id);
    if (!checked.valid)
      throw storageError("备份未生成：" + checked.errors.slice(0, 3).join("；"));
    return backup;
  }

  function backupFileName(backup) {
    const account = backup && backup.account || {};
    const safe = (value) => String(value || "未识别账号")
      .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_")
      .replace(/[.\s]+$/g, "").slice(0, 60) || "未识别账号";
    const date = new Date(backup && backup.exportedAt);
    const time = Number.isFinite(date.getTime())
      ? `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
      : "时间未知";
    return `公众号完整备份-${safe(account.name)}-${safe(account.id)}-${time}.json`;
  }

  function articleLinkAllowed(link) {
    if (typeof link !== "string" || !link.trim()) return false;
    try {
      const url = new URL(link.trim());
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  }

  /**
   * 只读恢复预览：仅比较正式文章库，计算补入缺失文章后的结果。
   * 不读取存储；调用方提供同一时点的当前账号快照。返回值也不引用输入对象。
   */
  function planBackupRestore(input, currentSnapshot) {
    const sourceCheck = validateBackup(input);
    const currentCheck = validateBackup(currentSnapshot);
    const errors = [
      ...sourceCheck.errors.map((error) => `备份文件：${error}`),
      ...currentCheck.errors.map((error) => `当前文章库：${error}`),
    ];
    const pendingMessage = "包含未完成抓取中已保存的记录";
    const warnings = [
      ...sourceCheck.warnings.filter((message) => message !== pendingMessage).map((message) => `备份文件：${message}`),
      ...currentCheck.warnings.filter((message) => message !== pendingMessage).map((message) => `当前文章库：${message}`),
    ];
    const unavailable = () => ({ eligible: false, errors, warnings, summary: null, items: [] });
    if (errors.length) return unavailable();
    const clone = (value) => typeof value === "string"
      ? JSON.parse(value.replace(/^\uFEFF/, ""))
      : JSON.parse(JSON.stringify(value));
    let backup;
    let current;
    try {
      backup = clone(input);
      current = clone(currentSnapshot);
    } catch (_) {
      errors.push("备份内容无法读取，请重新选择文件并刷新当前文章库概况");
      return unavailable();
    }
    if (!backup.account.known || backup.account.id === "unknown")
      errors.push("备份中的账号未识别，暂不能预览恢复");
    if (!current.account.known || current.account.id === "unknown")
      errors.push("当前账号未识别，暂不能预览恢复");
    if (backup.account.id !== current.account.id)
      errors.push("备份账号与当前账号不同，不能预览跨账号恢复");
    if (errors.length) return unavailable();

    const currentRows = current.library.rows;
    const backupRows = backup.library.rows;
    const byLink = new Map(currentRows.map((row) => [row.链接.trim(), row]));
    const invalidAdditions = backupRows.filter((row) =>
      !byLink.has(row.链接.trim()) && !articleLinkAllowed(row.链接),
    );
    if (invalidAdditions.length) {
      errors.push(`备份中有 ${invalidAdditions.length} 篇新增文章的链接不是有效的 HTTP(S) 完整网址，已停止恢复预览`);
      return unavailable();
    }
    const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
    const hasDetail = (row) => !!row && (row._detail === 1 || row._detail === true);
    const tags = (row) => row && Array.isArray(row._tags) ? row._tags.slice() : [];
    const sameValue = (left, right) => {
      if (left === right) return true;
      if (left == null || right == null || typeof left !== "object" || typeof right !== "object") return false;
      if (Array.isArray(left) !== Array.isArray(right)) return false;
      if (Array.isArray(left))
        return left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      return leftKeys.length === rightKeys.length && leftKeys.every((key) => own(right, key) && sameValue(left[key], right[key]));
    };
    const sameField = (left, right, key) => {
      if (own(left, key) !== own(right, key)) return false;
      if (key === "_tags" && Array.isArray(left[key]) && Array.isArray(right[key]))
        return sameValue(left[key].slice().sort(), right[key].slice().sort());
      return sameValue(left[key], right[key]);
    };
    const detailFields = new Set([
      "收藏", "赞赏", "听全文", "阅读后关注人数", "_durSec", "_finishRatio",
      "_listenValue", "_listenSource", "_sendUv",
      "_detailVersion", "_collectionStatus",
    ]);
    const summary = {
      currentCount: currentRows.length,
      backupCount: backupRows.length,
      addCount: 0,
      existingCount: 0,
      changedCount: 0,
      unchangedCount: 0,
      tagDiffCount: 0,
      detailDiffCount: 0,
      pendingCount: sourceCheck.summary.pendingCount,
      pendingUpdateCount: sourceCheck.summary.pendingUpdateCount,
      resultCount: currentRows.length,
    };
    const items = backupRows.map((row) => {
      const link = row.链接.trim();
      const existing = byLink.get(link);
      const currentTags = tags(existing);
      const backupTags = tags(row);
      const item = {
        link,
        title: typeof row.标题 === "string" && row.标题 ? row.标题
          : existing && typeof existing.标题 === "string" && existing.标题 ? existing.标题 : "未命名文章",
        status: "add",
        currentTags,
        backupTags,
        currentHasDetail: hasDetail(existing),
        backupHasDetail: hasDetail(row),
        differences: [],
      };
      if (!existing) {
        summary.addCount++;
        return item;
      }
      summary.existingCount++;
      const fields = [...new Set([...Object.keys(existing), ...Object.keys(row)])].sort();
      item.differences = fields.filter((field) => !sameField(existing, row, field)).map((field) => ({
        field,
        current: own(existing, field) ? existing[field] : undefined,
        backup: own(row, field) ? row[field] : undefined,
      }));
      item.status = item.differences.length ? "different" : "same";
      if (item.differences.length) summary.changedCount++;
      else summary.unchangedCount++;
      if (!sameValue([...new Set(currentTags)].sort(), [...new Set(backupTags)].sort()))
        summary.tagDiffCount++;
      if (item.currentHasDetail !== item.backupHasDetail || item.differences.some(({ field }) =>
        field !== "_detail" && (detailFields.has(field) || field.startsWith("_d")),
      )) summary.detailDiffCount++;
      return item;
    });
    summary.resultCount += summary.addCount;
    if (backup.pending !== null)
      warnings.push(`备份中未完成抓取的 ${summary.pendingCount} 条文章记录和 ${summary.pendingUpdateCount} 条更新记录不纳入本次预览；当前抓取进度保持不变`);
    else if (current.pending !== null)
      warnings.push("当前未完成抓取进度保持不变");
    return { eligible: true, errors, warnings, summary, items };
  }

  // 对象键顺序不影响快照相等；数组顺序、字段缺失和具体值都参与比较。
  function restoreValueEqual(left, right) {
    if (left === right) return true;
    if (left == null || right == null || typeof left !== "object" || typeof right !== "object") return false;
    if (Array.isArray(left) !== Array.isArray(right)) return false;
    if (Array.isArray(left))
      return left.length === right.length && left.every((value, index) => restoreValueEqual(value, right[index]));
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) =>
      Object.prototype.hasOwnProperty.call(right, key) && restoreValueEqual(left[key], right[key]),
    );
  }

  function restoreSnapshotEqual(left, right) {
    return left.account.id === right.account.id && left.account.known === right.account.known &&
      restoreValueEqual(left.library, right.library) && restoreValueEqual(left.pending, right.pending);
  }

  /** 只读取当前账号最近一次恢复前副本，不迁移原数据，也不自动恢复。 */
  function readRestoreSafety() {
    const account = { id: acct.id, known: acct.known };
    const sameAccount = () => acct.id === account.id && acct.known === account.known &&
      detectAccount().id === account.id;
    if (!sameAccount()) throw storageError("账号已切换，请等待面板切换账号后再读取恢复前副本");
    const safety = readStoredJson("mp_pub_restore_safety::" + account.id, "恢复前副本");
    if (!sameAccount()) throw storageError("账号已切换，本次读取已停止，请重新读取恢复前副本");
    if (safety === null) return null;
    const checked = validateBackup(safety);
    if (!checked.valid)
      throw storageError("恢复前副本校验失败：" + checked.errors.slice(0, 3).join("；"));
    if (safety.account.id !== account.id || safety.account.known !== account.known)
      throw storageError("恢复前副本账号归属与当前账号不一致，已停止读取");
    return safety;
  }

  /**
   * 仅补回正式库中缺失的文章。先验证并读回恢复前副本，再写一次当前账号主库。
   * 存储接口不支持跨标签页事务；两次检查缩小冲突窗口，不能保证窗口内无其它写入。
   */
  function applyBackupRestore(input, expectedSnapshot) {
    let mainAttempted = false;
    try {
      if (running) throw storageError("抓取任务正在运行，请停止任务后重新预览恢复");
      const plan = planBackupRestore(input, expectedSnapshot);
      if (!plan.eligible) throw storageError("无法恢复：" + plan.errors.join("；"));
      const clone = (value) => typeof value === "string"
        ? JSON.parse(value.replace(/^\uFEFF/, ""))
        : JSON.parse(JSON.stringify(value));
      const backup = clone(input);
      const expected = clone(expectedSnapshot);
      const accountId = expected.account.id;
      const assertContext = () => {
        if (running) throw storageError("抓取任务正在运行，请停止任务后重新预览恢复");
        if (!acct.known || acct.id !== accountId || detectAccount().id !== accountId)
          throw storageError("账号已切换，请在当前账号重新预览恢复");
      };
      assertContext();
      const current = createAccountBackup();
      if (!restoreSnapshotEqual(current, expected))
        throw storageError("文章库或抓取进度已变化，请重新预览后再恢复");
      assertContext();
      if (!plan.summary.addCount) return { added: 0, total: current.library.rows.length };

      const links = new Set(current.library.rows.map((row) => row.链接.trim()));
      const additions = backup.library.rows.filter((row) => !links.has(row.链接.trim()));
      const timestamp = (row) => {
        const value = Number(row._ts);
        return Number.isFinite(value) ? value : 0;
      };
      const rows = current.library.rows.concat(additions)
        .map((row, index) => ({ row, index }))
        .sort((left, right) => timestamp(right.row) - timestamp(left.row) || left.index - right.index)
        .map(({ row }) => row);
      // 不使用 lib.write：它会规范化旧字段，并丢弃未识别的库元数据。
      const priorNewest = current.library.rows.length ? timestamp(current.library.rows[0]) : 0;
      const library = {
        ...current.library,
        rows,
        // 只承接当前库的恢复基线，不采用备份中的页码、进度或恢复标记。
        restoreStopAtTs: Object.prototype.hasOwnProperty.call(current.library, "restoreStopAtTs")
          ? current.library.restoreStopAtTs : Math.max(0, Math.floor(priorNewest)),
      };
      const safety = {
        ...current,
        restoreProtection: { sourceExportedAt: backup.exportedAt, addCount: additions.length },
      };
      const safetyKey = "mp_pub_restore_safety::" + accountId;
      requiredWrite(safetyKey, JSON.stringify(safety), "恢复前副本保存失败，文章库未修改，请稍后重试");
      const savedSafety = readStoredJson(safetyKey, "恢复前副本");
      if (!restoreValueEqual(savedSafety, safety))
        throw storageError("恢复前副本写入后校验失败，文章库未修改，请稍后重试");

      // 保护副本落盘期间，其它标签页仍可能改库；执行主库写入前必须再读一次。
      assertContext();
      const latest = createAccountBackup();
      if (!restoreSnapshotEqual(latest, expected))
        throw storageError("文章库或抓取进度已变化，文章库未修改，请重新预览后再恢复");
      assertContext();
      const key = "mp_pub_lib::" + accountId;
      mainAttempted = true;
      requiredWrite(key, JSON.stringify(library), "恢复写入未确认");
      const savedLibrary = readStoredJson(key, "恢复后的文章库");
      if (!restoreValueEqual(savedLibrary, library)) throw storageError("恢复后的文章库读回校验不一致");
      assertContext();
      return { added: additions.length, total: rows.length };
    } catch (error) {
      if (mainAttempted) {
        // 写入后不自动回滚，避免用旧副本覆盖其它标签页刚保存的新数据。
        const uncertain = storageError("恢复结果未确认，恢复前副本已保留，请检查并重新预览");
        uncertain.restoreUncertain = true;
        throw uncertain;
      }
      if (error && error.name === "StorageError") throw error;
      throw storageError("恢复未执行：" + String(error && error.message || error));
    }
  }

  /* ==========================================================================
   * 8. 导出
   * ========================================================================== */
  function headerFor() {
    return activeSchema().map(headerName);
  }

  function toTSV(rows) {
    const sc = activeSchema();
    return [sc.map(headerName).join("\t")]
      .concat(
        rows.map((r) =>
          sc.map((c) => cellOf(r, c).replace(/[\t\r\n]/g, " ")).join("\t"),
        ),
      )
      .join("\n");
  }

  function toCSV(rows) {
    const sc = activeSchema();
    const q = (v) => {
      const s = cell(v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return (
      "﻿" +
      [sc.map((c) => q(headerName(c))).join(",")]
        .concat(rows.map((r) => sc.map((c) => q(cellOf(r, c))).join(",")))
        .join("\r\n")
    );
  }

  function download(name, text, mime) {
    const blob = new Blob([text], {
      type: (mime || "text/plain") + ";charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
  }

  function copyText(text) {
    if (typeof GM_setClipboardText === "function") {
      try {
        GM_setClipboardText(text);
        return Promise.resolve(true);
      } catch (e) {
        /* next */
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard
        .writeText(text)
        .then(() => true)
        .catch(() => legacyCopy(text));
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:0;";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  /* ==========================================================================
   * 9. 面板
   * ========================================================================== */
  // 油猴脚本需要单文件安装，所以把 wechat-list.svg 的图形内联在收起按钮里。
  // 玻璃质感由按钮背板负责，前景图形保持清晰。
  const LAUNCHER_ICON = `
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="mp-mini-sheet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".98"/>
          <stop offset="1" stop-color="#D8FFE9" stop-opacity=".9"/>
        </linearGradient>
        <linearGradient id="mp-mini-bubble" x1=".08" y1="0" x2=".9" y2="1">
          <stop offset="0" stop-color="#34D984"/>
          <stop offset=".52" stop-color="#07C160"/>
          <stop offset="1" stop-color="#04A850"/>
        </linearGradient>
        <filter id="mp-mini-shadow" x="-40%" y="-40%" width="180%" height="190%">
          <feDropShadow dx="0" dy=".8" stdDeviation=".8" flood-color="#087D41" flood-opacity=".2"/>
        </filter>
      </defs>
      <rect x="6.5" y="7.5" width="39" height="46" rx="10" fill="url(#mp-mini-sheet)" stroke="#07C160" stroke-width="2.5"/>
      <path d="M11 18c0-4 2.5-6.5 6.5-6.5H35" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="2.5" opacity=".9"/>
      <g fill="#07C160">
        <rect x="13" y="19.5" width="5" height="5" rx="1.5"/>
        <rect x="13" y="29" width="5" height="5" rx="1.5"/>
        <rect x="13" y="38.5" width="5" height="5" rx="1.5"/>
      </g>
      <g fill="none" stroke="#07C160" stroke-linecap="round" stroke-width="2.8">
        <path d="M22 22h14M22 31.5h12M22 41h8"/>
      </g>
      <g transform="translate(-2.5 1) scale(2.5)">
        <path d="M16.938 8.858c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03z"
          fill="url(#mp-mini-bubble)" stroke="#fff" stroke-linejoin="round" stroke-width="1" filter="url(#mp-mini-shadow)"/>
        <g fill="#fff">
          <path d="M14.408 12.132c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z"/>
          <path d="M19.252 12.132c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
        </g>
      </g>
    </svg>`;

  const CSS = `
    :host { all: initial; }
    .wrap { position:fixed; right:20px; bottom:20px; z-index:2147483600; box-sizing:border-box;
      width:min(360px, calc(100vw - 24px));
      font:13px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif; color:#1f2329;
      background:#fff; border:1px solid #e3e5e8; border-radius:16px;
      box-shadow:0 14px 38px rgba(20,41,31,.16),0 2px 8px rgba(20,41,31,.06); overflow:hidden; }
    .hd { display:flex; align-items:center; gap:8px; padding:10px 12px; background:#07c160; color:#fff;
      cursor:move; user-select:none; touch-action:none; }
    .hd-account { display:flex; align-items:center; gap:6px; flex:1; min-width:0; }
    .hd b { font-size:13px; font-weight:600; flex:0 1 auto; min-width:0;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .hd button { all:unset; flex:none; cursor:pointer; padding:0 6px; font-size:15px; line-height:1; opacity:.9; }
    .hd button:hover { opacity:1; }
    .bd { box-sizing:border-box; padding:12px;
      height:max(0px, min(470px, calc(80vh - 40px), calc(100vh - 182px)));
      overflow-y:auto; scrollbar-gutter:stable; }
    .bd.cols-active, .bd.rows-active { display:flex; flex-direction:column; }
    .bd.cols-active #mp-panel-cols { display:flex; flex:1; flex-direction:column; min-height:0; }
    .wrap.is-morphing .bd.cols-active, .wrap.is-morphing .bd.rows-active { display:flex; }
    .wrap button:focus-visible { outline:2px solid #07C160; outline-offset:3px; }
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
      background:linear-gradient(145deg,rgba(255,255,255,.89),rgba(230,255,242,.66) 58%,rgba(215,253,231,.68));
      box-shadow:inset 0 1px 1px rgba(255,255,255,.98),inset 0 -1px 2px rgba(7,193,96,.12),
        0 12px 30px rgba(0,66,34,.19),0 2px 6px rgba(0,45,25,.08);
      -webkit-backdrop-filter:blur(18px) saturate(180%);
      backdrop-filter:blur(18px) saturate(180%);
      -webkit-tap-highlight-color:transparent;
      transition:transform .24s cubic-bezier(.2,.8,.2,1),box-shadow .24s ease; }
    .launcher::before { content:""; position:absolute; inset:1px; border-radius:21px;
      background:linear-gradient(145deg,rgba(255,255,255,.85),transparent 43%,rgba(255,255,255,.15) 80%);
      pointer-events:none; }
    .launcher::after { content:""; position:absolute; inset:1px; border-radius:21px;
      box-shadow:inset 1px 1px 0 rgba(255,255,255,.9),inset -1px -1px 0 rgba(7,193,96,.2);
      pointer-events:none; }
    .launcher svg { width:54px; height:54px; position:relative; z-index:1;
      transition:transform .24s cubic-bezier(.2,.8,.2,1); }
    .wrap.is-collapsed .launcher:hover { transform:translateY(-2px) scale(1.03);
      box-shadow:inset 0 1px 1px rgba(255,255,255,.98),0 16px 34px rgba(0,84,42,.24),
        0 3px 9px rgba(0,45,25,.1); }
    .launcher:hover svg { transform:translateY(-1px); }
    .wrap.is-collapsed .launcher:active { transform:scale(.96); }
    .wrap.is-collapsed .launcher:focus-visible { outline:3px solid #07C160; outline-offset:4px; }
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
    .imp { margin:0 0 9px; padding:9px; border:1px solid #dcebe2;
      border-radius:8px; background:#fbfefc; }
    .imp-heading { margin:0 0 7px; font-size:11.5px; font-weight:600; color:#456b54; }
    .imp textarea { width:100%; box-sizing:border-box; height:96px; resize:vertical;
      padding:6px 8px; border:1px solid #dee0e3; border-radius:5px;
      font:11px/1.5 ui-monospace,Menlo,Consolas,monospace; color:#1f2329; }
    .imp textarea:focus { outline:none; border-color:#07c160; }
    .improw { display:flex; align-items:center; gap:6px; margin:6px 0; font-size:11px; color:#8f959e; }
    .improw input[type=file] { flex:1; min-width:0; font-size:10.5px; color:#646a73; }
    /* 导入方式是「选项」，不能长得像动作按钮 ——
       之前选中态用了和主按钮一样的满绿，结果被当成「要点的那个」。 */
    .improw .rmode { display:inline-flex; align-items:center; gap:4px; cursor:pointer;
      font-size:11px; color:#646a73; }
    .improw .rmode input { margin:0; width:12px; height:12px; accent-color:#07c160; cursor:pointer; }
    .impprev { margin:6px 0; padding:7px 8px; border-radius:5px; font-size:10.5px; line-height:1.7;
      background:#f7f8fa; border:1px solid #eef0f2; color:#646a73; max-height:110px; overflow:auto; }
    .impprev.err { background:#fff1f0; border-color:#ffd6d3; color:#c9302c; }
    .impprev b { color:#07c160; font-weight:600; }
    .impprev .warn { color:#d9a03c; }

    .tabs { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); grid-auto-rows:54px; gap:5px;
      padding:8px 10px; background:#f8faf9; border-bottom:1px solid #e7ebe9; }
    .tabs button { all:unset; box-sizing:border-box; min-width:0; height:54px; cursor:pointer;
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px;
      border:1px solid #e7ebe9; border-radius:10px; background:#fff;
      font-size:11px; line-height:1.2; color:#58665e;
      transition:background .18s ease,color .18s ease,box-shadow .18s ease; }
    .tabs button svg { width:20px; height:20px; flex:none; fill:none; stroke:currentColor;
      stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .tabs button .tab-label { white-space:nowrap; }
    .tabs button:hover:not(.on) { background:#f2fbf5; color:#245f40; }
    .tabs button.on { color:#067f42; border-color:#bce8cf; font-weight:600;
      box-shadow:0 2px 8px rgba(32,64,48,.09); }
    .tabs button.on svg { stroke:#07c160; }
    .tabs button:focus-visible { outline:2px solid #07c160; outline-offset:2px; }
    @media (prefers-reduced-motion: reduce) { .tabs button { transition:none; } }
    .view.hide { display:none; }

    .warnbar { padding:7px 9px; margin:0 0 10px; background:#fff8e6; border:1px solid #ffe1a8;
      border-radius:6px; font-size:11px; color:#8a6d3b; line-height:1.6; }
    .warnbar button { all:unset; cursor:pointer; font-size:11px; color:#8a6d3b;
      border:1px solid #e8c98a; border-radius:9px; padding:2px 9px; margin-right:6px; }
    .warnbar button:hover { border-color:#07c160; color:#07c160; }
    .acct { display:flex; align-items:center; gap:5px; margin:0 0 8px; font-size:11px; color:#646a73; }
    .acct .unknown { color:#d9a03c; }

    .modes { display:flex; gap:4px; margin:0 0 8px; }
    .modes button { all:unset; flex:1; box-sizing:border-box; text-align:center; cursor:pointer;
      padding:6px 2px; font-size:11.5px; color:#646a73; border:1px solid #dee0e3; border-radius:6px; }
    .modes button:hover { border-color:#07c160; }
    .modes button.on { background:#07c160; border-color:#07c160; color:#fff; }

    input[type=date],input[type=number] { box-sizing:border-box; padding:5px 7px; border:1px solid #dee0e3;
      border-radius:5px; font:inherit; font-size:12px; }
    input[type=date] { width:100%; }
    input[type=number] { width:64px; }
    input:focus { outline:none; border-color:#07c160; }
    .grab-date-line { display:flex; align-items:center; gap:8px; font-size:11.5px; color:#646a73; }
    .grab-date-line span { flex:none; }
    .grab-date-line input[type=date] { flex:1; min-width:0; width:auto; }
    .quick { display:flex; gap:6px; margin:6px 0 10px; }
    .quick button { all:unset; cursor:pointer; font-size:11px; color:#8f959e; padding:2px 7px;
      border:1px solid #dee0e3; border-radius:9px; }
    .quick button:hover { border-color:#07c160; color:#07c160; }

    .grab-switch { position:relative; display:grid; grid-template-columns:1fr 1fr; gap:0;
      box-sizing:border-box; padding:3px; margin:0 0 14px; border:1px solid #dce9df;
      border-radius:11px; background:#edf4ef; isolation:isolate; }
    .grab-switch::before { content:""; position:absolute; top:3px; bottom:3px; left:3px;
      width:calc(50% - 3px); border-radius:8px; background:#fff;
      box-shadow:0 2px 6px rgba(20,53,35,.12),inset 0 1px rgba(255,255,255,.95);
      pointer-events:none; transition:transform .24s cubic-bezier(.2,.75,.25,1); }
    .grab-switch[data-view="detail"]::before { transform:translateX(100%); }
    .grab-switch button { all:unset; position:relative; z-index:1; box-sizing:border-box;
      padding:8px 4px; text-align:center; font-size:12px; color:#627068; cursor:pointer;
      transition:color .24s ease; }
    .grab-switch button[aria-selected="true"] { color:#067f42; font-weight:600; }
    .grab-switch button:focus-visible { outline:2px solid #07c160; outline-offset:3px; border-radius:8px; }
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
    .detail-setting select:focus { outline:none; border-color:#07c160; }

    .resume { display:flex; align-items:center; gap:8px; margin:0 0 10px; padding:7px 9px;
      background:#fff8e6; border:1px solid #ffe1a8; border-radius:6px; font-size:11px; color:#8a6d3b; }
    .resume span { flex:1; }
    .resume button { all:unset; cursor:pointer; text-decoration:underline; flex:none; color:#8a6d3b; }
    .resume button:hover { color:#07c160; }

    .cols { margin:2px 0 8px; max-height:40vh; overflow:auto; }
    .cols-active .cols { flex:1; min-height:0; max-height:none; }
    .crow { display:flex; align-items:center; gap:6px; padding:5px 4px;
      border-bottom:1px solid #f2f3f5; font-size:12px; background:#fff; }
    .crow.calc { background:#f7fbf8; }
    .crow.drag { opacity:.45; }
    .grip { cursor:grab; color:#c9cdd4; font-size:12px; line-height:1; user-select:none;
      padding:2px 1px; letter-spacing:-1px; }
    .grip:active { cursor:grabbing; }
    .crow.calc .grip { color:#9ad9b6; }
    .ck { margin:0; width:13px; height:13px; flex:none; cursor:pointer; accent-color:#07c160; }
    .cn { flex:1; color:#646a73; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .crow.calc .cn, .crow.calc .cv { color:#07c160; }
    .crow.off .cn, .crow.off .cv { color:#c9cdd4; }
    .cv { max-width:42%; text-align:right; font-weight:600; font-variant-numeric:tabular-nums;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .cv.miss { color:#d33; font-weight:400; }
    .cn .tag { font-size:9.5px; color:#c9cdd4; margin-left:3px; }
    .chip { all:unset; cursor:pointer; flex:none; font-size:10px; line-height:1;
      padding:2px 5px; border-radius:9px; border:1px solid #dee0e3; color:#8f959e; background:#fff; }
    .chip:hover { border-color:#07c160; color:#07c160; }
    .crow.calc .chip { border-color:#9ad9b6; color:#07c160; }
    .sub { padding:7px 8px 8px 26px; background:#f7fbf8; border-bottom:1px solid #f2f3f5; }
    .sub .h { font-size:10.5px; color:#8f959e; margin-bottom:5px; }
    .sub .ops { display:flex; flex-wrap:wrap; gap:4px 10px; }
    .sub label { display:inline-flex; align-items:center; gap:4px; font-size:11.5px; color:#646a73; cursor:pointer; }
    .sub input { margin:0; width:12px; height:12px; accent-color:#07c160; cursor:pointer; }

    .cbar { display:flex; align-items:center; gap:8px; font-size:11px; color:#8f959e; margin:0 0 7px; }
    .cbar b { font-weight:600; color:#646a73; }
    .cbar button, .pacts button { all:unset; cursor:pointer; color:#8f959e; text-decoration:underline; }
    .cbar button:hover, .pacts button:hover { color:#07c160; }
    .selection-bar [data-selinfo] { flex:1; min-width:0; }
    .selection-bar .icon-action { all:unset; box-sizing:border-box; display:grid; place-items:center;
      flex:none; width:26px; height:26px; border:1px solid #e1e7e3; border-radius:6px;
      background:#fff; color:#68766e; cursor:pointer; }
    .selection-bar .icon-action:hover { border-color:#07c160; color:#07c160; background:#f2fbf5; }
    .selection-bar .icon-action:focus-visible { outline:2px solid #07c160; outline-offset:2px; }
    .selection-bar .icon-action svg { width:16px; height:16px; fill:none; stroke:currentColor;
      stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .tag-actions { display:flex; align-items:center; gap:6px; margin:6px 0 8px; }
    .tag-actions button { all:unset; box-sizing:border-box; display:flex; align-items:center;
      justify-content:center; height:36px; border:1px solid #dee0e3; border-radius:6px;
      background:#fff; color:#596860; cursor:pointer; }
    .tag-actions button:hover { border-color:#07c160; color:#078c49; background:#f4fcf7; }
    .tag-actions button:focus-visible { outline:2px solid #07c160; outline-offset:2px; }
    .tag-actions button[disabled], .tag-actions button[disabled]:hover {
      background:#f7f8fa; color:#c9cdd4; border-color:#eef0f2; cursor:default; }
    .tag-actions svg { width:18px; height:18px; flex:none; fill:none; stroke:currentColor;
      stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .tag-actions .tag-edit { flex:1; min-width:0; gap:6px; font-size:12px; }
    .tag-actions .tag-divider { flex:none; width:1px; height:24px; margin:0 2px;
      background:#e3ebe6; }
    .tag-actions .tag-icon { flex:none; width:36px; }
    .tag-actions .tag-icon[aria-expanded="true"] { border-color:#aee1c2;
      background:#eaf9f0; color:#078c49; }
    .template-footer { display:flex; align-items:center; gap:7px; flex:none; padding-top:8px;
      border-top:1px solid #edf0ee; background:#fff; }
    .pbar { display:flex; align-items:center; gap:6px; flex:1; min-width:0;
      font-size:11px; color:#8f959e; margin:0; }
    .pbar span { flex:none; }
    .pbar select { flex:1; min-width:0; font:inherit; font-size:11px; color:#1f2329; background:#fff;
      border:1px solid #dee0e3; border-radius:5px; padding:3px 4px; cursor:pointer; }
    .pbar select:focus { outline:none; border-color:#07c160; }
    .pacts { display:flex; align-items:center; gap:5px; flex:none; font-size:11px; margin:0; }
    .pacts button { box-sizing:border-box; flex:none; padding:4px 2px; border-radius:4px;
      color:#596860; text-decoration:none; white-space:nowrap; }
    .pacts button:hover { background:#f2fbf5; }
    .pacts button[disabled], .pacts button[disabled]:hover {
      color:#dee0e3; background:transparent; cursor:default; text-decoration:none; }
    .pacts button.hot { color:#07c160; font-weight:600; }
    @media (max-width:319px) {
      .template-footer { flex-wrap:wrap; gap:4px; }
      .template-footer .pbar, .template-footer .pacts { width:100%; }
      .template-footer .pacts { justify-content:space-between; }
    }

    .btns { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
    .btns button { all:unset; box-sizing:border-box; text-align:center; cursor:pointer; padding:7px 4px;
      border-radius:6px; font-size:12px; border:1px solid #dee0e3; background:#fff; }
    .btns button:hover { border-color:#07c160; color:#07c160; }
    .btns button.p { background:#07c160; border-color:#07c160; color:#fff; }
    .btns button.p:hover { background:#06ad56; color:#fff; }
    /* 禁用态必须一眼看出来。注意要连 background 一起改 ——
       主按钮 .p 的绿底和这条规则同优先级，只改文字颜色的话按钮看着还是能点的。 */
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
      box-shadow:inset 0 2px 5px rgba(11,60,32,.14); }
    .btns button.mp-confirmed, .tag-actions button.mp-confirmed {
      border-color:#aee1c2; background:#eaf9f0; color:#078c49; }
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
      padding:4px 10px; border-top:1px solid #e8efeb; background:#f9fcfa;
      font-size:11px; line-height:1.35; color:#64766b; }
    .st.empty { border-top-color:transparent; background:#fff; }
    .st-icon { display:grid; place-items:center; flex:none; width:17px; height:17px;
      border-radius:50%; font-size:11px; font-weight:700; background:#e8f1eb; color:#5d7668; }
    .st.ok .st-icon { background:#e5f8ed; color:#079c4f; }
    .st.err .st-icon { background:#fff0ee; color:#c7433d; }
    .st.warn .st-icon { background:#fff4df; color:#a9731b; }
    .st.progress .st-icon { box-sizing:border-box; border:2px solid #c6ead5;
      border-top-color:#07c160; background:transparent; animation:mp-st-spin .8s linear infinite; }
    @keyframes mp-st-spin { to { transform:rotate(360deg); } }
    .st-copy { flex:1; min-width:0; display:-webkit-box; -webkit-box-orient:vertical;
      -webkit-line-clamp:2; overflow:hidden; overflow-wrap:anywhere; }
    .st-dismiss { all:unset; flex:none; width:19px; height:19px; display:grid; place-items:center;
      border-radius:5px; cursor:pointer; font-size:16px; line-height:1; color:#7d8982; }
    .st-dismiss:hover { background:#edf3ef; color:#263e30; }
    .st:not(.dismissible) .st-dismiss { display:none; }
    .st.empty .st-icon, .st.empty .st-copy { visibility:hidden; }
    @media (prefers-reduced-motion: reduce) { .st.progress .st-icon { animation:none; } }
    .filt { display:flex; gap:5px; margin:0 0 8px; }
    .filt input[type=search] { flex:1; min-width:0; box-sizing:border-box; padding:5px 7px;
      border:1px solid #dee0e3; border-radius:5px; font:inherit; font-size:11.5px; }
    .filt input[type=search]:focus { outline:none; border-color:#07c160; }
    .filt .tag-filter-button { all:unset; box-sizing:border-box; display:flex; align-items:center;
      justify-content:space-between; gap:6px; flex:none; min-width:88px; max-width:145px;
      padding:5px 7px; border:1px solid #dee0e3; border-radius:6px; background:#fff;
      color:#1f2329; font-size:11px; cursor:pointer; }
    .tag-filter-button span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .tag-filter-button svg { flex:none; width:15px; height:15px; fill:none; stroke:currentColor;
      stroke-width:1.8; stroke-linecap:round; }
    .filt .tag-filter-button:hover, .filt .tag-filter-button.active,
    .filt .tag-filter-button[aria-expanded=true] { border-color:#9bdcb8; color:#078c49; background:#f2fbf5; }
    .tag-filter-panel { margin:-2px 0 9px; padding:9px; border:1px solid #dcebe2;
      border-radius:8px; background:#fbfefc; font-size:11px; }
    .tag-filter-panel[hidden] { display:none; }
    .tag-filter-search { box-sizing:border-box; width:100%; padding:6px 8px; border:1px solid #dee0e3;
      border-radius:5px; background:#fff; color:#1f2329; font:inherit; }
    .tag-filter-search:focus { outline:2px solid #07c160; outline-offset:1px; }
    .tag-detail-options { display:flex; flex-wrap:wrap; gap:8px; margin:8px 0; }
    .tag-detail-options label, .tag-option { display:flex; align-items:center; gap:6px; cursor:pointer; }
    .tag-filter-panel input[type=checkbox], .tag-filter-panel input[type=radio] {
      flex:none; margin:0; accent-color:#07c160; }
    .tag-option { padding:5px 4px; border-radius:4px; }
    .tag-option span { min-width:0; overflow-wrap:anywhere; }
    .tag-option:hover, .tag-option:focus-within { background:#eaf8ef; }
    .tag-filter-caption { display:flex; justify-content:space-between; gap:8px;
      margin:6px 0 3px; padding-top:7px; border-top:1px solid #e2ece5; color:#718079; font-size:10.5px; }
    .tag-options { max-height:min(180px, 25vh); overflow:auto; overscroll-behavior:contain; }
    .tag-empty { padding:12px 4px; color:#8a9690; }
    .tag-filter-actions { display:flex; justify-content:flex-end; gap:7px; margin-top:8px; }
    .tag-filter-actions button { all:unset; cursor:pointer; padding:5px 12px; border:1px solid #d4e2d9;
      border-radius:5px; background:#fff; color:#496653; }
    .tag-filter-actions button:hover { border-color:#07c160; color:#078c49; }
    .filt .date-filter-button { all:unset; box-sizing:border-box; position:relative;
      display:grid; place-items:center; flex:none; width:32px; min-height:31px;
      border:1px solid #dee0e3; border-radius:6px; background:#fff;
      color:#68766e; cursor:pointer; }
    .filt .date-filter-button:hover, .filt .date-filter-button.active {
      border-color:#9bdcb8; color:#078c49; background:#f2fbf5; }
    .filt .date-filter-button svg { width:18px; height:18px; fill:none; stroke:currentColor;
      stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .filt .date-filter-button.active::after { content:""; position:absolute; top:3px; right:3px;
      width:5px; height:5px; border-radius:50%; background:#07c160; }
    .date-filter-panel { margin:-2px 0 9px; padding:9px; border:1px solid #dcebe2;
      border-radius:8px; background:#fbfefc; }
    .date-filter-panel[hidden], .date-filter-error[hidden], .selection-hint[hidden] { display:none; }
    .date-filter-fields { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .date-filter-field { display:flex; flex-direction:column; gap:3px; min-width:0;
      font-size:11px; color:#64766b; }
    .date-filter-inputs { box-sizing:border-box; position:relative; display:flex; align-items:center;
      justify-content:center; gap:1px; min-width:0; min-height:31px; padding:5px 4px;
      border:1px solid #dee0e3; border-radius:5px; background:#fff; }
    .date-filter-inputs:focus-within { border-color:#07c160; }
    .date-filter-inputs input[data-date-part] { all:unset; box-sizing:border-box; flex:none; min-width:0;
      padding:0; text-align:center; font:inherit; font-size:11px; color:#1f2329;
      font-variant-numeric:tabular-nums; }
    .date-filter-inputs input[data-date-part=year] { width:4.5ch; }
    .date-filter-inputs input[data-date-part=month],
    .date-filter-inputs input[data-date-part=day] { width:2.2em; }
    .date-filter-inputs input[data-date-part]:focus { border-radius:2px; background:#eefaf2; }
    .date-filter-inputs input[data-date-part]::placeholder { color:#a8abb2; opacity:1; }
    .date-filter-inputs .date-separator { flex:none; color:#87958c; }
    .date-filter-inputs .date-picker-button { all:unset; box-sizing:border-box; flex:none;
      display:grid; place-items:center; width:20px; height:20px; margin-left:auto;
      border-radius:4px; color:#79897f; cursor:pointer; }
    .date-filter-inputs .date-picker-button:hover { background:#edf8f0; color:#078c49; }
    .date-filter-inputs .date-picker-button svg { width:15px; height:15px; fill:none;
      stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .date-filter-inputs .date-native-picker { position:absolute; right:0; bottom:0;
      width:1px; height:1px; padding:0; opacity:0; pointer-events:none; }
    .date-filter-error { margin-top:6px; font-size:10.5px; color:#c7433d; }
    .date-filter-actions { display:flex; justify-content:flex-end; gap:6px; margin-top:8px; }
    .date-filter-actions button { all:unset; box-sizing:border-box; min-width:64px;
      padding:5px 10px; border:1px solid #dce6df; border-radius:6px;
      background:#fff; color:#596860; cursor:pointer; text-align:center; font-size:11px; }
    .date-filter-actions button:hover { border-color:#07c160; color:#078c49; }
    .date-filter-actions button.p { border-color:#07c160; background:#07c160; color:#fff; }
    .date-filter-actions button.p:hover { background:#06ad56; color:#fff; }
    .selection-hint { margin:-2px 0 7px; padding:5px 7px; border-radius:6px;
      background:#fff8e6; color:#8a6d3b; font-size:10.5px; line-height:1.45; }
    @media (max-width:319px) { .date-filter-fields { grid-template-columns:1fr; } }

    .bd.rows-active { overflow:clip; scrollbar-gutter:auto; }
    .rows-active #mp-panel-rows { flex:1; min-height:0; display:grid;
      grid-template-columns:minmax(0,1fr);
      grid-template-rows:auto auto auto minmax(0,1fr) auto auto auto; }
    #mp-panel-rows > .filt { grid-row:1; }
    #mp-panel-rows > .selection-bar { grid-row:2; }
    #mp-panel-rows > .selection-hint { grid-row:3; }
    #mp-panel-rows > .list, #mp-panel-rows > .rows-tool {
      grid-area:4 / 1; min-height:0; overflow:auto; overscroll-behavior:contain; }
    #mp-panel-rows > .rows-tool { margin:0; }
    /* 工具和列表共用同一格。保留列表尺寸，筛选时仍可正确重置虚拟列表位置。 */
    #mp-panel-rows:has(> .rows-tool:not([hidden])) > .list { visibility:hidden; }
    #mp-panel-rows > .rows-refresh { grid-row:5; margin-top:8px; }
    #mp-panel-rows > .tag-actions { grid-row:6; }
    #mp-panel-rows > .rows-export { grid-row:7; margin-top:10px; }
    /* 选择标签时保留搜索及完成按钮，选项占用中间的可用空间。 */
    .rows-active .tag-filter-panel:not([hidden]) { display:flex; flex-direction:column;
      container:tag-filter / size; }
    .tag-filter-panel > * { flex:none; }
    .rows-active .tag-options { flex:0 1 auto; min-height:28px; max-height:none; }
    @container tag-filter (max-height:190px) {
      .rows-active .tag-options { flex:none; overflow:visible; }
    }
    .rows-tool .impprev, .rows-tool .backup-result { max-height:none; overflow:visible; }
    @media (max-height:500px) {
      .wrap:has(.rows-active) .hd { padding:3px 8px; }
      .wrap:has(.rows-active) .tabs { grid-auto-rows:26px; padding:3px 8px; }
      .wrap:has(.rows-active) .tabs button { height:26px; flex-direction:row; }
      .wrap:has(.rows-active) .st { height:32px; }
      .bd.rows-active { height:max(0px,calc(100vh - 122px)); padding:5px 8px; }
      #mp-panel-rows > .filt, #mp-panel-rows > .selection-bar { margin-bottom:3px; }
      #mp-panel-rows .tag-actions { margin:3px 0; }
      #mp-panel-rows .tag-actions button { height:25px; }
      #mp-panel-rows > .rows-refresh, #mp-panel-rows > .rows-export { margin-top:2px; }
      #mp-panel-rows > .btns button { padding:2px; }
    }
    .it { display:flex; gap:6px; align-items:center; box-sizing:border-box; height:32px;
      padding:5px 2px;
      border-bottom:1px solid #f7f8fa; font-size:11.5px; }
    .it.new { background:#f2fbf5; }
    .it.sel { background:#eef7ff; }
    .it input.rk { margin:0; width:13px; height:13px; flex:none; cursor:pointer; accent-color:#07c160; }
    .it .d { color:#a8abb2; flex:none; font-variant-numeric:tabular-nums; }
    .it .t { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      color:#1f2329; cursor:pointer; }
    .it .t:hover { color:#07c160; text-decoration:underline; }
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
    .data-manager { margin:0 0 12px; padding:10px; border:1px solid #dcebe2;
      border-radius:9px; background:#fbfefc; font-size:11px; }
    .data-heading { margin:0 0 7px; font-size:13px; color:#365b45; }
    .data-manager[hidden], .backup-result[hidden] { display:none; }
    .backup-account { font-weight:600; color:#365b45; overflow-wrap:anywhere; }
    .backup-summary { margin:5px 0 8px; color:#64736b; white-space:pre-line; line-height:1.7; }
    .backup-note { margin:6px 0 8px; color:#8a6d3b; font-size:10.5px; }
    .backup-note:empty { display:none; }
    .backup-actions { display:grid; grid-template-columns:1fr; gap:7px; }
    .backup-file-actions { grid-template-columns:repeat(2, minmax(0, 1fr)); }
    .backup-actions button { all:unset; box-sizing:border-box; text-align:center; cursor:pointer;
      padding:7px 9px; border:1px solid #d4e2d9; border-radius:6px; background:#fff; color:#496653; }
    .backup-actions button:hover { border-color:#07c160; color:#078c49; }
    .backup-actions button.p { border-color:#07c160; background:#07c160; color:#fff; }
    .backup-actions button.p:hover { background:#06ad56; }
    .backup-actions button[hidden], .restore-preview[hidden] { display:none; }
    .backup-actions button:disabled { opacity:.5; cursor:not-allowed; }
    .backup-result { margin-top:9px; padding:8px; border:1px solid #dcebe2; border-radius:6px;
      background:#f0faf4; color:#326449; white-space:pre-line; overflow-wrap:anywhere;
      max-height:190px; overflow:auto; font-size:10.5px; }
    .backup-result.bad { background:#fff1f0; color:#ac3e38; border-color:#f0d0cb; }
    .backup-result.warn { background:#fff8e6; color:#8a6d3b; border-color:#f2dfb7; }
    .restore-preview { margin-top:10px; padding-top:9px; border-top:1px solid #dcebe2; }
    .restore-heading { margin:0 0 5px; font-size:12px; color:#365b45; }
    .restore-summary { white-space:pre-line; line-height:1.7; }
    .restore-note { margin:7px 0; color:#747d76; font-size:10.5px; line-height:1.65; white-space:pre-line; }
    .restore-filter { display:block; margin:9px 0; }
    .restore-filter select { box-sizing:border-box; width:100%; margin-top:4px; padding:6px;
      color:#496653; background:#fff; border:1px solid #d4e2d9; border-radius:5px; }
    .restore-item { margin:6px 0; border:1px solid #e2e9e4; border-radius:6px; padding:7px; background:#fff; }
    .restore-item summary { cursor:pointer; overflow-wrap:anywhere; line-height:1.6; }
    .restore-item summary strong { display:block; color:#365b45; }
    .restore-item p { margin:6px 0; white-space:pre-wrap; overflow-wrap:anywhere; }
    .restore-diff { border-top:1px dashed #e2e9e4; padding-top:5px; }
    .restore-link { font-size:10px; color:#89938c; }
    .restore-pager { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:8px; }
    .restore-pager button { border:1px solid #d4e2d9; background:white; border-radius:5px; padding:4px 8px; cursor:pointer; }
    .restore-pager button:disabled { opacity:.4; cursor:not-allowed; }
    .restore-safety { margin-top:9px; padding:8px; border:1px solid #dcebe2; border-radius:6px; }
    .restore-safety[hidden] { display:none; }
    .restore-safety p { margin:0 0 7px; font-size:10.5px; color:#64736b; white-space:pre-line; }
  `;

  let ui = null;
  let mode = "inc";
  let grabView =
    rawRead(UI_GRAB_VIEW_KEY, "list") === "detail" ? "detail" : "list";
  let running = false;
  let activeRun = "";
  let accountEpoch = 0;
  let dragLock = false;
  let sumOpen = false;
  let fresh = new Set();
  let sel = new Set(); // 勾选的文章（按链接），只在本次会话内有效
  let impMode = "merge"; // 标签导入：merge 追加 / replace 覆盖
  let impPlan = null; // 预览算出来的导入计划
  let impTimer = null; // 输入防抖

  function build() {
    const host = document.createElement("div");
    host.id = PANEL_ID;
    host.style.visibility = "hidden";
    const root = host.attachShadow({ mode: "open" });
    const initiallyCollapsed = rawRead(UI_COLLAPSED_KEY, "0") === "1";
    const storedTab = rawRead(UI_ACTIVE_TAB_KEY, "grab");
    const initialTab = ["grab", "cols", "rows"].includes(storedTab)
      ? storedTab
      : "grab";
    root.innerHTML = `
      <style>${CSS}</style>
      <div class="wrap${initiallyCollapsed ? " is-collapsed" : ""}">
        <button type="button" class="launcher" data-act="toggle" aria-controls="mp-data-tabs mp-data-body"
          aria-expanded="${!initiallyCollapsed}" aria-label="展开公众号文章数据" title="展开公众号文章数据">
          ${LAUNCHER_ICON}
        </button>
        <div class="hd" data-drag>
          <div class="hd-account">
            <b data-title></b>
            <button type="button" class="data-toggle" data-act="data-toggle" data-data-toggle
              aria-label="数据管理" title="数据管理" aria-expanded="false" aria-controls="mp-data-manager">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <ellipse cx="12" cy="5" rx="8" ry="3"/>
                <path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>
              </svg>
            </button>
          </div>
          <button type="button" data-act="toggle" aria-controls="mp-data-tabs mp-data-body"
            aria-expanded="${!initiallyCollapsed}" aria-label="收起为图标" title="收起为图标">–</button>
          <button data-act="close" title="关闭">×</button>
        </div>
        <div class="tabs" id="mp-data-tabs" data-tabs role="tablist" aria-label="功能区">
          <button type="button" id="mp-tab-grab" data-tab="grab" class="on" role="tab"
            aria-controls="mp-panel-grab" aria-selected="true" tabindex="0">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 3v11m0 0-4-4m4 4 4-4M4.5 16v2.5A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5V16"/>
            </svg>
            <span class="tab-label">抓取</span>
          </button>
          <button type="button" id="mp-tab-cols" data-tab="cols" role="tab"
            aria-controls="mp-panel-cols" aria-selected="false" tabindex="-1">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>
            </svg>
            <span class="tab-label">列设置</span>
          </button>
          <button type="button" id="mp-tab-rows" data-tab="rows" role="tab"
            aria-controls="mp-panel-rows" aria-selected="false" tabindex="-1">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/>
              <path d="M14 3v4h4M9 12h6M9 16h6"/>
            </svg>
            <span class="tab-label">文章 <span data-cnt>0</span></span>
          </button>
        </div>
        <div class="bd" id="mp-data-body">
          <div class="acct" data-acct></div>

          <!-- 抓取 -->
          <div class="view" id="mp-panel-grab" data-view="grab" role="tabpanel" aria-labelledby="mp-tab-grab">
            <div class="grab-switch" data-grab-switch data-view="${grabView}" role="tablist" aria-label="抓取类型">
              <button type="button" id="mp-grab-tab-list" data-grab-view="list" role="tab"
                aria-controls="mp-grab-pane-list" aria-selected="${grabView === "list"}"
                tabindex="${grabView === "list" ? 0 : -1}">抓列表</button>
              <button type="button" id="mp-grab-tab-detail" data-grab-view="detail" role="tab"
                aria-controls="mp-grab-pane-detail" aria-selected="${grabView === "detail"}"
                tabindex="${grabView === "detail" ? 0 : -1}">补详情</button>
            </div>
            <div class="grab-viewport" data-grab-viewport data-view="${grabView}">
              <div class="grab-track">
                <section class="grab-pane" id="mp-grab-pane-list" data-grab-panel="list"
                  role="tabpanel" aria-labelledby="mp-grab-tab-list">
                  <div class="warnbar" data-warn style="display:none"></div>
                  <div class="warnbar" data-claim style="display:none">
                    <span data-claim-txt></span>
                    <div style="margin-top:5px">
                      <button data-act="claim-yes" data-claim-yes>归入本号</button>
                      <button data-act="claim-no" data-claim-no>忽略</button>
                      <button data-act="claim-show" data-claim-show style="display:none">重新处理</button>
                    </div>
                  </div>
                  <div class="modes">
                    <button data-mode="inc" class="on" aria-pressed="true">增量更新</button>
                    <button data-mode="older" aria-pressed="false">补抓更早</button>
                    <button data-mode="full" aria-pressed="false">重新全抓</button>
                  </div>
                  <div data-daterow>
                    <label class="grab-date-line"><span>抓取到</span>
                      <input type="date" data-since title="包含所选日期当天">
                    </label>
                    <div class="quick">
                      <button data-days="30">近 30 天</button>
                      <button data-days="90">近 90 天</button>
                      <button data-days="365">近一年</button>
                      <button data-days="0">不限</button>
                    </div>
                  </div>
                  <div class="resume" data-resume style="display:none">
                    <span data-resume-txt></span>
                    <button data-act="resume">继续上次</button>
                    <button data-act="drop">丢弃</button>
                  </div>
                  <div class="btns grab-run"><button class="p" data-act="list">开始抓列表</button></div>
                  <div class="btns grab-date-repair" data-date-repair style="display:none">
                    <button type="button" data-act="repair-dates"
                      title="从发表记录列表查找缺日期文章；逐页请求，完成前可停止并保留进度"></button>
                  </div>
                </section>
                <section class="grab-pane" id="mp-grab-pane-detail" data-grab-panel="detail"
                  role="tabpanel" aria-labelledby="mp-grab-tab-detail">
                  <div class="detail-pending" data-pending></div>
                  <label class="detail-setting"><span>抓取速度</span>
                    <select data-detail-speed title="每篇详情请求之间的随机间隔；每 15 个请求会额外休息">
                      <option value="cautious">稳妥 · 间隔 5–8 秒</option>
                      <option value="standard">标准 · 间隔 2–5 秒</option>
                      <option value="quicker">较快 · 间隔 1.5–3 秒</option>
                    </select>
                  </label>
                  <div class="btns grab-run"><button class="p" data-act="detail">开始补详情</button></div>
                </section>
              </div>
            </div>
          </div>

          <!-- 列设置 -->
          <div class="view hide" id="mp-panel-cols" data-view="cols" role="tabpanel" aria-labelledby="mp-tab-cols">
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

          <!-- 文章 -->
          <div class="view hide" id="mp-panel-rows" data-view="rows" role="tabpanel" aria-labelledby="mp-tab-rows">
            <section class="data-manager rows-tool" id="mp-data-manager" data-data-manager hidden
              aria-label="当前账号数据管理">
              <h2 class="data-heading">数据管理</h2>
              <div class="backup-account" data-backup-account></div>
              <div class="backup-summary" data-backup-summary></div>
              <div class="backup-note" data-backup-note></div>
              <div class="backup-actions backup-file-actions">
                <button type="button" data-act="backup-download" data-backup-download>导出完整备份</button>
                <button type="button" data-act="backup-check">导入备份文件</button>
              </div>
              <input type="file" data-backup-file accept=".json,application/json" hidden
                aria-label="选择要校验和预览的备份文件">
              <div class="restore-safety" data-restore-safety hidden>
                <p data-restore-safety-note></p>
                <div class="backup-actions">
                  <button type="button" data-act="restore-safety-download" data-restore-safety-download>下载恢复前副本</button>
                </div>
              </div>
              <div class="backup-result" data-backup-result hidden role="status" aria-live="polite"></div>
              <div class="backup-actions" style="margin-top:8px">
                <button type="button" data-act="backup-preview" data-backup-preview hidden>预览恢复</button>
              </div>
              <section class="restore-preview" data-restore-preview hidden aria-label="恢复预览">
                <h3 class="restore-heading" data-restore-heading>恢复预览 · 仅补回缺失文章</h3>
                <div class="restore-summary" data-restore-summary role="status" aria-live="polite"></div>
                <p class="restore-note" data-restore-note></p>
                <div class="backup-actions" style="margin:8px 0">
                  <button type="button" class="p" data-act="restore-apply" data-restore-apply hidden>补回缺失文章</button>
                </div>
                <div data-restore-details>
                <label class="restore-filter">查看文章
                  <select data-restore-filter aria-label="筛选恢复预览文章">
                    <option value="all">全部文章</option>
                    <option value="add">将新增</option>
                    <option value="different">已有且有差异</option>
                    <option value="same">已有且一致</option>
                  </select>
                </label>
                <div data-restore-list></div>
                <div class="restore-pager">
                  <button type="button" data-act="restore-prev" data-restore-prev>上一页</button>
                  <span data-restore-page></span>
                  <button type="button" data-act="restore-next" data-restore-next>下一页</button>
                </div>
                </div>
              </section>
            </section>
            <div class="filt">
              <input type="search" data-q placeholder="搜标题…">
              <button type="button" class="date-filter-button" data-act="date-filter-toggle"
                data-date-filter-button aria-label="按发布日期筛选" title="按发布日期筛选"
                aria-controls="mp-article-date-filter" aria-expanded="false">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <rect x="3" y="5" width="18" height="16" rx="2"/>
                  <path d="M7 3v4M17 3v4M3 10h18M7 14h3M7 17h3"/>
                </svg>
              </button>
              <button type="button" class="tag-filter-button" data-act="tag-filter-toggle" data-tag-filter-button
                aria-label="标签筛选：标签不限" title="标签筛选：标签不限" aria-expanded="false" aria-controls="mp-tag-filter">
                <span data-tag-filter-label>标签不限</span>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
              </button>
            </div>
            <section class="tag-filter-panel rows-tool" id="mp-tag-filter" data-tag-filter-panel aria-label="标签筛选" hidden>
              <input type="search" class="tag-filter-search" data-tag-search placeholder="搜索标签…" aria-label="搜索标签" autocomplete="off">
              <div class="tag-detail-options" role="group" aria-label="详情状态">
                <label><input type="radio" name="mp-tag-detail" data-tag-detail value="all" checked>详情不限</label>
                <label><input type="radio" name="mp-tag-detail" data-tag-detail value="yes">有详情</label>
                <label><input type="radio" name="mp-tag-detail" data-tag-detail value="no">无详情</label>
              </div>
              <label class="tag-option"><input type="checkbox" data-tag-untagged><span>无自定义标签</span></label>
              <div class="tag-filter-caption"><span>自定义标签 · 符合任一</span><span data-tag-selected-count></span></div>
              <div class="tag-options" data-tag-options role="group" aria-label="自定义标签"></div>
              <div class="tag-filter-actions">
                <button type="button" data-act="tag-filter-clear">清空</button>
                <button type="button" data-act="tag-filter-done">完成</button>
              </div>
            </section>
            <div class="date-filter-panel rows-tool" id="mp-article-date-filter" data-date-filter-panel
              role="group" aria-label="发布日期范围" hidden>
              <div class="date-filter-fields">
                <div class="date-filter-field">
                  <span>开始日期</span>
                  <div class="date-filter-inputs" data-date-from role="group" aria-label="开始日期">
                    <input type="text" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="yyyy"
                      data-date-part="year" aria-label="开始日期的年">
                    <span class="date-separator" aria-hidden="true">/</span>
                    <input type="text" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="mm"
                      data-date-part="month" aria-label="开始日期的月">
                    <span class="date-separator" aria-hidden="true">/</span>
                    <input type="text" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="dd"
                      data-date-part="day" aria-label="开始日期的日">
                    <button type="button" class="date-picker-button" data-act="date-picker-from"
                      aria-label="从日历选择开始日期" title="从日历选择开始日期">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/>
                        <path d="M7 3v4M17 3v4M3 10h18"/></svg>
                    </button>
                    <input type="date" class="date-native-picker" data-native-from
                      min="0001-01-01" max="9999-12-31" tabindex="-1" aria-hidden="true">
                  </div>
                </div>
                <div class="date-filter-field">
                  <span>结束日期</span>
                  <div class="date-filter-inputs" data-date-to role="group" aria-label="结束日期">
                    <input type="text" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="yyyy"
                      data-date-part="year" aria-label="结束日期的年">
                    <span class="date-separator" aria-hidden="true">/</span>
                    <input type="text" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="mm"
                      data-date-part="month" aria-label="结束日期的月">
                    <span class="date-separator" aria-hidden="true">/</span>
                    <input type="text" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="dd"
                      data-date-part="day" aria-label="结束日期的日">
                    <button type="button" class="date-picker-button" data-act="date-picker-to"
                      aria-label="从日历选择结束日期" title="从日历选择结束日期">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/>
                        <path d="M7 3v4M17 3v4M3 10h18"/></svg>
                    </button>
                    <input type="date" class="date-native-picker" data-native-to
                      min="0001-01-01" max="9999-12-31" tabindex="-1" aria-hidden="true">
                  </div>
                </div>
              </div>
              <div class="date-filter-error" data-date-error role="alert" hidden></div>
              <div class="date-filter-actions">
                <button type="button" data-act="date-filter-clear">清除</button>
                <button type="button" class="p" data-act="date-filter-apply">应用</button>
              </div>
            </div>
            <div class="cbar selection-bar">
              <span data-selinfo></span>
              <button type="button" class="icon-action" data-act="sel-all"
                aria-label="全选当前筛选的文章" title="全选当前筛选的文章">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="2"/>
                  <path d="m7.5 12 3 3 6-6"/>
                </svg>
              </button>
              <button type="button" class="icon-action" data-act="sel-none"
                aria-label="清空所有已勾选文章" title="清空所有已勾选文章">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="2"/>
                  <path d="m8.5 8.5 7 7m0-7-7 7"/>
                </svg>
              </button>
            </div>
            <div class="selection-hint" data-selection-hint hidden></div>
            <div class="list" data-list role="list" tabindex="0"
              aria-label="文章列表，使用上下方向键浏览"></div>
            <div class="btns rows-refresh">
              <button data-act="refresh-live" data-livebtn
                title="重新从列表取 阅读/点赞/在看/分享/留言/划线/转载，不受详情页 30 天统计窗口限制">刷新实时数</button>
              <button data-act="refresh-sel"
                title="重新从单篇数据页取 完读率/时长/收藏/赞赏/听全文/阅读后关注 —— 微信只统计发表后 30 天内">刷新详情数</button>
            </div>
            <div class="tag-actions" role="group" aria-label="标签操作">
              <button type="button" class="tag-edit" data-act="tag-sel" title="编辑已勾选文章的自定义标签">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M4 4h7l9 9-7 7-9-9V4Z"/><circle cx="7.5" cy="7.5" r="1"/>
                </svg>
                <span>编辑标签</span>
              </button>
              <span class="tag-divider" aria-hidden="true"></span>
              <button type="button" class="tag-icon" data-act="imp-toggle" data-imptoggle
                aria-label="导入自定义标签" aria-controls="mp-tag-import" aria-expanded="false"
                title="导入自定义标签（粘贴或选择 JSON）">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M3 5h7l5 5v4l-5 5-7-7V5Z"/><circle cx="6.5" cy="8.5" r=".8"/>
                  <path d="M19 5v13m-3-3 3 3 3-3"/>
                </svg>
              </button>
              <button type="button" class="tag-icon" data-act="tag-export"
                aria-label="导出全库自定义标签" title="导出全库自定义标签（JSON）">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M3 5h7l5 5v4l-5 5-7-7V5Z"/><circle cx="6.5" cy="8.5" r=".8"/>
                  <path d="M19 19V6m-3 3 3-3 3 3"/>
                </svg>
              </button>
            </div>
            <div class="imp rows-tool" id="mp-tag-import" data-imp role="region"
              aria-label="导入标签" hidden>
              <div class="imp-heading">导入标签</div>
              <textarea data-imptext spellcheck="false" placeholder='两种写法都认，可以混着写：

{
  "倒计时 1 天！TI 四大展区等你来": ["活动", "重点"],
  "https://mp.weixin.qq.com/s/xxxx": "技术专栏"
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
                <span data-imphint></span>
                <button data-act="imp-preview">重新预览</button>
                <button data-act="imp-clear">清空输入</button>
              </div>
            </div>
            <div class="btns rows-export">
              <button data-act="copy">复制</button>
              <button data-act="csv">导出 CSV</button>
            </div>
          </div>
        </div>
        <div class="st empty" data-st role="status" aria-live="polite" aria-atomic="true">
          <span class="st-icon" data-st-icon aria-hidden="true"></span>
          <span class="st-copy" data-st-copy></span>
          <button type="button" class="st-dismiss" data-act="dismiss-status" aria-label="关闭提示" title="关闭提示">×</button>
        </div>
        <span class="sr-only" data-action-feedback role="status" aria-live="polite" aria-atomic="true"></span>
      </div>`;
    document.body.appendChild(host);

    const $ = (s) => root.querySelector(s);
    ui = {
      host,
      root,
      wrap: $(".wrap"),
      header: $(".hd"),
      title: $("[data-title]"),
      tabBar: $("[data-tabs]"),
      body: $(".bd"),
      launcher: $(".launcher"),
      toggleBtn: $('.hd [data-act="toggle"]'),
      iconAnchor: null,
      finishMorph: null,
      tabScroll: { grab: 0, cols: 0, rows: 0 },
      warn: $("[data-warn]"),
      acct: $("[data-acct]"),
      claim: $("[data-claim]"),
      claimTxt: $("[data-claim-txt]"),
      claimYes: $("[data-claim-yes]"),
      claimNo: $("[data-claim-no]"),
      claimShow: $("[data-claim-show]"),
      dateRow: $("[data-daterow]"),
      since: $("[data-since]"),
      grabSwitch: $("[data-grab-switch]"),
      grabViewport: $("[data-grab-viewport]"),
      grabBtns: [...root.querySelectorAll("[data-grab-view]")],
      grabPanels: [...root.querySelectorAll("[data-grab-panel]")],
      grabObserver: null,
      resume: $("[data-resume]"),
      resumeTxt: $("[data-resume-txt]"),
      pending: $("[data-pending]"),
      speed: $("[data-detail-speed]"),
      listBtn: $('[data-act="list"]'),
      detailBtn: $('[data-act="detail"]'),
      dateRepairRow: $("[data-date-repair]"),
      dateRepairBtn: $('[data-act="repair-dates"]'),
      cols: $("[data-cols]"),
      preset: $("[data-preset]"),
      ovBtn: $("[data-ov]"),
      renBtn: $("[data-ren]"),
      delBtn: $("[data-del]"),
      copy: $('[data-act="copy"]'),
      csv: $('[data-act="csv"]'),
      dataToggle: $("[data-data-toggle]"),
      dataManager: $("[data-data-manager]"),
      backupAccount: $("[data-backup-account]"),
      backupSummary: $("[data-backup-summary]"),
      backupNote: $("[data-backup-note]"),
      backupDownload: $("[data-backup-download]"),
      backupFile: $("[data-backup-file]"),
      backupResult: $("[data-backup-result]"),
      backupReadSerial: 0,
      backupCandidate: null,
      backupPreviewButton: $("[data-backup-preview]"),
      restorePreview: $("[data-restore-preview]"),
      restoreHeading: $("[data-restore-heading]"),
      restoreDetails: $("[data-restore-details]"),
      restoreSummary: $("[data-restore-summary]"),
      restoreNote: $("[data-restore-note]"),
      restoreFilter: $("[data-restore-filter]"),
      restoreList: $("[data-restore-list]"),
      restorePageLabel: $("[data-restore-page]"),
      restorePrev: $("[data-restore-prev]"),
      restoreNext: $("[data-restore-next]"),
      restorePlan: null,
      restoreSnapshot: null,
      restoreSourceText: "",
      restoreApplyButton: $("[data-restore-apply]"),
      restoreSafety: $("[data-restore-safety]"),
      restoreSafetyNote: $("[data-restore-safety-note]"),
      restoreSafetyDownload: $("[data-restore-safety-download]"),
      restorePage: 0,
      status: $("[data-st]"),
      statusIcon: $("[data-st-icon]"),
      statusCopy: $("[data-st-copy]"),
      actionFeedback: $("[data-action-feedback]"),
      buttonFeedbackTimers: new Map(),
      feedbackSerial: 0,
      pressFeedback: null,
      statusByScope: {
        "grab-list": { msg: "", kind: "", remaining: 0, revision: 0 },
        "grab-detail": { msg: "", kind: "", remaining: 0, revision: 0 },
        cols: { msg: "", kind: "", remaining: 0, revision: 0 },
        rows: { msg: "", kind: "", remaining: 0, revision: 0 },
      },
      statusTimer: null,
      statusSerial: 0,
      statusHovered: false,
      activeTab: "grab",
      list: $("[data-list]"),
      count: $("[data-cnt]"),
      virtualRows: [],
      selectionAnchor: null,
      filteredLinks: new Set(),
      rowFilterKey: null,
      rowWindowStart: -1,
      rowWindowEnd: -1,
      rowScrollFrame: 0,
      rowObserver: null,
      rowSummary: "",
      q: $("[data-q]"),
      tagFilter: createTagFilter(),
      tagFilterButton: $("[data-tag-filter-button]"),
      tagFilterLabel: $("[data-tag-filter-label]"),
      tagFilterPanel: $("[data-tag-filter-panel]"),
      tagSearch: $("[data-tag-search]"),
      tagOptions: $("[data-tag-options]"),
      tagUntagged: $("[data-tag-untagged]"),
      tagDetails: [...root.querySelectorAll("[data-tag-detail]")],
      tagSelectedCount: $("[data-tag-selected-count]"),
      availableTags: [],
      tagOptionsKey: null,
      dateFilterButton: $("[data-date-filter-button]"),
      dateFilterPanel: $("[data-date-filter-panel]"),
      dateFrom: $("[data-date-from]"),
      dateTo: $("[data-date-to]"),
      dateError: $("[data-date-error]"),
      dateRange: { start: "", end: "" },
      selectionHint: $("[data-selection-hint]"),
      selInfo: $("[data-selinfo]"),
      refreshBtn: $('[data-act="refresh-sel"]'),
      tagBtn: $('[data-act="tag-sel"]'),
      liveBtn: $("[data-livebtn]"),
      imp: $("[data-imp]"),
      impToggle: $("[data-imptoggle]"),
      impText: $("[data-imptext]"),
      impFile: $("[data-impfile]"),
      impPrev: $("[data-impprev]"),
      impApply: $("[data-impapply]"),
      impHint: $("[data-imphint]"),
      tabs: [...root.querySelectorAll("[data-tab]")],
      views: [...root.querySelectorAll(".view")],
      modeBtns: [...root.querySelectorAll("[data-mode]")],
    };
    ui.q.addEventListener("input", () => refresh());
    ui.tagSearch.addEventListener("input", renderTagChoices);
    ui.tagFilterPanel.addEventListener("change", onTagFilterChange);
    ui.tagFilterPanel.addEventListener("keydown", onTagFilterKeydown);
    ui.dateFilterPanel.addEventListener("input", onDatePartInput);
    ui.dateFilterPanel.addEventListener("compositionend", onDatePartInput);
    ui.dateFilterPanel.addEventListener("change", onDateFilterChange);
    ui.dateFilterPanel.addEventListener("paste", onDatePaste);
    ui.dateFilterPanel.addEventListener("keydown", onDatePartKeydown);
    root.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || e.isComposing) return;
      if (!ui.tagFilterPanel.hidden) {
        e.preventDefault();
        e.stopPropagation();
        closeTagFilterPanel(true);
      } else if (!ui.dateFilterPanel.hidden) {
        e.preventDefault();
        e.stopPropagation();
        closeDateFilterPanel();
        ui.dateFilterButton.focus({ preventScroll: true });
      } else if (ui.activeTab === "rows" && !ui.imp.hidden) {
        e.preventDefault();
        e.stopPropagation();
        setTagImportOpen(false);
        ui.impToggle.focus({ preventScroll: true });
      } else if (ui.activeTab === "rows" && !ui.dataManager.hidden) {
        e.preventDefault();
        e.stopPropagation();
        resetBackupPanel();
        ui.body.scrollTop = 0;
        ui.dataToggle.focus({ preventScroll: true });
      }
    });
    ui.dateOutsideHandler = (e) => {
      if (!ui || ui.dateFilterPanel.hidden) return;
      const path = e.composedPath();
      if (path.includes(ui.dateFilterPanel) || path.includes(ui.dateFilterButton)) return;
      closeDateFilterPanel();
    };
    document.addEventListener("pointerdown", ui.dateOutsideHandler);
    ui.tagOutsideHandler = (e) => {
      if (!ui || ui.tagFilterPanel.hidden) return;
      const path = e.composedPath();
      if (!path.includes(ui.tagFilterPanel) && !path.includes(ui.tagFilterButton)) closeTagFilterPanel();
    };
    document.addEventListener("pointerdown", ui.tagOutsideHandler);
    // checkbox 的 click 已带有切换后的 checked，且保留 Shift 修饰键。
    ui.list.addEventListener("click", onRowCheck);
    ui.list.addEventListener(
      "scroll",
      () => {
        if (ui.rowScrollFrame) return;
        ui.rowScrollFrame = requestAnimationFrame(() => {
          ui.rowScrollFrame = 0;
          renderRowWindow();
        });
      },
      { passive: true },
    );
    ui.list.addEventListener("keydown", onListKeydown);
    // 改了 JSON 先作废旧计划（防止拿旧计划导入），停手 500ms 后自动重新预览，
    // 这样不会出现「有内容但按钮是灰的、也不知道为什么」的状态
    ui.impText.addEventListener("input", () => {
      invalidatePlan();
      clearTimeout(impTimer);
      impTimer = setTimeout(() => {
        if ((ui.impText.value || "").trim()) doImpPreview();
      }, 500);
    });
    ui.impFile.addEventListener("change", onImpFile);
    ui.backupFile.addEventListener("change", onBackupFile);
    ui.restoreFilter.addEventListener("change", () => {
      ui.restorePage = 0;
      renderRestoreItems();
    });
    // 切换导入方式（单选），顺手刷新预览文案和按钮上的字
    ui.imp.addEventListener("change", (e) => {
      const r = e.target.closest && e.target.closest('input[name="impmode"]');
      if (!r) return;
      impMode = r.getAttribute("data-m");
      if (impPlan) doImpPreview();
      else updateImpApply();
    });

    const detailPrefs = detailSettings();
    ui.speed.value = detailPrefs.speed;
    const storeDetailPrefs = () => {
      const next = saveDetailSettings(ui.speed.value);
      ui.speed.value = next.speed;
    };
    ui.speed.addEventListener("change", storeDetailPrefs);

    const d = new Date();
    d.setDate(d.getDate() - 89); // 含今天在内共 90 个自然日
    ui.since.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    ui.cols.addEventListener("change", onColToggle);
    ui.preset.addEventListener("change", onPresetPick);
    ui.status.addEventListener("mouseenter", () => {
      ui.statusHovered = true;
      pauseStatusTimer();
    });
    ui.status.addEventListener("mouseleave", () => {
      ui.statusHovered = false;
      renderStatus();
    });
    ui.visibilityHandler = () => {
      if (!ui) return;
      if (document.hidden) {
        pauseStatusTimer();
        if (ui.pressFeedback) ui.pressFeedback.clearActive();
      }
      else renderStatus();
    };
    document.addEventListener("visibilitychange", ui.visibilityHandler);
    ui.pressFeedback = setupButtonPressFeedback(root);
    root.addEventListener("click", onClick);
    ui.tabBar.addEventListener("keydown", onTabKeydown);
    ui.grabSwitch.addEventListener("keydown", onGrabKeydown);
    initDrag(ui.cols);
    makeDraggable(ui.wrap, $("[data-drag]"), ui.launcher);

    selectGrabView(grabView);
    selectTab(ui.tabs.find((button) => button.getAttribute("data-tab") === initialTab));
    restorePanelPosition(ui.wrap);
    host.style.visibility = "";
    if (typeof ResizeObserver === "function") {
      ui.grabObserver = new ResizeObserver(() => sizeGrabViewport());
      ui.grabPanels.forEach((panel) => ui.grabObserver.observe(panel));
      ui.rowObserver = new ResizeObserver(() => {
        if (ui?.list.clientHeight) renderRowWindow();
      });
      ui.rowObserver.observe(ui.list);
    }
    // 页面可能不刷新就切换搜索/筛选（SPA），盯着 URL 变化，好及时给出提醒
    let lastHref = location.href;
    const checkPage = () => {
      if (!ui) return;
      // 切账号（多数情况会整页刷新，但 SPA 式切换也得兜住）
      const now = detectAccount();
      const switched = now.id !== acct.id;
      const labelChanged =
        now.name !== acct.name ||
        now.wxid !== acct.wxid ||
        now.known !== acct.known;
      if (switched || labelChanged) {
        if (switched) {
          accountEpoch++;
          if (running) {
            if (activeRun === "detail" || activeRun === "refresh-sel")
              stopDetailCrawl();
            else aborted = true;
          }
        }
        acct = now;
        if (switched) {
          closeDateFilterPanel();
          resetTagFilter();
          resetBackupPanel();
          sel = new Set();
          ui.selectionAnchor = null;
          fresh = new Set();
          clearTimeout(impTimer);
          invalidatePlan();
          pauseStatusTimer();
          clearActionFeedback();
          ui.pressFeedback.clearActive();
          for (const scope of Object.keys(ui.statusByScope))
            ui.statusByScope[scope] = {
              msg: "", kind: "", remaining: 0, revision: ++ui.statusSerial,
            };
          renderStatus();
          // 先清理旧账号的界面状态，再进行可能失败的存储读取。
          ui.title.textContent = ui.title.title = accountTitle(acct);
          mode = lib.read().rows.length ? "inc" : "full";
        }
        const refreshed = refresh();
        if (switched && refreshed !== false) {
          say(`已切到账号“${acct.name}”`, "ok", currentStatusScope());
        }
        lastHref = location.href;
        return;
      }
      if (location.href === lastHref && !ui.storageReadFailed) return;
      lastHref = location.href;
      if (ui.storageReadFailed) mode = lib.read().rows.length ? "inc" : "full";
      refresh();
    };
    setInterval(() => {
      try {
        checkPage();
      } catch (err) {
        console.error("[公众号数据] 账号或页面更新失败", err);
        if (ui) {
          ui.storageReadFailed = err.name === "StorageError";
          say(String(err.message || err), "err", currentStatusScope());
        }
      }
    }, 2000);
    // 必要的账号监视已注册；首次读库失败也能在存储恢复或切号后重新加载。
    if (!lib.read().rows.length) mode = "full";
    refresh();
  }

  function setupButtonPressFeedback(root) {
    const started = new WeakMap();
    const releaseTimers = new Map();
    const pointerButtons = new Map();
    const keyButtons = new Map();
    const buttonOf = (target) => target && target.closest && target.closest("button");
    const press = (button) => {
      if (!button || button.disabled || button.classList.contains("launcher")) return false;
      clearTimeout(releaseTimers.get(button));
      started.set(button, performance.now());
      button.classList.add("mp-pressing");
      return true;
    };
    const release = (button) => {
      if (!button) return;
      const at = started.get(button);
      if (at === undefined) return;
      clearTimeout(releaseTimers.get(button));
      const wait = Math.max(0, 100 - (performance.now() - at));
      const timer = setTimeout(() => {
        button.classList.remove("mp-pressing");
        started.delete(button);
        releaseTimers.delete(button);
      }, wait);
      releaseTimers.set(button, timer);
    };
    root.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const button = buttonOf(e.target);
      if (press(button)) pointerButtons.set(e.pointerId, button);
    });
    const endPointer = (e) => {
      const button = pointerButtons.get(e.pointerId);
      pointerButtons.delete(e.pointerId);
      release(button);
    };
    root.addEventListener("pointerup", endPointer);
    root.addEventListener("pointercancel", endPointer);
    root.addEventListener("pointerout", (e) => {
      const button = pointerButtons.get(e.pointerId);
      if (!button || button.contains(e.relatedTarget)) return;
      pointerButtons.delete(e.pointerId);
      release(button);
    });
    root.addEventListener("keydown", (e) => {
      if (e.repeat || (e.key !== " " && e.key !== "Enter")) return;
      const button = buttonOf(e.target);
      if (press(button)) keyButtons.set(e.key, button);
    });
    root.addEventListener("keyup", (e) => {
      const button = keyButtons.get(e.key);
      keyButtons.delete(e.key);
      release(button);
    });
    root.addEventListener("focusout", (e) => {
      const button = buttonOf(e.target);
      for (const [key, active] of keyButtons) {
        if (active !== button) continue;
        keyButtons.delete(key);
        release(active);
      }
    });
    root.addEventListener("click", (e) => {
      const button = buttonOf(e.target);
      if (e.detail === 0 && button && !button.classList.contains("mp-pressing") &&
          press(button)) release(button);
    }, true);
    const clearActive = () => {
      const buttons = new Set([
        ...pointerButtons.values(), ...keyButtons.values(), ...releaseTimers.keys(),
      ]);
      for (const timer of releaseTimers.values()) clearTimeout(timer);
      for (const button of buttons) {
        button.classList.remove("mp-pressing");
        started.delete(button);
      }
      pointerButtons.clear();
      keyButtons.clear();
      releaseTimers.clear();
    };
    window.addEventListener("blur", clearActive);
    return {
      clearActive,
      dispose() {
        window.removeEventListener("blur", clearActive);
        clearActive();
      },
    };
  }

  function positionPanel(box, left, top) {
    const r = box.getBoundingClientRect();
    const margin = 8;
    box.style.left =
      Math.max(
        margin,
        Math.min(Math.max(margin, innerWidth - r.width - margin), left),
      ) + "px";
    box.style.top =
      Math.max(
        margin,
        Math.min(Math.max(margin, innerHeight - r.height - margin), top),
      ) + "px";
    box.style.right = "auto";
    box.style.bottom = "auto";
  }

  function panelPoint(rect) {
    return rect && Number.isFinite(rect.left) && Number.isFinite(rect.top)
      ? { left: Math.round(rect.left), top: Math.round(rect.top) }
      : null;
  }

  function readPanelPosition(collapsed) {
    try {
      const key = collapsed ? UI_ICON_POSITION_KEY : UI_OPEN_POSITION_KEY;
      const saved = JSON.parse(rawRead(key, "null"));
      const point = panelPoint(saved);
      if (point && collapsed) point.openPosition = panelPoint(saved.openPosition);
      return point;
    } catch (_) {
      return null;
    }
  }

  function savePanelPosition(collapsed, rect, openRect) {
    const point = panelPoint(rect);
    if (!point) return;
    if (collapsed) {
      if (openRect) point.openPosition = panelPoint(openRect);
      ui.iconAnchor = point;
    }
    const key = collapsed ? UI_ICON_POSITION_KEY : UI_OPEN_POSITION_KEY;
    rawWrite(key, JSON.stringify(point));
  }

  function restorePanelPosition(box) {
    const collapsed = box.classList.contains("is-collapsed");
    ui.iconAnchor = readPanelPosition(true);
    const saved = collapsed ? ui.iconAnchor : readPanelPosition(false);
    if (saved) positionPanel(box, saved.left, saved.top);
  }

  function makeDraggable(box, handle, launcher) {
    let drag = null;
    let lastLauncherDrag = -Infinity;
    const start = (e) => {
      if (
        e.button !== 0 ||
        (e.currentTarget === handle && e.target.closest("button"))
      )
        return;
      if (ui && ui.finishMorph) ui.finishMorph();
      const r = box.getBoundingClientRect();
      drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        left: r.left,
        top: r.top,
        moved: false,
        target: e.currentTarget,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      positionPanel(box, drag.left + dx, drag.top + dy);
      e.preventDefault();
    };
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) {
        const collapsed = box.classList.contains("is-collapsed");
        const rect = box.getBoundingClientRect();
        savePanelPosition(collapsed, rect);
        if (drag.target === launcher) lastLauncherDrag = performance.now();
      }
      drag = null;
    };
    for (const el of [handle, launcher]) {
      el.addEventListener("pointerdown", start);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
    }
    // 拖动小图标的 pointerup 也可能产生 click，不能把这次拖动当成展开。
    launcher.addEventListener(
      "click",
      (e) => {
        if (e.detail === 0 || performance.now() - lastLauncherDrag >= 250)
          return;
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );
    window.addEventListener("resize", () => {
      if (ui && ui.finishMorph) ui.finishMorph();
      if (box.isConnected && box.style.left)
        positionPanel(
          box,
          box.getBoundingClientRect().left,
          box.getBoundingClientRect().top,
        );
    });
  }

  function togglePanel() {
    if (!ui || ui.finishMorph) return;
    const box = ui.wrap;
    const from = box.getBoundingClientRect();
    const fromInnerWidth = box.clientWidth;
    const collapsing = !box.classList.contains("is-collapsed");
    const anchor = ui.iconAnchor;
    const fromRadius = getComputedStyle(box).borderTopLeftRadius;
    if (collapsing) {
      pauseStatusTimer();
      ui.statusHovered = false;
    }

    // 先在不可见状态下量出目标尺寸，再用同一组起止坐标播放动画。
    box.style.visibility = "hidden";
    box.classList.toggle("is-collapsed", collapsing);
    if (collapsing) {
      // 用上一次配对的相对偏移跟随面板。旧坐标或尺寸变化时，将整个图标限制在当前面板内。
      const origin = anchor?.openPosition || from;
      const left = anchor ? from.left + (anchor.left - origin.left) : from.right;
      const top = anchor ? from.top + (anchor.top - origin.top) : from.bottom;
      positionPanel(
        box,
        Math.max(from.left, Math.min(from.right - box.offsetWidth, left)),
        Math.max(from.top, Math.min(from.bottom - box.offsetHeight, top)),
      );
    } else {
      // 3.5.43 可能将相距很远的图标与面板配对。只复用仍包含当前图标的面板位置。
      const sameAnchor = anchor && anchor.left === Math.round(from.left) &&
        anchor.top === Math.round(from.top);
      const remembered = sameAnchor && anchor.openPosition;
      const fits = remembered &&
        from.left >= remembered.left - 1 && from.right <= remembered.left + box.offsetWidth + 1 &&
        from.top >= remembered.top - 1 && from.bottom <= remembered.top + box.offsetHeight + 1;
      // 各轴分别向空间较多的一侧展开；positionPanel 负责最后的视口边界约束。
      const target = fits ? remembered : {
        left: from.left <= innerWidth - from.right ? from.left : from.right - box.offsetWidth,
        top: from.top <= innerHeight - from.bottom ? from.top : from.bottom - box.offsetHeight,
      };
      positionPanel(box, target.left, target.top);
    }
    const to = box.getBoundingClientRect();
    if (collapsing) {
      savePanelPosition(true, to, from);
    } else {
      savePanelPosition(true, from, to);
      savePanelPosition(false, to);
    }
    const toInnerWidth = box.clientWidth;
    const toRadius = getComputedStyle(box).borderTopLeftRadius;
    ui.toggleBtn.setAttribute("aria-expanded", String(!collapsing));
    ui.launcher.setAttribute("aria-expanded", String(!collapsing));
    rawWrite(UI_COLLAPSED_KEY, collapsing ? "1" : "0");

    const focusTarget = collapsing ? ui.launcher : ui.toggleBtn;
    if (
      !box.animate ||
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !from.width ||
      !from.height ||
      !to.width ||
      !to.height
    ) {
      box.style.visibility = "";
      focusTarget.focus({ preventScroll: true });
      if (!collapsing) {
        renderStatus();
        requestAnimationFrame(sizeGrabViewport);
      }
      return;
    }

    const finalStyle = {
      left: box.style.left,
      top: box.style.top,
      right: box.style.right,
      bottom: box.style.bottom,
      width: box.style.width,
      height: box.style.height,
    };
    const panelParts = [ui.header, ui.tabBar, ui.body, ui.status];
    const panelOpacity = panelParts.map((el) => el.style.opacity);
    const launcherOpacity = ui.launcher.style.opacity;
    const duration = 340;
    const timing = {
      duration,
      easing: "cubic-bezier(.22,1,.36,1)",
      fill: "forwards",
    };
    const px = (n) => `${n}px`;
    const panelShadow =
      "0 14px 38px rgba(20,41,31,.16), 0 2px 8px rgba(20,41,31,.06)";
    const noShadow = "0 14px 38px rgba(20,41,31,0), 0 2px 8px rgba(20,41,31,0)";
    const rectFrame = (r, radius, color, open) => ({
      left: px(r.left),
      top: px(r.top),
      width: px(r.width),
      height: px(r.height),
      borderRadius: radius,
      backgroundColor: color,
      borderWidth: open ? "1px" : "0px",
      borderColor: open ? "#e3e5e8" : "rgba(227,229,232,0)",
      boxShadow: open ? panelShadow : noShadow,
    });

    box.style.setProperty(
      "--mp-open-width",
      px(collapsing ? fromInnerWidth : toInnerWidth),
    );
    box.classList.add("is-morphing");
    box.style.left = px(from.left);
    box.style.top = px(from.top);
    box.style.width = px(from.width);
    box.style.height = px(from.height);
    box.style.right = "auto";
    box.style.bottom = "auto";
    panelParts.forEach((el) => {
      el.style.opacity = collapsing ? "1" : "0";
    });
    ui.launcher.style.opacity = collapsing ? "0" : "1";
    box.setAttribute("aria-busy", "true");
    box.style.visibility = "";

    let animations = [];
    const finish = () => {
      if (!ui || ui.finishMorph !== finish) return;
      ui.finishMorph = null;
      for (const animation of animations) animation.cancel();
      for (const [key, value] of Object.entries(finalStyle))
        box.style[key] = value;
      box.style.removeProperty("--mp-open-width");
      box.classList.remove("is-morphing");
      panelParts.forEach((el, i) => {
        el.style.opacity = panelOpacity[i];
      });
      ui.launcher.style.opacity = launcherOpacity;
      box.removeAttribute("aria-busy");
      box.style.visibility = "";
      if (box.isConnected) focusTarget.focus({ preventScroll: true });
      if (!collapsing) {
        renderStatus();
        requestAnimationFrame(sizeGrabViewport);
      }
    };
    ui.finishMorph = finish;
    try {
      animations = [
        box.animate(
          [
            rectFrame(
              from,
              fromRadius,
              collapsing ? "#fff" : "rgba(236,255,245,.9)",
              collapsing,
            ),
            rectFrame(
              to,
              toRadius,
              collapsing ? "rgba(236,255,245,.9)" : "#fff",
              !collapsing,
            ),
          ],
          timing,
        ),
      ];
      const panelFrames = collapsing
        ? [
            { opacity: 1, offset: 0 },
            { opacity: 0, offset: 0.32 },
            { opacity: 0, offset: 1 },
          ]
        : [
            { opacity: 0, offset: 0 },
            { opacity: 0, offset: 0.48 },
            { opacity: 1, offset: 1 },
          ];
      animations.push(
        ...panelParts.map((el) => el.animate(panelFrames, timing)),
      );
      animations.push(
        ui.launcher.animate(
          collapsing
            ? [
                { opacity: 0, transform: "scale(.86)", offset: 0 },
                { opacity: 0, transform: "scale(.86)", offset: 0.28 },
                { opacity: 1, transform: "scale(1)", offset: 1 },
              ]
            : [
                { opacity: 1, transform: "scale(1)", offset: 0 },
                { opacity: 0, transform: "scale(.86)", offset: 0.5 },
                { opacity: 0, transform: "scale(.86)", offset: 1 },
              ],
          timing,
        ),
      );
      Promise.allSettled(
        animations.map((animation) => animation.finished),
      ).then(finish);
    } catch (_) {
      finish();
    }
  }

  function currentStatusScope() {
    return ui.activeTab === "grab" ? `grab-${grabView}` : ui.activeTab;
  }

  function accountContext() {
    return { id: acct.id, epoch: accountEpoch };
  }

  function sameAccountContext(context) {
    return !!ui && accountEpoch === context.epoch &&
      acct.id === context.id && detectAccount().id === context.id;
  }

  const STATUS_DURATION = { info: 3500, ok: 4500, warn: 10000, err: 12000 };

  function pauseStatusTimer() {
    if (!ui || !ui.statusTimer) return;
    const { id, scope, revision, deadline } = ui.statusTimer;
    clearTimeout(id);
    const state = ui.statusByScope[scope];
    if (state && state.revision === revision)
      state.remaining = Math.max(0, deadline - Date.now());
    ui.statusTimer = null;
  }

  function renderStatus() {
    if (!ui) return;
    pauseStatusTimer();
    const scope = currentStatusScope();
    const state = ui.statusByScope[scope];
    if (state.autoHide && state.remaining <= 0) {
      state.msg = "";
      state.kind = "";
      state.autoHide = false;
    }
    const visible = !!state.msg;
    const kind = visible ? state.kind : "";
    ui.status.className =
      "st" + (visible ? ` ${kind}` : " empty") +
      (kind === "err" || kind === "warn" ? " dismissible" : "");
    ui.status.setAttribute("aria-live",
      kind === "progress" ? "off" : kind === "err" ? "assertive" : "polite");
    ui.statusCopy.textContent = state.msg;
    ui.statusIcon.textContent =
      kind === "ok" ? "✓" : kind === "err" || kind === "warn" ? "!" : kind === "info" ? "·" : "";
    ui.status.title = state.msg;
    if (!visible || !state.autoHide || ui.statusHovered || document.hidden ||
        ui.wrap.classList.contains("is-collapsed")) return;
    const revision = state.revision;
    const deadline = Date.now() + state.remaining;
    const id = setTimeout(() => {
      if (!ui || !ui.statusTimer || ui.statusTimer.id !== id) return;
      ui.statusTimer = null;
      const current = ui.statusByScope[scope];
      if (!current || current.revision !== revision) return;
      current.msg = "";
      current.kind = "";
      current.autoHide = false;
      current.remaining = 0;
      current.revision = ++ui.statusSerial;
      if (currentStatusScope() === scope) renderStatus();
    }, state.remaining);
    ui.statusTimer = { id, scope, revision, deadline };
  }

  function runStatusScope(run) {
    if (run === "list" || run === "repair-dates") return "grab-list";
    if (run === "detail") return "grab-detail";
    return "rows";
  }

  // 状态归属必须由动作指定；异步任务切换页面后仍写回发起它的区域。
  function say(msg, kind, scope) {
    if (!ui) return;
    if (!Object.prototype.hasOwnProperty.call(ui.statusByScope, scope))
      throw new Error(`未知的提示区域：${scope}`);
    const resolved = msg ? kind || "info" : "";
    const duration = STATUS_DURATION[resolved] || 0;
    if (currentStatusScope() === scope) pauseStatusTimer();
    ui.statusByScope[scope] = {
      msg,
      kind: resolved,
      remaining: duration,
      autoHide: duration > 0,
      revision: ++ui.statusSerial,
    };
    if (currentStatusScope() !== scope) return;
    renderStatus();
  }

  function clearActionFeedback() {
    if (!ui) return;
    ui.feedbackSerial++;
    for (const [button, timer] of ui.buttonFeedbackTimers) {
      clearTimeout(timer);
      button.classList.remove("mp-confirmed");
    }
    ui.buttonFeedbackTimers.clear();
    ui.actionFeedback.textContent = "";
  }

  function flashActionButton(button, announcement) {
    if (!ui || !button) return;
    const owner = ui;
    clearTimeout(owner.buttonFeedbackTimers.get(button));
    button.classList.add("mp-confirmed");
    const timer = setTimeout(() => {
      if (owner.buttonFeedbackTimers.get(button) !== timer) return;
      button.classList.remove("mp-confirmed");
      owner.buttonFeedbackTimers.delete(button);
    }, 1200);
    owner.buttonFeedbackTimers.set(button, timer);
    const revision = ++owner.feedbackSerial;
    owner.actionFeedback.textContent = "";
    requestAnimationFrame(() => {
      if (ui === owner && owner.feedbackSerial === revision)
        owner.actionFeedback.textContent = announcement;
    });
  }

  /* ---- 列表拖动排序 ---- */
  function initDrag(box) {
    let el = null;
    const under = (y) =>
      [...box.querySelectorAll(".crow:not(.drag)")].find((r) => {
        const b = r.getBoundingClientRect();
        return y < b.top + b.height / 2;
      });

    box.addEventListener("mousedown", (e) => {
      const grip = e
        .composedPath()
        .find((n) => n.classList && n.classList.contains("grip"));
      if (!grip) return;
      el = grip.closest(".crow");
      if (!el) return;
      el.classList.add("drag");
      dragLock = true;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!el) return;
      const a = under(e.clientY);
      if (a) box.insertBefore(el, a);
      else box.appendChild(el);
    });
    document.addEventListener("mouseup", () => {
      if (!el) return;
      el.classList.remove("drag");
      el = null;
      dragLock = false;
      const order = [...box.querySelectorAll(".crow[data-col]")].map((x) =>
        x.getAttribute("data-col"),
      );
      cfg.patch({ order });
      refresh();
      say("列顺序已保存", "ok", "cols");
    });
  }

  function onColToggle(e) {
    const sk = e.target.closest && e.target.closest(".sk");
    if (sk) {
      const c = cfg.read();
      const col = sk.getAttribute("data-col");
      const i = c.sum.indexOf(col);
      if (sk.checked) {
        if (i < 0) c.sum.push(col);
      } else if (i >= 0) c.sum.splice(i, 1);
      cfg.write(c);
      refresh();
      say(`互动量 = ${sumCols().join(" + ") || "（空）"}`, "ok", "cols");
      return;
    }
    const box = e.target.closest(".ck");
    if (!box) return;
    const c = cfg.read();
    const col = box.getAttribute("data-col");
    const i = c.off.indexOf(col);
    if (box.checked) {
      if (i >= 0) c.off.splice(i, 1);
    } else if (i < 0) c.off.push(col);
    cfg.write(c);
    box.closest(".crow").classList.toggle("off", !box.checked);
    refresh();
  }

  /* ---- 模板 ---- */
  function renderPresets() {
    const cur = cfg.read().preset;
    const names = presets.names();
    const star = presetDirty() ? " *" : "";
    ui.preset.innerHTML =
      `<option value="">默认</option>` +
      names
        .map(
          (n) =>
            `<option value="${esc(n)}"${n === cur ? " selected" : ""}>${esc(n)}${n === cur ? star : ""}</option>`,
        )
        .join("");
    if (!cur || names.indexOf(cur) < 0) ui.preset.value = "";
    const has = !!ui.preset.value;
    ui.ovBtn.disabled = !has;
    ui.renBtn.disabled = !has;
    ui.delBtn.disabled = !has;
    ui.ovBtn.classList.toggle("hot", has && presetDirty());
  }

  function onPresetPick() {
    const name = ui.preset.value;
    if (!name) cfg.reset();
    else presets.apply(name);
    say("", "", "cols");
    refresh();
  }

  function askName(tip, dflt) {
    const s = (prompt(tip, dflt || "") || "").trim();
    if (!s) return "";
    if (s === "默认") {
      say("“默认”是系统模板，换一个吧", "err", "cols");
      return "";
    }
    return s;
  }

  /* ---- 重绘 ---- */
  /** 发布日期统一成 YYYYMMDD；旧库中的非补零日期也能正确比较。 */
  function publicationDateKey(value) {
    const raw = cell(value).trim();
    const parts = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
      || raw.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!parts) return 0;
    const year = Number(parts[1]);
    const month = Number(parts[2]);
    const day = Number(parts[3]);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return 0;
    return year * 10000 + month * 100 + day;
  }

  function dateRangeActive() {
    return !!(ui.dateRange.start || ui.dateRange.end);
  }

  function rowInDateRange(row, startKey, endKey) {
    if (!startKey && !endKey) return true;
    const key = publicationDateKey(row.发布日期);
    return !!key && (!startKey || key >= startKey) && (!endKey || key <= endKey);
  }

  function clearDateFilterError() {
    ui.dateError.textContent = "";
    ui.dateError.hidden = true;
  }

  /** 原生 date 输入的语言和年位数由浏览器决定；这里固定显示 yyyy/mm/dd。 */
  function datePartInputs(group) {
    return [...group.querySelectorAll("[data-date-part]")];
  }

  function setDateParts(group, value) {
    const parts = datePartInputs(group);
    const match = cell(value).match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})$/);
    parts.forEach((input, index) => {
      input.value = match ? match[index + 1] : "";
    });
  }

  function readDateParts(group) {
    const parts = datePartInputs(group).map((input) => input.value.trim());
    if (parts.every((value) => !value)) return "";
    if (parts.some((value, index) => value.length !== [4, 2, 2][index]))
      return null;
    return `${parts[0]}-${parts[1]}-${parts[2]}`;
  }

  function onDatePartInput(e) {
    const input = e.target.closest("[data-date-part]");
    if (!input || e.isComposing) return;
    const clean = input.value.replace(/\D/g, "").slice(0, input.maxLength);
    if (input.value !== clean) input.value = clean;
    clearDateFilterError();
    const parts = datePartInputs(input.closest(".date-filter-inputs"));
    const index = parts.indexOf(input);
    if (index < 2 && input.value.length === input.maxLength
      && input.selectionStart === input.value.length
      && e.inputType?.startsWith("insert")) {
      parts[index + 1].focus();
    }
  }

  function onDatePaste(e) {
    const input = e.target.closest("[data-date-part]");
    if (!input) return;
    const value = (e.clipboardData?.getData("text") || "").trim();
    const match = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
      || value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!match) return;
    e.preventDefault();
    const group = input.closest(".date-filter-inputs");
    setDateParts(group,
      `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`);
    clearDateFilterError();
    datePartInputs(group)[2].focus();
  }

  function onDatePartKeydown(e) {
    const input = e.target.closest("[data-date-part]");
    if (!input || e.key !== "Backspace" || input.value) return;
    const parts = datePartInputs(input.closest(".date-filter-inputs"));
    const previous = parts[parts.indexOf(input) - 1];
    if (previous) {
      e.preventDefault();
      previous.focus();
      previous.setSelectionRange(previous.value.length, previous.value.length);
    }
  }

  function onDateFilterChange(e) {
    const picker = e.target.closest(".date-native-picker");
    if (!picker) {
      clearDateFilterError();
      return;
    }
    if (!picker.value) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(picker.value)) {
      ui.dateError.textContent = "年份必须是 4 位";
      ui.dateError.hidden = false;
      return;
    }
    setDateParts(picker.closest(".date-filter-inputs"), picker.value);
    clearDateFilterError();
  }

  function openNativeDatePicker(group) {
    const picker = group.querySelector(".date-native-picker");
    const current = readDateParts(group);
    picker.value = current && publicationDateKey(current) ? current : "";
    try {
      if (typeof picker.showPicker !== "function") throw new Error("unsupported");
      picker.showPicker();
    } catch (e) {
      ui.dateError.textContent = "此浏览器无法打开日历，请手动输入日期";
      ui.dateError.hidden = false;
    }
  }

  function renderDateFilterButton() {
    const { start, end } = ui.dateRange;
    const fmt = (value) => value.replace(/-/g, "/");
    const range = start && end
      ? `${fmt(start)}—${fmt(end)}`
      : start
        ? `${fmt(start)} 起`
        : end
          ? `截至 ${fmt(end)}`
          : "";
    const label = range ? `按发布日期筛选，当前范围：${range}` : "按发布日期筛选";
    ui.dateFilterButton.classList.toggle("active", !!range);
    ui.dateFilterButton.setAttribute("aria-label", label);
    ui.dateFilterButton.title = label;
  }

  function closeDateFilterPanel() {
    ui.dateFilterPanel.hidden = true;
    ui.dateFilterButton.setAttribute("aria-expanded", "false");
    clearDateFilterError();
  }

  function setTagImportOpen(open) {
    ui.imp.hidden = !open;
    ui.impToggle.setAttribute("aria-expanded", String(open));
    ui.impToggle.title = open ? "收起导入标签" : "导入自定义标签（粘贴或选择 JSON）";
    if (open) ui.imp.scrollTop = 0;
  }

  function openDateFilterPanel() {
    closeTagFilterPanel();
    setTagImportOpen(false);
    if (!ui.dataManager.hidden) resetBackupPanel();
    setDateParts(ui.dateFrom, ui.dateRange.start);
    setDateParts(ui.dateTo, ui.dateRange.end);
    clearDateFilterError();
    ui.dateFilterPanel.hidden = false;
    ui.dateFilterButton.setAttribute("aria-expanded", "true");
    datePartInputs(ui.dateFrom)[0].focus({ preventScroll: true });
  }

  function applyDateFilter() {
    const start = readDateParts(ui.dateFrom);
    const end = readDateParts(ui.dateTo);
    const startKey = start ? publicationDateKey(start) : 0;
    const endKey = end ? publicationDateKey(end) : 0;
    if (start === null || end === null || (start && !startKey) || (end && !endKey)) {
      ui.dateError.textContent = "请输入完整有效的日期（yyyy/mm/dd）";
      ui.dateError.hidden = false;
      return;
    }
    if (startKey && endKey && startKey > endKey) {
      ui.dateError.textContent = "开始日期不能晚于结束日期";
      ui.dateError.hidden = false;
      return;
    }
    ui.dateRange = { start, end };
    renderDateFilterButton();
    closeDateFilterPanel();
    refresh();
  }

  function clearDateFilter() {
    ui.dateRange = { start: "", end: "" };
    setDateParts(ui.dateFrom, "");
    setDateParts(ui.dateTo, "");
    renderDateFilterButton();
    closeDateFilterPanel();
    refresh();
  }

  function dateBounds(rows) {
    let earliest = 0,
      latest = 0;
    for (const row of rows) {
      const key = publicationDateKey(row.发布日期);
      if (!key) continue;
      if (!earliest || key < earliest) earliest = key;
      if (key > latest) latest = key;
    }
    const display = (key) => {
      if (!key) return "";
      const date = String(key).padStart(8, "0");
      return `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6)}`;
    };
    return { earliest: display(earliest), latest: display(latest) };
  }

  /* ---- 当前账号备份与只读文件校验 ---- */
  function backupSizeLabel(bytes) {
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.ceil(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function resetBackupPanel() {
    if (!ui || !ui.dataManager) return;
    ui.backupReadSerial++;
    ui.dataManager.hidden = true;
    ui.dataToggle.setAttribute("aria-expanded", "false");
    ui.backupFile.value = "";
    ui.backupResult.hidden = true;
    ui.backupResult.textContent = "";
    ui.backupAccount.textContent = "";
    ui.backupSummary.textContent = "";
    ui.backupNote.textContent = "";
    if (ui.restoreSafety) {
      ui.restoreSafety.hidden = true;
      ui.restoreSafetyNote.textContent = "";
    }
    clearRestorePreview(true);
  }

  function clearRestorePreview(clearFile = false) {
    if (!ui) return;
    ui.restorePlan = null;
    ui.restoreSnapshot = null;
    ui.restoreSourceText = "";
    if (ui.restoreHeading) ui.restoreHeading.textContent = "恢复预览 · 仅补回缺失文章";
    if (ui.restoreDetails) ui.restoreDetails.hidden = true;
    if (ui.restoreApplyButton) {
      ui.restoreApplyButton.hidden = true;
      ui.restoreApplyButton.disabled = true;
    }
    ui.restorePage = 0;
    if (ui.restorePreview) {
      ui.restorePreview.hidden = true;
      ui.restoreSummary.textContent = "";
      ui.restoreNote.textContent = "";
      ui.restoreList.innerHTML = "";
      ui.restoreFilter.value = "all";
      ui.restoreFilter.disabled = true;
      ui.restorePageLabel.textContent = "";
      ui.restorePrev.disabled = true;
      ui.restoreNext.disabled = true;
    }
    if (clearFile) {
      ui.backupCandidate = null;
      if (ui.backupPreviewButton) {
        ui.backupPreviewButton.hidden = true;
        ui.backupPreviewButton.disabled = true;
      }
    }
    if (ui.backupPreviewButton) ui.backupPreviewButton.textContent = "预览恢复";
  }

  function restoreFieldLabel(field) {
    const labels = {
      _tags: "自定义标签", _detail: "详情状态", _durSec: "平均阅读时长（秒）",
      _detailVersion: "最近获取的详情版本", _collectionStatus: "最近获取的收藏状态",
      _finishRatio: "完读率（0—1）", _ts: "发布时间戳", _appmsgid: "文章标识",
      _itemidx: "群发位置", _sendUv: "送达人数", _listenValue: "听全文原始值",
      _listenSource: "听全文统计来源", _dRead: "详情阅读人数", _dReadPv: "详情阅读次数",
      _dLike: "详情点赞", _dZaikan: "详情在看", _dShare: "详情分享人数",
      _dSharePv: "详情分享次数", _dComment: "详情留言", _dListenPv: "详情听全文次数",
      _dInteractionRatio: "详情互动率",
    };
    return Object.prototype.hasOwnProperty.call(labels, field) ? labels[field] : field;
  }

  function restoreValueText(value, field, other) {
    if (value === undefined) return "未保存";
    if (value === null) return "空值";
    if (value === "") return "空文本";
    if (field === "_tags" && Array.isArray(value)) return value.length ? value.join("、") : "无自定义标签";
    const typeNames = { string: "文本", number: "数字", boolean: "布尔值" };
    const typeHint = other !== undefined && other !== null && typeof value !== typeof other
      ? `（${typeNames[typeof value] || "对象"}）` : "";
    if (field === "_detail") return ((value === 1 || value === true) ? "已补详情" : "未补详情") + typeHint;
    if (field === "_detailVersion")
      return ({ new: "新版", legacy: "旧版" }[value] || String(value)) + typeHint;
    if (field === "_collectionStatus")
      return ({ available: "已返回有效收藏数", legacy_unavailable: "旧版未提供收藏", missing: "未返回有效收藏数，待核查" }[value] || String(value)) + typeHint;
    if (typeof value !== "object") return String(value) + typeHint;
    // 扩展字段中的对象和数组按原结构展示，所有内容均作为文本转义。
    return JSON.stringify(value);
  }

  function renderRestoreItems() {
    if (!ui || !ui.restorePlan) return;
    const filter = ui.restoreFilter.value;
    const items = ui.restorePlan.items.filter((item) => filter === "all" || item.status === filter);
    const size = 20;
    const pages = Math.max(1, Math.ceil(items.length / size));
    ui.restorePage = Math.max(0, Math.min(ui.restorePage, pages - 1));
    const pageItems = items.slice(ui.restorePage * size, (ui.restorePage + 1) * size);
    const statusText = { add: "将新增", different: "已有差异 · 保留当前", same: "已有一致 · 无需补回" };
    ui.restoreList.innerHTML = pageItems.length ? pageItems.map((item) => {
      const tags = (values) => values.length ? values.join("、") : "无";
      const lines = item.status === "add"
        ? `<p>备份标签：${esc(tags(item.backupTags))}<br>备份详情：${item.backupHasDetail ? "已补" : "未补"}</p>`
        : `<p>当前标签：${esc(tags(item.currentTags))}<br>备份标签：${esc(tags(item.backupTags))}</p>
           <p>当前详情：${item.currentHasDetail ? "已补" : "未补"} · 备份详情：${item.backupHasDetail ? "已补" : "未补"}</p>`;
      const diff = item.differences.map((entry) =>
        `<p class="restore-diff"><b>${esc(restoreFieldLabel(entry.field))}</b><br>当前：${esc(restoreValueText(entry.current, entry.field, entry.backup))}<br>备份：${esc(restoreValueText(entry.backup, entry.field, entry.current))}</p>`,
      ).join("");
      return `<details class="restore-item"><summary><strong>${esc(item.title || "无标题文章")}</strong>${statusText[item.status]}${item.differences.length ? ` · ${item.differences.length} 个字段` : ""}</summary>
        ${lines}${diff}<p class="restore-link">文章链接：${esc(item.link)}</p></details>`;
    }).join("") : '<p class="restore-note">没有符合此分类的文章</p>';
    ui.restorePageLabel.textContent = items.length
      ? `${ui.restorePage + 1} / ${pages} 页 · ${items.length} 篇`
      : "0 篇";
    ui.restorePrev.disabled = ui.restorePage === 0;
    ui.restoreNext.disabled = ui.restorePage >= pages - 1;
  }

  function previewBackupRestore() {
    if (!ui || !ui.backupCandidate) return;
    const context = accountContext();
    clearRestorePreview();
    try {
      // 每次预览重读原库，不能沿用选文件时或上次预览的库快照。
      const snapshot = createAccountBackup();
      const plan = planBackupRestore(ui.backupCandidate, snapshot);
      if (!sameAccountContext(context)) return;
      ui.restorePreview.hidden = false;
      if (!plan.eligible) {
        ui.restoreSummary.textContent = "无法预览恢复";
        ui.restoreNote.textContent = plan.errors.join("\n");
        return;
      }
      ui.restorePlan = plan;
      if (ui.restoreDetails) ui.restoreDetails.hidden = false;
      ui.restoreSnapshot = snapshot;
      ui.restoreSourceText = JSON.stringify(ui.backupCandidate);
      ui.restoreFilter.disabled = false;
      const s = plan.summary;
      ui.restoreSummary.textContent = [
        `当前 ${s.currentCount} 篇 · 备份文章库 ${s.backupCount} 篇`,
        `将新增 ${s.addCount} 篇 · 已有 ${s.existingCount} 篇保持当前内容`,
        `当前库独有的 ${s.currentCount - s.existingCount} 篇也会保留`,
        `已有文章中 ${s.changedCount} 篇有差异、${s.unchangedCount} 篇一致`,
        `标签差异 ${s.tagDiffCount} 篇 · 详情差异 ${s.detailDiffCount} 篇`,
        `按此范围补回后预计 ${s.resultCount} 篇`,
      ].join("\n");
      ui.restoreNote.textContent = [
        "本次仅预览，尚未写入任何文章。确认补回时只新增缺失文章，已有文章不会被备份覆盖。",
        `备份暂存 ${s.pendingCount} 篇、暂存更新 ${s.pendingUpdateCount} 条，不计入本次补回范围；当前抓取进度保持原样。`,
        "恢复前会保存并核验一份当前账号的保护副本，可单独下载；本地只保留最近一份。",
        "请先停止其他页面对本账号数据的抓取或编辑，再执行恢复。",
        `预览时间：${new Date().toLocaleString("zh-CN", { hour12: false })}。文章库变化后请重新预览。`,
      ].join("\n");
      ui.backupPreviewButton.textContent = "重新预览恢复";
      if (ui.restoreApplyButton) {
        ui.restoreApplyButton.hidden = !s.addCount;
        ui.restoreApplyButton.disabled = running || !s.addCount;
        ui.restoreApplyButton.textContent = `补回 ${s.addCount} 篇缺失文章`;
      }
      if (running) ui.restoreNote.textContent += "\n抓取或修复任务进行中，请停止任务后重新预览。";
      renderRestoreItems();
      ui.restorePreview.scrollIntoView({ block: "nearest" });
    } catch (err) {
      // 不把损坏/读取失败的当前库当成空库，避免误报全部可新增。
      if (!sameAccountContext(context)) return;
      ui.restorePreview.hidden = false;
      ui.restoreSummary.textContent = "无法预览恢复";
      ui.restoreNote.textContent = String(err.message || err);
    }
  }

  function renderBackupOverview(result) {
    if (!ui || !ui.dataManager) return;
    ui.backupAccount.textContent = `当前账号：${accountTitle(acct)}`;
    try {
      const checked = result || validateBackup(createAccountBackup(), acct.id);
      if (!checked.valid) throw new Error(checked.errors.join("；"));
      const s = checked.summary;
      const lines = [`文章库 ${s.articleCount} 篇 · 已补详情 ${s.detailCount} 篇`];
      if (s.earliest) lines.push(`发布日期 ${s.earliest}—${s.latest}`);
      lines.push(`抓取暂存 ${s.pendingCount} 篇 · 暂存更新 ${s.pendingUpdateCount} 篇`);
      lines.push(`备份大小约 ${backupSizeLabel(s.bytes)}`);
      ui.backupSummary.textContent = lines.join("\n");
      ui.backupNote.textContent = checked.warnings.join("\n");
    } catch (err) {
      ui.backupSummary.textContent = "暂时无法读取备份概况";
      ui.backupNote.textContent = String(err.message || err);
    }
    renderRestoreSafetyOverview();
  }

  function renderRestoreSafetyOverview() {
    if (!ui || !ui.restoreSafety) return;
    ui.restoreSafety.hidden = true;
    ui.restoreSafetyDownload.disabled = true;
    try {
      const safety = readRestoreSafety();
      if (!safety) return;
      ui.restoreSafety.hidden = false;
      ui.restoreSafetyNote.textContent = `恢复前副本：${new Date(safety.exportedAt).toLocaleString("zh-CN", { hour12: false })}，文章库 ${safety.library.rows.length} 篇。\n本地保留最近一份，下载后可另行保存；副本不提供自动撤销。`;
      ui.restoreSafetyDownload.disabled = false;
    } catch (err) {
      ui.restoreSafety.hidden = false;
      ui.restoreSafetyNote.textContent = `恢复前副本暂不可用：${err.message || err}`;
    }
  }

  function refreshAfterRestore() {
    // 展示可以兼容旧时间字段，本次刷新不再额外迁移落盘。
    const previous = suppressReadMigration;
    suppressReadMigration = true;
    try { return refresh(); }
    finally { suppressReadMigration = previous; }
  }

  function confirmBackupRestore() {
    if (!ui || !ui.backupCandidate || !ui.restorePlan || !ui.restoreSnapshot) return;
    const owner = ui;
    const context = accountContext();
    const source = ui.restoreSourceText;
    const expected = ui.restoreSnapshot;
    const count = ui.restorePlan.summary.addCount;
    if (!count) return;
    if (running) {
      ui.restoreNote.textContent = "抓取或修复任务进行中，请停止任务后重新预览。";
      if (ui.restoreApplyButton) ui.restoreApplyButton.disabled = true;
      return;
    }
    if (!sameAccountContext(context)) { resetBackupPanel(); return; }
    if (!confirm(`向“${accountTitle(acct)}”补回 ${count} 篇缺失文章？\n\n已有文章、标签、详情和当前抓取进度保持原样。\n写入前会保存并核验恢复前副本；仅保留最近一份，可单独下载。\n\n请先停止其他页面对本账号数据的抓取或编辑。`)) return;
    if (ui !== owner || !sameAccountContext(context)) return;
    // 确认期间选项或预览失效时，不能使用已撤销的计划。
    if (ui.restoreSnapshot !== expected || source !== ui.restoreSourceText
        || source !== JSON.stringify(ui.backupCandidate)) return;
    let result;
    try {
      if (ui.restoreApplyButton) ui.restoreApplyButton.disabled = true;
      result = applyBackupRestore(source, expected);
    } catch (err) {
      if (!sameAccountContext(context)) { resetBackupPanel(); return; }
      clearRestorePreview();
      ui.restorePreview.hidden = false;
      ui.restoreSummary.textContent = err.restoreUncertain ? "恢复结果尚未确认" : "恢复已停止";
      if (ui.restoreHeading) ui.restoreHeading.textContent = "恢复未完成";
      ui.restoreNote.textContent = String(err.message || err);
      renderRestoreSafetyOverview();
      return;
    }
    if (!sameAccountContext(context)) { resetBackupPanel(); return; }
    clearRestorePreview();
    ui.restorePreview.hidden = false;
    ui.restoreSummary.textContent = result.added
      ? `已补回 ${result.added} 篇文章，当前共 ${result.total} 篇`
      : `没有需要补回的文章，当前共 ${result.total} 篇`;
    if (ui.restoreHeading) ui.restoreHeading.textContent = "恢复完成";
    ui.backupResult.hidden = true;
    ui.restoreNote.textContent = "已有文章和抓取进度保持原样。可下载恢复前副本另行保存。";
    // 写入已核验成功；界面刷新失败不能被误报为恢复失败。
    try {
      if (refreshAfterRestore() === false) ui.restoreNote.textContent += "\n文章列表暂未刷新，请刷新页面查看。";
    } catch (_) {
      ui.restoreNote.textContent += "\n文章列表暂未刷新，请刷新页面查看。";
    }
    renderBackupOverview();
  }

  function showBackupValidation(text, kind = "") {
    ui.backupResult.textContent = text;
    ui.backupResult.className = "backup-result" + (kind ? ` ${kind}` : "");
    ui.backupResult.hidden = false;
  }

  async function onBackupFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !ui) return;
    const owner = ui;
    const context = accountContext();
    const serial = ++owner.backupReadSerial;
    const isCurrent = () => ui === owner && serial === owner.backupReadSerial
      && sameAccountContext(context);
    clearRestorePreview(true);
    // 只保留本次文件对象，允许用户再次选择同一个文件。
    try { e.target.value = ""; } catch (_) { /* 不影响本次文件读取 */ }
    showBackupValidation(`正在校验：${file.name}`);
    try {
      const text = await readFileText(file);
      // 切号、关闭面板或后来选中的文件都使旧异步结果失效。
      if (!isCurrent()) return;
      const result = validateBackup(text, context.id);
      if (!result.valid) {
        showBackupValidation(
          `${file.name}\n校验未通过\n${result.errors.slice(0, 8).join("\n")}`,
          "bad",
        );
        return;
      }
      const s = result.summary;
      const lines = [
        `${file.name}\n校验通过`,
        `备份账号：${s.accountName}（${s.accountId}）`,
        `备份时间：${new Date(s.exportedAt).toLocaleString("zh-CN", { hour12: false })}`,
        `文章库 ${s.articleCount} 篇 · 有标签 ${s.taggedCount} 篇 · 已补详情 ${s.detailCount} 篇`,
        `抓取暂存 ${s.pendingCount} 篇 · 暂存更新 ${s.pendingUpdateCount} 篇`,
        `文件大小 ${backupSizeLabel(s.bytes)}`,
        ...result.warnings.slice(0, 6),
        "本次文件校验未修改文章库",
      ];
      showBackupValidation(lines.join("\n"), result.warnings.length ? "warn" : "");
      const candidate = JSON.parse(text.replace(/^\uFEFF/, ""));
      if (!acct.known || !candidate.account.known || candidate.account.id !== context.id) {
        showBackupValidation(lines.concat("恢复预览仅支持当前已识别账号的备份").join("\n"), "warn");
        return;
      }
      ui.backupCandidate = candidate;
      if (ui.backupPreviewButton) {
        ui.backupPreviewButton.hidden = false;
        ui.backupPreviewButton.disabled = false;
      }
    } catch (err) {
      if (isCurrent()) showBackupValidation(`校验失败：${err.message || err}`, "bad");
    }
  }

  function withStorageFeedback(action, scope) {
    try {
      return action();
    } catch (err) {
      if (err.name !== "StorageError") throw err;
      console.error("[公众号数据] 数据读取失败", err);
      if (ui) {
        ui.storageReadFailed = true;
        say(String(err.message || err), "err", scope || currentStatusScope());
      }
      return false;
    }
  }

  function refresh() {
    return withStorageFeedback(() => {
      refreshView();
      if (ui) ui.storageReadFailed = false;
      return true;
    });
  }

  function refreshView() {
    if (!ui || dragLock) return;
    if (ui.finishMorph) ui.finishMorph();
    const L = lib.read();
    if (ui.restoreApplyButton && ui.restorePlan)
      ui.restoreApplyButton.disabled = running || !ui.restorePlan.summary.addCount;
    const missingDetails = L.rows.filter((r) => !r._detail).length;
    const missingDates = L.rows.filter(needsDateRepair).length;
    const pend = lib.pending().length;

    // 标题始终显示当前账号；识别失败时正文继续给出数据归属警告。
    const title = accountTitle(acct);
    ui.title.textContent = title;
    ui.title.title = title;
    ui.acct.style.display = acct.known ? "none" : "";
    ui.acct.innerHTML = acct.known
      ? ""
      : '<span class="unknown">⚠ 没认出当前账号，数据会存进公共库；切号后可能混在一起</span>';

    // 分库之前留下的「无主」数据：只提示，不自动认领 ——
    // 万一升级时正好停在另一个号上，自动认领就把数据记错账了
    // 只要还有无主数据、且这个号没说过「忽略」，就一直提示 ——
    // 早先只在「当前库为空」时才提示，结果随手抓一次之后提示就永远消失，
    // 那批数据等于被锁死了，谁也认领不了。
    const legacy = legacyLib();
    const dismissed = rawRead(dismissKey(), "") === "1";

    if (legacy && dismissed) {
      // 忽略过，但数据还躺在那儿 —— 必须留个入口，
      // 否则点一次「忽略」这批数据就再也找不回来了
      ui.claimTxt.innerHTML = `还有一份未归属的旧数据（<b>${legacy.rows.length}</b> 篇）被忽略了。`;
      ui.claimYes.style.display = "none";
      ui.claimNo.style.display = "none";
      ui.claimShow.style.display = "";
      ui.claim.style.display = "";
    } else if (legacy) {
      ui.claimYes.style.display = "";
      ui.claimNo.style.display = "";
      ui.claimShow.style.display = "none";
      const r = legacy.rows;
      // 把最新两篇标题亮出来 —— 一眼就能认出这批数据属于哪个号，
      // 比让人凭记忆判断可靠得多（认错了就把 A 号的数据记到 B 号名下了）
      const sample = r
        .slice(0, 2)
        .map((x) => String(x.标题 || "").trim())
        .filter(Boolean)
        .map((t) => `「${esc(t.length > 20 ? t.slice(0, 20) + "…" : t)}」`);
      ui.claimTxt.innerHTML =
        `发现一份没有账号归属的旧文章库（<b>${r.length}</b> 篇，` +
        `${esc(r[r.length - 1].发布日期)} → ${esc(r[0].发布日期)}）。` +
        (sample.length ? `<br>里面是：${sample.join("、")}` : "") +
        `<br>这些是「<b>${esc(acct.name)}</b>」发的吗？` +
        (L.rows.length
          ? `是就并进当前的 ${L.rows.length} 篇里（按链接去重），`
          : "是就归入，") +
        `不是就先忽略，切到对应的号时还会再问。`;
      ui.claim.style.display = "";
    } else {
      ui.claim.style.display = "none";
    }

    const warns = [];

    // 页面在搜索/筛选状态时提醒一下：抓取会自动忽略它，用完整列表
    const extra = listExtraParams();
    if (extra.length) {
      warns.push(
        "⚠ 发表记录页当前带着筛选条件（" +
          esc(extra.join(", ")) +
          "）。" +
          "抓取会自动忽略它、按完整列表来。想让页面和插件看到的一致，把搜索框清空。",
      );
    }

    if (warns.length) {
      ui.warn.innerHTML = warns.join("<br><br>");
      ui.warn.style.display = "";
    } else {
      ui.warn.style.display = "none";
    }

    ui.modeBtns.forEach((b) => {
      const selected = b.getAttribute("data-mode") === mode;
      b.classList.toggle("on", selected);
      b.setAttribute("aria-pressed", String(selected));
      b.disabled = running && activeRun === "list";
    });
    ui.dateRow.style.display = mode === "inc" ? "none" : "";

    ui.pending.textContent = !missingDetails
      ? "所有文章的详情都齐了"
      : pend === missingDetails
        ? `${pend} 篇还没补详情`
        : `${missingDetails} 篇缺详情 · ${pend} 篇可补`;
    ui.listBtn.disabled = running && activeRun !== "list";
    ui.detailBtn.disabled = running ? activeRun !== "detail" : !pend;
    ui.speed.disabled =
      running && (activeRun === "detail" || activeRun === "refresh-sel");
    ui.dateRepairRow.style.display =
      missingDates || activeRun === "repair-dates" ? "" : "none";
    ui.dateRepairBtn.disabled = running && activeRun !== "repair-dates";
    ui.dateRepairBtn.textContent =
      activeRun === "repair-dates"
        ? "停止修复"
        : `修复 ${missingDates} 篇缺日期文章`;

    ui.count.textContent = String(L.rows.length);

    // 选中的文章可能已经被清库删掉了，清理一下
    if (sel.size) {
      const live = new Set(L.rows.map((r) => r.链接));
      for (const k of [...sel]) if (!live.has(k)) sel.delete(k);
    }

    renderTagFilter();
    renderRows();
    const n = scopeRows().length;
    ui.copy.disabled = ui.csv.disabled = !n;
    ui.copy.textContent = n ? `复制 ${n} 篇` : "复制";
    ui.csv.textContent = n ? `导出 ${n} 篇` : "导出 CSV";

    renderCols(sampleRow());
    renderResume();
    renderPresets();
    updateImpApply();
    sizeGrabViewport();
  }

  function renderCols(sample) {
    const picked = cfg.read().sum;
    const out = [];
    for (const { c, on } of orderedSchema()) {
      const v = cellOf(sample, c);
      const cls = "crow" + (c.calc ? " calc" : "") + (on ? "" : " off");
      let chip = "";
      if (c.col === "平均阅读时长") {
        chip = `<button class="chip" data-act="dur-unit" title="在 秒 / 分钟 之间切换">${esc(durUnit())}</button>`;
      } else if (c.col === "互动量") {
        chip = `<button class="chip" data-act="sum-edit" title="${esc(sumCols().join(" + ") || "未选任何项")}">${sumCols().length} 项 ${sumOpen ? "▴" : "▾"}</button>`;
      }
      const tag = c.detail ? '<span class="tag">详情</span>' : "";
      out.push(`<div class="${cls}" data-col="${esc(c.col)}">
          <span class="grip" title="按住上下拖动调整顺序">⠿</span>
          <input type="checkbox" class="ck" data-col="${esc(c.col)}"${on ? " checked" : ""} title="勾选才导出">
          <span class="cn">${esc(headerName(c))}${tag}</span>
          <span class="cv${v === "" ? " miss" : ""}" title="${esc(v)}">${v === "" ? "—" : esc(v)}</span>
          ${chip}
        </div>`);

      if (c.col === "互动量" && sumOpen) {
        const ops = EXPORT_SCHEMA.filter((x) => x.sumable)
          .map(
            (x) =>
              `<label><input type="checkbox" class="sk" data-col="${esc(x.col)}"${picked.indexOf(x.col) >= 0 ? " checked" : ""}>${esc(x.col)}</label>`,
          )
          .join("");
        out.push(`<div class="sub"><div class="h">互动量 = 勾选项相加</div>
            <div class="ops">${ops}</div></div>`);
      }
    }
    ui.cols.innerHTML = out.join("");
  }

  function createTagFilter() {
    return { tags: new Set(), detail: "all", untagged: false };
  }

  function updateTagFilter(filter, kind, value, checked = true) {
    const next = { ...filter, tags: new Set(filter.tags) };
    if (kind === "tag" && typeof value === "string" && value) {
      if (checked) {
        next.tags.add(value);
        next.untagged = false;
      } else next.tags.delete(value);
    } else if (kind === "untagged") {
      next.untagged = checked;
      if (checked) next.tags.clear();
    } else if (kind === "detail" && ["all", "yes", "no"].includes(value)) {
      next.detail = value;
    }
    return next;
  }

  function tagFilterKey(filter) {
    return JSON.stringify([[...filter.tags].sort(), filter.detail, filter.untagged]);
  }

  function rowMatchesTagFilter(row, filter) {
    if (filter.detail === "yes" && !row._detail) return false;
    if (filter.detail === "no" && row._detail) return false;
    const tags = row._tags || [];
    if (filter.untagged) return tags.length === 0;
    return !filter.tags.size || tags.some((tag) => filter.tags.has(tag));
  }

  function tagMatchesSearch(tag, query) {
    return customTagLabel(tag).toLowerCase().includes(query.trim().toLowerCase());
  }

  function renderTagFilterButton() {
    const { tags, detail, untagged } = ui.tagFilter;
    const detailLabel = detail === "yes" ? "有详情" : detail === "no" ? "无详情" : "";
    let label = untagged ? "无自定义标签"
      : tags.size > 1 ? `已选 ${tags.size} 个标签`
        : tags.size ? customTagLabel([...tags][0]) : "标签不限";
    if (detailLabel) label = label === "标签不限" ? detailLabel : `${label} · ${detailLabel}`;
    const description = [
      untagged ? "无自定义标签" : tags.size ? [...tags].map(customTagLabel).join("、") : "标签不限",
      detailLabel,
    ].filter(Boolean).join("；");
    ui.tagFilterLabel.textContent = label;
    ui.tagFilterButton.title = description;
    ui.tagFilterButton.setAttribute("aria-label", `标签筛选：${description}`);
    ui.tagFilterButton.classList.toggle("active", !!(tags.size || untagged || detailLabel));
    ui.tagUntagged.checked = untagged;
    ui.tagDetails.forEach((input) => { input.checked = input.value === detail; });
    ui.tagSelectedCount.textContent = tags.size ? `已选 ${tags.size} 个` : "";
  }

  // 搜索只缩小候选列表，不改文章筛选或已选标签。
  function renderTagChoices() {
    const tags = ui.availableTags.filter((tag) => tagMatchesSearch(tag, ui.tagSearch.value));
    const key = JSON.stringify(tags);
    if (key !== ui.tagOptionsKey) {
      ui.tagOptionsKey = key;
      ui.tagOptions.innerHTML = tags.length
        ? tags.map((tag) => `<label class="tag-option" title="${esc(customTagLabel(tag))}">
            <input type="checkbox" data-tag-option value="${esc(tag)}"><span>${esc(customTagLabel(tag))}</span>
          </label>`).join("")
        : '<div class="tag-empty" role="status">没有匹配的标签</div>';
      ui.tagOptions.scrollTop = 0;
    }
    ui.tagOptions.querySelectorAll("[data-tag-option]").forEach((input) => {
      input.checked = ui.tagFilter.tags.has(input.value);
    });
  }

  function onTagFilterChange(e) {
    const input = e.target;
    let kind;
    if (input.matches("[data-tag-option]")) kind = "tag";
    else if (input.matches("[data-tag-untagged]")) kind = "untagged";
    else if (input.matches("[data-tag-detail]") && input.checked) kind = "detail";
    if (!kind) return;
    ui.tagFilter = updateTagFilter(ui.tagFilter, kind, input.value, input.checked);
    refresh();
  }

  function onTagFilterKeydown(e) {
    if (e.isComposing) return;
    const options = [...ui.tagOptions.querySelectorAll("[data-tag-option]")];
    if (e.target === ui.tagSearch && (e.key === "ArrowDown" || e.key === "Enter")) {
      if (!options.length) return;
      e.preventDefault();
      options[0].focus();
      if (e.key === "Enter") options[0].click();
      return;
    }
    const index = options.indexOf(e.target);
    if (index >= 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const next = index + (e.key === "ArrowDown" ? 1 : -1);
      if (next < 0) ui.tagSearch.focus();
      else options[Math.min(next, options.length - 1)].focus();
    } else if (e.key === "Enter" && e.target.matches("[data-tag-option], [data-tag-untagged]")) {
      e.preventDefault();
      e.target.click();
    }
  }

  function openTagFilterPanel() {
    closeDateFilterPanel();
    setTagImportOpen(false);
    if (!ui.dataManager.hidden) resetBackupPanel();
    ui.tagSearch.value = "";
    renderTagFilter();
    ui.tagFilterPanel.hidden = false;
    ui.tagFilterButton.setAttribute("aria-expanded", "true");
    ui.tagFilterPanel.scrollTop = 0;
    ui.tagSearch.focus({ preventScroll: true });
  }

  function closeTagFilterPanel(restoreFocus = false) {
    ui.tagFilterPanel.hidden = true;
    ui.tagFilterButton.setAttribute("aria-expanded", "false");
    ui.tagSearch.value = "";
    if (restoreFocus) ui.tagFilterButton.focus({ preventScroll: true });
  }

  function resetTagFilter() {
    closeTagFilterPanel();
    ui.tagFilter = createTagFilter();
    ui.availableTags = [];
    ui.tagOptionsKey = null;
    renderTagFilterButton();
    renderTagChoices();
  }

  /** 当前筛选出来的文章 */
  function filtered() {
    const kw = (ui.q.value || "").trim().toLowerCase();
    const startKey = publicationDateKey(ui.dateRange.start);
    const endKey = publicationDateKey(ui.dateRange.end);
    return lib.read().rows.filter((r) => {
      if (!rowInDateRange(r, startKey, endKey)) return false;
      if (
        kw &&
        String(r.标题 || "")
          .toLowerCase()
          .indexOf(kw) < 0
      )
        return false;
      return rowMatchesTagFilter(r, ui.tagFilter);
    });
  }

  /**
   * 导出 / 复制 的作用范围：
   *   勾了行 → 只要勾的那些
   *   没勾但有筛选 → 筛选结果
   *   都没有 → 全库
   * 这样「筛完直接导出」是顺手的，不用先全选一遍。
   */
  function scopeRows() {
    const rows = lib.read().rows;
    if (sel.size) return rows.filter((r) => sel.has(r.链接));
    return filtered();
  }

  function renderTagFilter() {
    ui.availableTags = lib.allTags();
    const available = new Set(ui.availableTags);
    ui.tagFilter.tags = new Set([...ui.tagFilter.tags].filter((tag) => available.has(tag)));
    renderTagFilterButton();
    renderTagChoices();
  }

  function renderRows() {
    const rows = filtered();
    const total = lib.read().rows.length;
    const { earliest, latest } = dateBounds(rows);
    ui.rowSummary = `共 ${rows.length} 篇${earliest ? `（${earliest}—${latest}）` : ""}`;
    if (rows.length !== ui.virtualRows.length ||
        rows.some((row, index) => row.链接 !== ui.virtualRows[index].链接))
      ui.selectionAnchor = null;
    ui.virtualRows = rows;
    ui.filteredLinks = new Set(rows.map((row) => row.链接));
    const filterKey = JSON.stringify([
      acct.id,
      (ui.q.value || "").trim().toLowerCase(),
      tagFilterKey(ui.tagFilter),
      ui.dateRange.start,
      ui.dateRange.end,
    ]);
    if (filterKey !== ui.rowFilterKey) {
      ui.selectionAnchor = null;
      ui.rowFilterKey = filterKey;
      ui.list.scrollTop = 0;
    }
    updateRowActions();

    if (!rows.length) {
      ui.rowWindowStart = ui.rowWindowEnd = -1;
      ui.list.innerHTML = `<div class="more">${total ? "没有符合条件的文章" : "文章库还是空的"}</div>`;
      return;
    }
    renderRowWindow(true);
  }

  function updateRowActions() {
    const hiddenSelected = [...sel].filter(
      (link) => !ui.filteredLinks.has(link),
    ).length;
    ui.selectionHint.textContent = hiddenSelected
      ? `已勾选 ${hiddenSelected} 篇不在当前筛选结果内；对已勾选文章的操作仍包含它们。`
      : "";
    ui.selectionHint.hidden = !hiddenSelected;
    ui.selInfo.textContent = ui.rowSummary;
    ui.selInfo.title = "";
    ui.refreshBtn.disabled = running ? activeRun !== "refresh-sel" : !sel.size;
    ui.refreshBtn.textContent =
      activeRun === "refresh-sel"
        ? "停止"
        : sel.size
          ? `刷新详情数 ${sel.size} 篇`
          : "刷新详情数";
    ui.liveBtn.disabled = running ? activeRun !== "refresh-live" : !sel.size;
    ui.liveBtn.textContent =
      activeRun === "refresh-live"
        ? "停止"
        : sel.size
          ? `刷新实时数 ${sel.size} 篇`
          : "刷新实时数";
    ui.tagBtn.disabled = !sel.size;
    const n = sel.size || ui.virtualRows.length;
    ui.copy.disabled = ui.csv.disabled = !n;
    ui.copy.textContent = n ? `复制 ${n} 篇` : "复制";
    ui.csv.textContent = n ? `导出 ${n} 篇` : "导出 CSV";
    const scopeTip = sel.size
      ? hiddenSelected
        ? "勾选文章，包含当前筛选外的勾选"
        : "勾选文章"
      : "当前筛选结果";
    ui.copy.title = `复制${scopeTip}`;
    ui.csv.title = `导出${scopeTip}`;
  }

  function renderRowWindow(force = false) {
    const rows = ui.virtualRows;
    if (!rows.length) return;
    const list = ui.list;
    // 隐藏时先保留一小段行，显示或尺寸变化后由 ResizeObserver 补齐。
    const viewport = Math.max(list.clientHeight, ROW_HEIGHT);
    const visible = Math.ceil(viewport / ROW_HEIGHT);
    const start = Math.max(
      0,
      Math.min(
        Math.floor(list.scrollTop / ROW_HEIGHT) - ROW_OVERSCAN,
        rows.length - visible - ROW_OVERSCAN * 2,
      ),
    );
    const end = Math.min(rows.length, start + visible + ROW_OVERSCAN * 2);
    if (!force && start === ui.rowWindowStart && end === ui.rowWindowEnd)
      return;
    ui.rowWindowStart = start;
    ui.rowWindowEnd = end;

    const active = ui.root.activeElement;
    const focusedRow = active && active.closest && active.closest(".it");
    const focusedLink = focusedRow ? active.getAttribute("data-link") : "";
    const focusedIndex = focusedLink
      ? rows.findIndex((row) => row.链接 === focusedLink)
      : -1;
    const focusedSelector = active?.classList.contains("t") ? ".t" : ".rk";
    if (focusedRow && (focusedIndex < start || focusedIndex >= end)) {
      list.focus({ preventScroll: true });
    }
    const shown = rows.slice(start, end);
    const scrollTop = list.scrollTop;
    list.innerHTML =
      `<div aria-hidden="true" style="height:${start * ROW_HEIGHT}px"></div>` +
      shown
        .map((r, offset) => {
          const index = start + offset;
          const on = sel.has(r.链接);
          const tags = (r._tags || [])
            .map((t) => "#" + customTagLabel(t))
            .join(" ");
          const title = esc(r.标题 || "(无标题)");
          return `<div class="it${fresh.has(r.链接) ? " new" : ""}${on ? " sel" : ""}"
         data-index="${index}" role="listitem" aria-posinset="${index + 1}" aria-setsize="${rows.length}">
         <input type="checkbox" class="rk" data-link="${esc(r.链接)}" aria-label="选择文章：${title}"${on ? " checked" : ""}>
         <span class="d">${esc(r.发布日期)}</span>
         <span class="t" data-link="${esc(r.链接)}" title="${title}" role="link" tabindex="0">${title}</span>
         ${tags ? `<span class="tags" title="${esc(tags)}">${esc(tags)}</span>` : ""}
         ${r._detail ? "" : '<span class="flag no" title="还没补详情">无详情</span>'}
         ${r._detail && r._collectionStatus === "missing" ? '<span class="flag no" title="本次详情未返回有效收藏值，已有值保持不变；可勾选后刷新详情数">收藏待核查</span>' : ""}
      </div>`;
        })
        .join("") +
      `<div aria-hidden="true" style="height:${(rows.length - end) * ROW_HEIGHT}px"></div>`;
    if (list.scrollTop !== scrollTop) list.scrollTop = scrollTop;
    if (focusedIndex >= start && focusedIndex < end) {
      list
        .querySelector(`.it[data-index="${focusedIndex}"] ${focusedSelector}`)
        ?.focus({ preventScroll: true });
    }
  }

  function focusVirtualRow(index, selector) {
    const rows = ui.virtualRows;
    if (!rows.length) return;
    const next = Math.max(0, Math.min(rows.length - 1, index));
    const list = ui.list;
    const top = next * ROW_HEIGHT;
    const viewport = list.clientHeight || ROW_HEIGHT;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + ROW_HEIGHT > list.scrollTop + viewport) {
      list.scrollTop = top + ROW_HEIGHT - viewport;
    }
    renderRowWindow(true);
    list
      .querySelector(`.it[data-index="${next}"] ${selector}`)
      ?.focus({ preventScroll: true });
  }

  function onListKeydown(e) {
    const target = e.target.closest(".rk, .t");
    if (target?.classList.contains("t") && e.key === "Enter") {
      e.preventDefault();
      target.click();
      return;
    }
    if (e.target !== ui.list && !target) return;
    const rows = ui.virtualRows;
    if (!rows.length) return;
    const current = target
      ? Number(target.closest(".it").getAttribute("data-index"))
      : Math.floor(ui.list.scrollTop / ROW_HEIGHT);
    const page = Math.max(
      1,
      Math.floor(ui.list.clientHeight / ROW_HEIGHT),
    );
    let next;
    if (e.key === "ArrowDown") next = target ? current + 1 : current;
    else if (e.key === "ArrowUp") next = target ? current - 1 : current;
    else if (e.key === "PageDown") next = current + page;
    else if (e.key === "PageUp") next = current - page;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = rows.length - 1;
    else return;
    e.preventDefault();
    focusVirtualRow(next, target?.classList.contains("t") ? ".t" : ".rk");
  }

  function applyRowSelection(link, checked, shiftKey = false) {
    if (!ui || !link) return { range: false, count: 0 };
    const rows = ui.virtualRows || [];
    const anchorIndex = ui.selectionAnchor == null ? -1
      : rows.findIndex((row) => row.链接 === ui.selectionAnchor);
    const clickedIndex = rows.findIndex((row) => row.链接 === link);
    const range = !!shiftKey && anchorIndex >= 0 && clickedIndex >= 0;
    const links = range
      ? rows.slice(Math.min(anchorIndex, clickedIndex), Math.max(anchorIndex, clickedIndex) + 1)
        .map((row) => row.链接)
      : [link];
    for (const selectedLink of links) {
      if (checked) sel.add(selectedLink);
      else sel.delete(selectedLink);
    }
    // 有效 Shift 连选沿用原锚点；普通点击或失效锚点从本次文章重新开始。
    if (!range) ui.selectionAnchor = link;
    return { range, count: links.length };
  }

  function onRowCheck(e) {
    const box = e.target.closest(".rk");
    if (!box || !ui) return;
    applyRowSelection(box.getAttribute("data-link"), box.checked, e.shiftKey);
    // 只同步当前渲染的行，不重建列表，保留焦点和滚动位置；未渲染行由 sel 驱动。
    ui.list.querySelectorAll(".rk").forEach((visibleBox) => {
      const selected = sel.has(visibleBox.getAttribute("data-link"));
      visibleBox.checked = selected;
      visibleBox.closest(".it").classList.toggle("sel", selected);
    });
    updateRowActions();
  }

  /* ---- 标签 JSON 导入 ---- */
  function invalidatePlan() {
    impPlan = null;
    if (!ui) return;
    ui.impPrev.style.display = "none";
    updateImpApply();
  }

  /** 让动作按钮自己把「点下去会发生什么」说清楚 */
  function updateImpApply() {
    if (!ui) return;
    const n = impPlan ? impPlan.affected : 0;
    ui.impApply.disabled = !n;
    ui.impApply.textContent = n
      ? `${impMode === "replace" ? "覆盖" : "追加"}导入到 ${n} 篇`
      : "导入（先粘贴或选文件）";
    ui.impHint.textContent = n ? "" : "";
  }

  /** 读文件文本。优先 Blob.text()，绕开 FileReader 在某些油猴沙箱里的怪毛病 */
  function readFileText(f) {
    if (typeof f.text === "function") return f.text();
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(fr.error || new Error("读取失败"));
      try {
        fr.readAsText(f, "utf-8");
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * 选了文件。每一步都要么成功、要么出声——
   * 之前这里把重置 input 和触发预览写在同一个回调里，重置那行一抛错，
   * 预览就跟着没了，而且 FileReader 回调里的异常不会冒出来，表现就是「毫无反应」。
   */
  async function onImpFile(e) {
    const input = e.target;
    const f = input.files && input.files[0];
    if (!f) return;
    const context = accountContext();

    say(`正在读取 ${f.name}…`, "progress", "rows");
    let text = "";
    try {
      text = await readFileText(f);
    } catch (err) {
      if (!sameAccountContext(context)) return;
      say(
        `读不出这个文件：${(err && err.message) || err}。可以打开文件把内容直接粘到上面的框里`,
        "err",
        "rows",
      );
      return;
    }
    if (!sameAccountContext(context)) return;

    ui.impText.value = text;
    // 重置 input 只是为了「同一个文件能再选一次」，失败了无所谓，不能影响后面
    try {
      input.value = "";
    } catch (err) {
      /* 有些环境不让重置 */
    }

    say(`已读入 ${f.name}（${text.length} 字符）`, "ok", "rows");
    try {
      doImpPreview();
    } catch (err) {
      showImpPrev("预览时出错：" + esc((err && err.message) || err), true);
    }
  }

  function doImpPreview() {
    return withStorageFeedback(buildImpPreview, "rows");
  }

  function buildImpPreview() {
    invalidatePlan();
    const text = (ui.impText.value || "").trim();
    if (!text) {
      showImpPrev("先粘贴 JSON，或者选一个 .json 文件", true);
      return;
    }

    const parsed = parseTagJson(text);
    if (parsed.error) {
      showImpPrev(esc(parsed.error), true);
      return;
    }

    const plan = planTagImport(parsed.entries);
    impPlan = plan;

    const lines = [];
    lines.push(
      `解析出 <b>${plan.entries}</b> 条，能对上 <b>${plan.affected}</b> 篇文章` +
        `（${impMode === "replace" ? "覆盖已有标签" : "追加到已有标签"}）`,
    );
    if (plan.fuzzy)
      lines.push(
        `<span class="warn">${plan.fuzzy} 条是靠标题模糊匹配的，建议核对</span>`,
      );
    if (plan.dup)
      lines.push(
        `<span class="warn">${plan.dup} 条标题在库里重名，会同时打给多篇</span>`,
      );
    if (plan.ambiguous.length) {
      lines.push(
        `<span class="warn">${plan.ambiguous.length} 条有歧义、已跳过：</span>`,
      );
      plan.ambiguous.slice(0, 5).forEach((x) => lines.push("· " + esc(x)));
      if (plan.ambiguous.length > 5)
        lines.push(`· …另外 ${plan.ambiguous.length - 5} 条`);
    }
    if (plan.unmatched.length) {
      lines.push(
        `<span class="warn">${plan.unmatched.length} 条没匹配上：</span>`,
      );
      plan.unmatched.slice(0, 5).forEach((x) => lines.push("· " + esc(x)));
      if (plan.unmatched.length > 5)
        lines.push(`· …另外 ${plan.unmatched.length - 5} 条`);
    }
    showImpPrev(lines.join("<br>"), false);
    updateImpApply();
    if (plan.unmatched.length || plan.ambiguous.length) {
      console.log(
        "[公众号数据] 没匹配上的：",
        plan.unmatched,
        "有歧义的：",
        plan.ambiguous,
      );
    }
  }

  function showImpPrev(html, isErr) {
    ui.impPrev.innerHTML = html;
    ui.impPrev.className = "impprev" + (isErr ? " err" : "");
    ui.impPrev.style.display = "";
  }

  function renderResume() {
    const p = progress.read();
    const pages = Number(p && p.stat && p.stat.pages) || 0;
    if (!p || (!p.rows.length && !pages && !(Number(p.groups) > 0))) {
      ui.resume.style.display = "none";
      return;
    }
    const w = new Date(p.at || Date.now());
    const name =
      { inc: "增量更新", older: "补抓更早", full: "重新全抓" }[p.mode] ||
      "上次";
    ui.resumeTxt.textContent = `${name}中断：已翻 ${pages} 页 · 抓到 ${p.rows.length} 篇（${w.getMonth() + 1}/${w.getDate()} ${pad(w.getHours())}:${pad(w.getMinutes())}）`;
    ui.resume.style.display = "";
  }

  function cutoffTs() {
    const v = ui.since.value;
    if (!v) return 0;
    const [y, m, d] = v.split("-").map(Number);
    if (!y || !m || !d) return 0;
    return Math.floor(new Date(y, m - 1, d, 0, 0, 0).getTime() / 1000);
  }

  function planFor(m) {
    const L = lib.read();
    if (m === "inc")
      return {
        mode: "inc",
        startBegin: 0,
        stopAtTs: lib.newestTs(),
        cutoffTs: 0,
      };
    if (m === "older")
      return {
        mode: "older",
        startBegin: L.doneBegin || 0,
        stopAtTs: 0,
        cutoffTs: cutoffTs(),
      };
    return { mode: "full", startBegin: 0, stopAtTs: 0, cutoffTs: cutoffTs() };
  }

  /* ---- 事件 ---- */
  function sizeGrabViewport() {
    if (!ui) return;
    const pane = ui.grabPanels.find(
      (x) => x.getAttribute("data-grab-panel") === grabView,
    );
    const height = pane && pane.scrollHeight;
    if (height) ui.grabViewport.style.height = `${height}px`;
  }

  function selectGrabView(view) {
    if (!ui) return;
    const previous = grabView;
    grabView = view === "detail" ? "detail" : "list";
    rawWrite(UI_GRAB_VIEW_KEY, grabView);
    ui.grabSwitch.setAttribute("data-view", grabView);
    ui.grabViewport.setAttribute("data-view", grabView);
    ui.grabBtns.forEach((button) => {
      const selected = button.getAttribute("data-grab-view") === grabView;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    ui.grabPanels.forEach((panel) => {
      const selected = panel.getAttribute("data-grab-panel") === grabView;
      panel.inert = !selected;
      panel.setAttribute("aria-hidden", String(!selected));
    });
    if (previous !== grabView) ui.body.scrollTop = 0;
    sizeGrabViewport();
    renderStatus();
  }

  function selectTab(button) {
    const tab = button?.getAttribute("data-tab");
    if (!["grab", "cols", "rows"].includes(tab)) return;
    if (tab !== "rows" && !ui.dateFilterPanel.hidden) closeDateFilterPanel();
    if (tab !== "rows") closeTagFilterPanel();
    const previous = ui.tabs
      .find((x) => x.classList.contains("on"))
      ?.getAttribute("data-tab");
    if (previous && previous !== tab)
      ui.tabScroll[previous] = ui.body.scrollTop;
    ui.tabs.forEach((x) => {
      const active = x === button;
      x.classList.toggle("on", active);
      x.setAttribute("aria-selected", String(active));
      x.tabIndex = active ? 0 : -1;
    });
    ui.views.forEach((v) =>
      v.classList.toggle("hide", v.getAttribute("data-view") !== tab),
    );
    ui.activeTab = tab;
    ui.dataToggle.setAttribute("aria-expanded", String(tab === "rows" && !ui.dataManager.hidden));
    rawWrite(UI_ACTIVE_TAB_KEY, tab);
    renderStatus();
    ui.body.classList.toggle("cols-active", tab === "cols");
    ui.body.classList.toggle("rows-active", tab === "rows");
    if (previous !== tab) ui.body.scrollTop = ui.tabScroll[tab] || 0;
    if (tab === "grab") requestAnimationFrame(sizeGrabViewport);
  }

  function onGrabKeydown(e) {
    const button = e.target.closest("[data-grab-view]");
    if (!button) return;
    let next;
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "End")
      next = "detail";
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "Home")
      next = "list";
    else return;
    e.preventDefault();
    selectGrabView(next);
    ui.grabBtns
      .find((x) => x.getAttribute("data-grab-view") === next)
      .focus({ preventScroll: true });
  }

  function onTabKeydown(e) {
    const current = ui.tabs.indexOf(e.target.closest("[data-tab]"));
    if (current < 0) return;
    let next;
    if (e.key === "ArrowRight") next = (current + 1) % ui.tabs.length;
    else if (e.key === "ArrowLeft")
      next = (current - 1 + ui.tabs.length) % ui.tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ui.tabs.length - 1;
    else return;
    e.preventDefault();
    selectTab(ui.tabs[next]);
    ui.tabs[next].focus({ preventScroll: true });
  }

  // DOM 不会接住 async 事件处理器的拒绝；标签/认领等同步存储错误也在这里显示。
  async function onClick(e) {
    if (!ui) return;
    const context = accountContext();
    const scope = currentStatusScope();
    const wasRunning = running;
    try {
      await handleClick(e);
    } catch (err) {
      console.error("[公众号数据] 操作失败", err);
      if (!sameAccountContext(context)) return;
      // 启动任务时的 refresh 也可能读失败，不能留下永远“运行中”的按钮。
      if (!wasRunning && running) {
        stopDetailCrawl();
        running = false;
        activeRun = "";
        aborted = false;
      }
      say(String((err && err.message) || err), "err", scope);
    }
  }

  async function handleClick(e) {
    const b = e.target.closest(
      "[data-act], [data-tab], [data-grab-view], [data-mode], [data-days], .t",
    );
    if (!b) return;

    if (b.classList.contains("t")) {
      const link = b.getAttribute("data-link");
      if (link) {
        if (!articleLinkAllowed(link)) throw new Error("文章链接无效，仅支持完整的 HTTP 或 HTTPS 链接");
        window.open(link, "_blank", "noopener");
      }
      return;
    }
    const tab = b.getAttribute("data-tab");
    if (tab) {
      selectTab(b);
      return;
    }
    const grabTarget = b.getAttribute("data-grab-view");
    if (grabTarget) {
      selectGrabView(grabTarget);
      return;
    }
    const m = b.getAttribute("data-mode");
    if (m) {
      if (!running) {
        mode = m;
        refresh();
      }
      return;
    }
    const days = b.getAttribute("data-days");
    if (days != null) {
      if (days === "0") ui.since.value = "";
      else {
        const d = new Date();
        d.setDate(d.getDate() - Number(days) + 1); // 含今天在内共 N 天
        ui.since.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
      return;
    }

    const act = b.getAttribute("data-act");
    if (act === "tag-filter-toggle") {
      if (ui.tagFilterPanel.hidden) openTagFilterPanel();
      else closeTagFilterPanel(true);
      return;
    }
    if (act === "tag-filter-done") {
      closeTagFilterPanel(true);
      return;
    }
    if (act === "tag-filter-clear") {
      ui.tagFilter = createTagFilter();
      ui.tagSearch.value = "";
      refresh();
      ui.tagSearch.focus({ preventScroll: true });
      return;
    }
    if (act === "data-toggle") {
      closeTagFilterPanel();
      setTagImportOpen(false);
      if (ui.activeTab === "rows" && !ui.dataManager.hidden) {
        resetBackupPanel();
        ui.body.scrollTop = 0;
      }
      else {
        selectTab(ui.tabs.find((button) => button.getAttribute("data-tab") === "rows"));
        closeDateFilterPanel();
        ui.dataManager.hidden = false;
        ui.dataManager.scrollTop = 0;
        ui.dataToggle.setAttribute("aria-expanded", "true");
        renderBackupOverview();
        ui.body.scrollTop = 0;
      }
      return;
    }
    if (act === "backup-check") {
      ui.backupFile.click();
      return;
    }
    if (act === "backup-preview") {
      previewBackupRestore();
      return;
    }
    if (act === "restore-apply") {
      confirmBackupRestore();
      return;
    }
    if (act === "restore-safety-download") {
      const safety = readRestoreSafety();
      if (!safety) throw new Error("当前账号还没有恢复前副本");
      download("恢复前副本-" + backupFileName(safety), JSON.stringify(safety, null, 2), "application/json");
      flashActionButton(b, "已开始下载恢复前副本");
      return;
    }
    if (act === "restore-prev" || act === "restore-next") {
      if (ui.restorePlan) {
        ui.restorePage += act === "restore-next" ? 1 : -1;
        renderRestoreItems();
      }
      return;
    }
    if (act === "backup-download") {
      const backup = createAccountBackup();
      const text = JSON.stringify(backup, null, 2);
      const checked = validateBackup(text, acct.id);
      if (!checked.valid) throw new Error(`备份校验失败：${checked.errors.join("；")}`);
      renderBackupOverview(checked);
      download(backupFileName(backup), text, "application/json");
      flashActionButton(b, "已开始导出完整备份");
      return;
    }
    if (act === "date-picker-from" || act === "date-picker-to") {
      openNativeDatePicker(act === "date-picker-from" ? ui.dateFrom : ui.dateTo);
      return;
    }
    if (act === "date-filter-toggle") {
      if (ui.dateFilterPanel.hidden) openDateFilterPanel();
      else closeDateFilterPanel();
      return;
    }
    if (act === "date-filter-apply") {
      applyDateFilter();
      return;
    }
    if (act === "date-filter-clear") {
      clearDateFilter();
      return;
    }
    if (act === "dismiss-status") {
      say("", "", currentStatusScope());
      return;
    }
    if (act === "close") {
      if (running) {
        const scope = runStatusScope(activeRun);
        if (activeRun === "detail" || activeRun === "refresh-sel")
          stopDetailCrawl();
        else aborted = true;
        const tab = scope.startsWith("grab-") ? "grab" : scope;
        selectTab(ui.tabs.find((x) => x.getAttribute("data-tab") === tab));
        if (scope.startsWith("grab-")) selectGrabView(scope.slice(5));
        say("正在停止…完成后可关闭", "progress", scope);
        return;
      }
      if (ui.grabObserver) ui.grabObserver.disconnect();
      if (ui.rowObserver) ui.rowObserver.disconnect();
      pauseStatusTimer();
      clearActionFeedback();
      ui.pressFeedback.dispose();
      document.removeEventListener("visibilitychange", ui.visibilityHandler);
      document.removeEventListener("pointerdown", ui.dateOutsideHandler);
      document.removeEventListener("pointerdown", ui.tagOutsideHandler);
      ui.host.remove();
      ui = null;
      return;
    }
    if (act === "toggle") {
      togglePanel();
      return;
    }
    if (act === "claim-yes") {
      const legacy = legacyLib();
      if (!legacy) {
        refresh();
        return;
      }
      // 当前库可能已经有东西了，所以是「并进去」而不是覆盖，按链接去重
      const cur = lib.read();
      const res = lib.merge(
        legacy.rows,
        Math.max(cur.doneBegin || 0, Number(legacy.doneBegin) || 0),
      );
      // merge 已确认目标库保存成功；清理失败时保留旧库，重试仍按链接去重。
      requiredWrite(LEGACY_LIB_KEY, "", "文章已归入当前账号，但旧数据清理失败，请稍后重试");
      mode = "inc";
      refresh();
      say(
        `已归入“${acct.name}”：新增 ${res.added} 篇，现在共 ${res.total} 篇`,
        "ok",
        "grab-list",
      );
      return;
    }
    if (act === "claim-show") {
      rawWrite(dismissKey(), ""); // 撤销忽略，重新显示归入/忽略
      refresh();
      return;
    }
    if (act === "claim-no") {
      rawWrite(dismissKey(), "1"); // 只在这个号下忽略，换号还会再问
      refresh();
      say("已忽略。", "", "grab-list");
      return;
    }
    if (act === "drop") {
      progress.clear();
      refresh();
      say("已丢弃中断的进度", "", "grab-list");
      return;
    }
    if (act === "dur-unit") {
      const next =
        DUR_UNITS[(DUR_UNITS.indexOf(durUnit()) + 1) % DUR_UNITS.length];
      cfg.patch({ durUnit: next });
      refresh();
      say(`平均阅读时长改用“${next}”`, "ok", "cols");
      return;
    }
    if (act === "sum-edit") {
      sumOpen = !sumOpen;
      refresh();
      return;
    }
    if (act === "preset-saveas") {
      const cur = cfg.read().preset;
      const name = askName(
        "另存为新模板，起个名字：",
        cur ? cur + " 副本" : "",
      );
      if (!name) return;
      if (
        presets.names().indexOf(name) >= 0 &&
        !confirm(`模板“${name}”已存在，覆盖它？`)
      )
        return;
      presets.save(name);
      cfg.patch({ preset: name });
      refresh();
      say(`已另存为模板“${name}”`, "ok", "cols");
      return;
    }
    if (act === "preset-overwrite") {
      const name = ui.preset.value;
      if (!name) return;
      presets.save(name);
      refresh();
      say(`模板“${name}”已更新`, "ok", "cols");
      return;
    }
    if (act === "preset-rename") {
      const old = ui.preset.value;
      if (!old) return;
      const name = askName("模板重命名：", old);
      if (!name || name === old) return;
      if (
        presets.names().indexOf(name) >= 0 &&
        !confirm(`已有模板“${name}”，覆盖它？`)
      )
        return;
      presets.rename(old, name);
      cfg.patch({ preset: name });
      refresh();
      say(`已重命名为“${name}”`, "ok", "cols");
      return;
    }
    if (act === "preset-del") {
      const name = ui.preset.value;
      if (!name) return;
      if (!confirm(`删除模板“${name}”？（不影响文章库和当前列设置）`)) return;
      presets.remove(name);
      cfg.patch({ preset: "" });
      refresh();
      say(`模板“${name}”已删除`, "ok", "cols");
      return;
    }
    if (act === "sel-all") {
      ui.selectionAnchor = null;
      filtered().forEach((r) => sel.add(r.链接));
      refresh();
      return;
    }
    if (act === "sel-none") {
      ui.selectionAnchor = null;
      sel.clear();
      refresh();
      return;
    }

    if (act === "imp-toggle") {
      if (!ui.dataManager.hidden) resetBackupPanel();
      closeDateFilterPanel();
      closeTagFilterPanel();
      setTagImportOpen(ui.imp.hidden);
      return;
    }
    if (act === "imp-preview") {
      doImpPreview();
      return;
    }
    if (act === "imp-clear") {
      ui.impText.value = "";
      invalidatePlan();
      say("已清空输入", "", "rows");
      return;
    }
    if (act === "imp-apply") {
      if (!impPlan || !impPlan.affected) return;
      const n = applyTagImport(impPlan, impMode);
      invalidatePlan();
      ui.impText.value = "";
      refresh();
      say(
        `已给 ${n} 篇文章${impMode === "replace" ? "覆盖" : "追加"}标签`,
        "ok",
        "rows",
      );
      return;
    }
    if (act === "tag-export") {
      const rows = lib.read().rows.filter((r) => (r._tags || []).length);
      if (!rows.length) {
        say("库里还没有任何标签", "err", "rows");
        return;
      }
      say("", "", "rows");
      const d = new Date();
      try {
        download(
          `文章标签_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`,
          tagsToJson(),
          "application/json",
        );
        flashActionButton(b, `已开始导出 ${rows.length} 篇的标签`);
      } catch (err) {
        say(`导出标签失败：${(err && err.message) || err}`, "err", "rows");
      }
      return;
    }

    if (act === "tag-sel") {
      if (!sel.size) return;
      const links = [...sel];
      const tip =
        `给勾选的 ${links.length} 篇加标签，逗号分隔。\n` +
        "要移除某个标签就在前面加减号，例如  -旧标签\n" +
        "清空全部标签输入  -*\n" +
        `示例：专栏,活动,-废弃`;
      const s = (prompt(tip, "") || "").trim();
      if (!s) return;
      const add = [],
        del = [];
      for (let t of s.split(/[,，]/)) {
        t = t.trim();
        if (!t) continue;
        if (t[0] === "-") {
          const x = t.slice(1).trim();
          if (x) del.push(x);
        } else add.push(t);
      }
      if (!add.length && !del.length) return;
      const n = lib.tag(links, add, del);
      refresh();
      const bits = [];
      if (add.length) bits.push("加 " + add.join("/"));
      if (del.length)
        bits.push("去 " + (del.indexOf("*") >= 0 ? "全部" : del.join("/")));
      say(`${n} 篇已更新标签：${bits.join("，")}`, "ok", "rows");
      return;
    }

    if (act === "copy" || act === "csv") {
      const rows = scopeRows();
      if (!rows.length) return;
      say("", "", "rows");
      if (act === "copy") {
        const context = accountContext();
        copyText(toTSV(rows)).then((ok) => {
          if (!sameAccountContext(context)) return;
          if (ok) flashActionButton(ui.copy, "已复制文章数据");
          else say("复制失败", "err", "rows");
        });
      } else {
        const d = new Date();
        try {
          download(
            `公众号文章数据_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`,
            toCSV(rows),
            "text/csv",
          );
          flashActionButton(ui.csv, "已开始导出 CSV");
        } catch (err) {
          say(`导出 CSV 失败：${(err && err.message) || err}`, "err", "rows");
        }
      }
      return;
    }

    /* ---- 手动修复旧记录的发布日期 ---- */
    if (act === "repair-dates") {
      if (running) {
        if (activeRun === "repair-dates") {
          aborted = true;
          say("正在停止修复…", "progress", "grab-list");
        }
        return;
      }
      const missing = lib.read().rows.filter(needsDateRepair).length;
      if (!missing) {
        refresh();
        return;
      }

      running = true;
      activeRun = "repair-dates";
      aborted = false;
      const context = accountContext();
      refresh();
      say(`开始查找 ${missing} 篇缺日期文章…`, "progress", "grab-list");
      try {
        const out = await repairMissingDates((pages, repaired, total, tip) => {
          if (sameAccountContext(context)) say(
            `已查 ${pages} 页 · 修复 ${repaired}/${total} 篇${tip ? " · " + tip : ""}`,
            "progress",
            "grab-list",
          );
        });
        if (!sameAccountContext(context)) return;
        if (out.stopped)
          say(
            `已停止：查了 ${out.pages} 页，修复 ${out.repaired} 篇；进度已保留`,
            "warn",
            "grab-list",
          );
        else if (!out.remaining)
          say(
            `完成：修复 ${out.repaired} 篇（${out.pages} 个请求）`,
            "ok",
            "grab-list",
          );
        else if (out.exhausted)
          say(
            `已查完整个列表，仍有 ${out.remaining} 篇未找到`,
            "warn",
            "grab-list",
          );
        else
          say(
            `本次查了 ${out.pages} 页，仍有 ${out.remaining} 篇；可继续修复`,
            "warn",
            "grab-list",
          );
      } catch (err) {
        if (sameAccountContext(context))
          say(String((err && err.message) || err), "err", "grab-list");
      } finally {
        running = false;
        activeRun = "";
        aborted = false;
        if (ui) refresh();
      }
      return;
    }

    /* ---- 抓列表 ---- */
    if (act === "list" || act === "resume") {
      if (running) {
        aborted = true;
        say("正在停止…（会等当前请求结束）", "progress", "grab-list");
        return;
      }
      const saved = act === "resume" ? progress.read() : null;
      if (act === "resume" && !saved) {
        refresh();
        return;
      }

      let plan;
      if (saved)
        plan = {
          mode: saved.mode,
          stopAtTs: saved.stopAtTs,
          cutoffTs: saved.cutoffTs,
          resume: saved,
        };
      else {
        plan = planFor(mode);
        if (
          plan.mode === "full" &&
          lib.read().rows.length &&
          !confirm("「重新全抓」完成后会替换现有文章库，确定？")
        )
          return;
        progress.clear();
      }

      running = true;
      activeRun = "list";
      aborted = false;
      const context = accountContext();
      fresh = new Set();
      const label = ui.listBtn.textContent;
      ui.listBtn.textContent = "停止";
      ui.detailBtn.disabled = true;
      ui.modeBtns.forEach((b) => {
        b.disabled = true;
      });
      say("开始…", "progress", "grab-list");
      try {
        const out = await crawlList(plan, (n, s, tip) => {
          if (sameAccountContext(context)) say(
            `已翻 ${s.pages} 页 · 新增 ${n} 篇${s.reached ? " · 到 " + s.reached : ""}${tip ? " · " + tip : ""}`,
            "progress",
            "grab-list",
          );
        });
        if (!sameAccountContext(context)) return;
        let added = 0, updated = 0, total = 0;
        if (plan.mode === "full" && out.stopped) {
          // 已抓的文章留在进度里；停止时原库原样保留。
          total = lib.read().rows.length;
        } else if (plan.mode === "full") {
          const rows = out.rows.slice().sort((a, b) => (b._ts || 0) - (a._ts || 0));
          requireWriteResult(
            lib.write({ rows, doneBegin: out.startBegin + out.groups }),
            "新文章库保存失败，原库和抓取进度已保留",
          );
          progress.clear();
          rows.forEach((r) => fresh.add(r.链接));
          added = total = rows.length;
        } else {
          const L = lib.read();
          const doneBegin = out.stopped
            ? L.doneBegin
            : plan.mode === "inc"
              ? out.baseDoneBegin + out.groups
              : out.startBegin + out.groups;
          ({ added, updated, total } = lib.merge(
            out.rows, doneBegin, out.fresh,
            plan.mode === "inc" && !out.stopped && !out.limited,
          ));
          if (!out.stopped) progress.clear();
          out.rows.forEach((r) => fresh.add(r.链接));
        }
        const extra = [];
        if (updated) extra.push(`顺手更新 ${updated} 篇`);
        if (out.stat.deleted) extra.push(`跳过已删除 ${out.stat.deleted} 篇`);
        let head;
        if (out.limited && plan.mode === "full")
          head = `达到 ${MAX_PAGES} 页上限，已抓 ${out.rows.length} 篇待继续，原库保留`;
        else if (out.limited)
          head = `达到 ${MAX_PAGES} 页上限，已抓 ${out.rows.length} 篇待继续`;
        else if (out.stopped && plan.mode === "full")
          head = `已停止，已抓 ${out.rows.length} 篇待继续，原库保留`;
        else if (out.stopped) head = `已停止，新增 ${added} 篇`;
        else if (!added && plan.mode === "inc") head = "没有新文章";
        else head = `完成：新增 ${added} 篇，库里共 ${total} 篇`;
        say(
          `${head}（${out.stat.pages} 个请求）${extra.length ? "，" + extra.join("、") : ""}`,
          out.stopped || out.limited ? "warn" : "ok",
          "grab-list",
        );
      } catch (err) {
        if (!sameAccountContext(context)) return;
        let message = String((err && err.message) || err);
        // 网络/解析失败时仍尽量合入已保存的部分结果，但不能掩盖二次保存失败。
        // 存储失败保持现场，不自动再次提交或清理恢复点。
        if (plan.mode !== "full" && err.name !== "StorageError") {
          try {
            const p = progress.read();
            if (p && p.rows.length) {
              lib.merge(p.rows, null);
              p.rows.forEach((r) => fresh.add(r.链接));
            }
          } catch (saveErr) {
            message += `；${saveErr.message || saveErr}`;
          }
        }
        say(message, "err", "grab-list");
      } finally {
        running = false;
        activeRun = "";
        aborted = false;
        ui.listBtn.textContent = label;
        if (sameAccountContext(context) && plan.mode === "full" &&
            !progress.read() && lib.read().rows.length) mode = "inc";
        refresh();
      }
      return;
    }

    /* ---- 刷新实时数（阅读/点赞/在看/分享/留言，从列表取）---- */
    if (act === "refresh-live") {
      if (running) {
        aborted = true;
        say("正在停止…（会等当前请求结束）", "progress", "rows");
        return;
      }
      const todo = lib.read().rows.filter((r) => sel.has(r.链接));
      if (!todo.length) return;

      running = true;
      activeRun = "refresh-live";
      aborted = false;
      const context = accountContext();
      const label = ui.liveBtn.textContent;
      ui.liveBtn.textContent = "停止";
      ui.listBtn.disabled = ui.refreshBtn.disabled = true;
      say(`刷新 ${todo.length} 篇的实时数…`, "progress", "rows");
      try {
        const out = await refreshLive(todo, (n, total, reqs, tip) => {
          if (sameAccountContext(context)) say(
            `实时数 ${n}/${total} · ${reqs} 个请求${tip ? " · " + tip : ""}`,
            "progress",
            "rows",
          );
        });
        if (!sameAccountContext(context)) return;
        const bits = [`${out.reqs} 个请求`];
        if (out.updated) bits.push(`${out.updated} 篇数据有变化`);
        if (out.missed.length)
          bits.push(`${out.missed.length} 篇在列表里没找到`);
        say(
          `${out.stopped ? "已停止" : "完成"}：刷新了 ${out.done}/${out.total} 篇（${bits.join("、")}）`,
          out.stopped || out.missed.length ? "warn" : "ok",
          "rows",
        );
        if (out.missed.length)
          console.log("[公众号数据] 列表里没定位到的：", out.missed);
      } catch (err) {
        if (sameAccountContext(context))
          say(String((err && err.message) || err), "err", "rows");
      } finally {
        running = false;
        activeRun = "";
        aborted = false;
        ui.liveBtn.textContent = label;
        ui.listBtn.disabled = false;
        refresh();
      }
      return;
    }

    /* ---- 抓详情：补没有的 / 刷新勾选的 ---- */
    if (act === "detail" || act === "refresh-sel") {
      const isRefresh = act === "refresh-sel";
      const statusScope = isRefresh ? "rows" : "grab-detail";
      const btn = isRefresh ? ui.refreshBtn : ui.detailBtn;
      if (running) {
        stopDetailCrawl();
        say("正在停止…已保存的文章会保留", "progress", statusScope);
        return;
      }

      let todo;
      const settings = saveDetailSettings(ui.speed.value);
      ui.speed.value = settings.speed;
      const timing = DETAIL_SPEEDS[settings.speed];
      if (isRefresh) {
        todo = lib.read().rows.filter((r) => sel.has(r.链接) && r._appmsgid);
        if (!todo.length) return;
      } else {
        todo = lib.pending();
        if (!todo.length) return;
      }

      running = true;
      activeRun = act;
      aborted = false;
      const context = accountContext();
      const controller = new AbortController();
      detailAbortController = controller;
      const label = btn.textContent;
      btn.textContent = "停止";
      ui.speed.disabled = true;
      ui.listBtn.disabled = true;
      if (!isRefresh) ui.refreshBtn.disabled = true;
      else ui.detailBtn.disabled = true;
      say(
        `${isRefresh ? "刷新" : "补"}详情，共 ${todo.length} 篇…`,
        "progress",
        statusScope,
      );
      try {
        const out = await crawlDetails(
          todo,
          (done, total, failed, tip) => {
            if (sameAccountContext(context)) say(
              `${isRefresh ? "刷新" : "补"} ${done}/${total}${failed ? ` · ${failed} 篇失败` : ""}${tip ? " · " + tip : ""}`,
              "progress",
              statusScope,
            );
          },
          timing,
          controller.signal,
        );
        if (!sameAccountContext(context)) return;
        const bits = [];
        if (out.noUrl)
          bits.push(`${out.noUrl} 篇缺少数据页所需信息，暂时无法补详情`);
        if (out.failed - out.noUrl > 0)
          bits.push(`${out.failed - out.noUrl} 篇没解析出数据`);
        if (out.legacyMissingCollection)
          bits.push(`${out.legacyMissingCollection} 篇旧版详情未提供收藏，已有值保留`);
        if (out.missingCollection)
          bits.push(`${out.missingCollection} 篇收藏待核查，已有值保留，可勾选后刷新详情数`);
        let left = 0;
        if (!isRefresh) {
          left = lib.pending().length;
          if (left) bits.push(`还剩 ${left} 篇没补`);
        }
        const head = out.stopped ? "已停止" : "完成";
        say(
          `${head}：${isRefresh ? "刷新" : "补"}了 ${out.done} 篇` +
            (bits.length
              ? "，" + bits.join("、")
              : isRefresh
                ? ""
                : "，全部补齐了"),
          out.stopped || out.failed || left || out.missingCollection ? "warn" : "ok",
          statusScope,
        );
        if (out.fails.length) console.log("[公众号数据] 没抓到的：", out.fails);
      } catch (err) {
        if (sameAccountContext(context))
          say(String((err && err.message) || err), "err", statusScope);
      } finally {
        if (detailAbortController === controller) detailAbortController = null;
        running = false;
        activeRun = "";
        aborted = false;
        btn.textContent = label;
        ui.listBtn.disabled = false;
        refresh();
      }
      return;
    }
  }

  /* ==========================================================================
   * 10. 启动
   * ========================================================================== */
  function start() {
    if (document.getElementById(PANEL_ID)) return;
    try {
      build();
    } catch (err) {
      console.error("[公众号数据] 面板加载失败", err);
      // 严格读取失败时仍让错误可见；不能留一个隐藏的半成品面板。
      const host = document.getElementById(PANEL_ID);
      if (host) host.style.visibility = "";
      if (ui) {
        ui.storageReadFailed = err.name === "StorageError";
        say(`面板加载失败：${err.message || err}`, "err", currentStatusScope());
      }
      else alert(`公众号数据面板加载失败：${err.message || err}`);
    }
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  else start();

  /**
   * 暴露给浏览器控制台调试用。
   * ⚠ 必须挂到 unsafeWindow：脚本带了 @grant 就跑在油猴沙箱里，
   *   沙箱的 window 和页面的 window 不是同一个，挂在 window 上
   *   DevTools 控制台（页面上下文）根本看不见。
   */
  if (typeof window !== "undefined") {
    const host =
      typeof unsafeWindow !== "undefined" && unsafeWindow
        ? unsafeWindow
        : window;
    host.__MP_DATA__ = window.__MP_DATA__ = {
      extractJsonAfter,
      parsePublishPage,
      groupsFromPage,
      parseDetail,
      detailFields,
      crawlList,
      crawlDetails,
      refreshLive,
      listUrl,
      listExtraParams,
      detectAccount,
      legacyLib,
      libKey,
      progKey,
      getAcct: () => acct,
      toCSV,
      toTSV,
      lib,
      progress,
      cfg,
      presets,
      orderedSchema,
      activeSchema,
      sumCols,
      detailUrl,
      headerFor,
      parseTagJson,
      planTagImport,
      applyTagImport,
      tagsToJson,
      linkKey,
      titleKey,
      createAccountBackup,
      validateBackup,
      backupFileName,
      planBackupRestore,
      applyBackupRestore,
      readRestoreSafety,
    };
  }
})();
