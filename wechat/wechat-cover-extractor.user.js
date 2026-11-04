// ==UserScript==
// @name         微信公众号封面提取器
// @namespace    wechat-cover-extractor
// @version      2.7.3
// @description  自动提取微信公众号文章的 1:1 和 2.35:1 封面，支持拖动悬浮按钮、查看链接和按标题或发布日期命名保存
// @author       malafeiniao
// @homepageURL  https://github.com/malafeiniao/social-media-userscripts
// @supportURL   https://github.com/malafeiniao/social-media-userscripts/issues
// @updateURL    https://raw.githubusercontent.com/malafeiniao/social-media-userscripts/main/wechat/wechat-cover-extractor.user.js
// @downloadURL  https://raw.githubusercontent.com/malafeiniao/social-media-userscripts/main/wechat/wechat-cover-extractor.user.js
// @match        https://mp.weixin.qq.com/s/*
// @match        http://mp.weixin.qq.com/s/*
// @run-at       document-end
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      mmbiz.qpic.cn
// @connect      sz_mmbiz.qpic.cn
// ==/UserScript==

(function () {
  "use strict";

  // =========================
  // 基础工具
  // =========================

  function decodeHtml(str) {
    if (!str) return "";

    str = str.replace(/\\x26/g, "&").replace(/\\u0026/g, "&");

    const textarea = document.createElement("textarea");

    textarea.innerHTML = str;
    str = textarea.value;

    textarea.innerHTML = str;
    str = textarea.value;

    return str.replace(/^http:/, "https:");
  }

  function getMeta(property) {
    return (
      document.querySelector(`meta[property="${property}"]`)?.content?.trim() ||
      ""
    );
  }

  function getScriptVariable(name) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const regex = new RegExp(
      `\\b${escapedName}\\s*=\\s*(?:["']([^"']+)["']|(\\d{10})(?!\\d))`,
    );

    for (const script of document.scripts) {
      const text = script.textContent || "";
      const match = text.match(regex);

      if (match?.[1] || match?.[2]) {
        return decodeHtml(match[1] || match[2]);
      }
    }

    return "";
  }

  function getCovers() {
    const square = getScriptVariable("cdn_url_1_1");

    let wide = getScriptVariable("cdn_url_235_1");

    if (!wide) {
      wide =
        decodeHtml(getMeta("og:image")) ||
        decodeHtml(getMeta("twitter:image")) ||
        getScriptVariable("msg_cdn_url");
    }

    return {
      square,
      wide,
    };
  }

  function getArticleTitle() {
    return (
      document.querySelector("#activity-name")?.textContent?.trim() ||
      getMeta("og:title") ||
      document.title ||
      "微信公众号封面"
    );
  }

  function parsePublishDate(value) {
    const match = String(value || "").match(
      /(\d{4})[年./-]\s*(\d{1,2})[月./-]\s*(\d{1,2})(?:日)?(?!\d)/,
    );

    if (!match) return "";

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > new Date(Date.UTC(year, month, 0)).getUTCDate()
    ) {
      return "";
    }

    return `${match[1]}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  }

  function getPublishDate() {
    // 页面显示的日期可能被改成「今天」或「昨天」，
    // 先使用文章脚本里的完整发布时间。
    for (const value of [
      getScriptVariable("createTime"),
      getMeta("article:published_time"),
      document.querySelector('meta[name="pubdate"]')?.content,
      document.querySelector("#publish_time")?.textContent,
    ]) {
      const date = parsePublishDate(value);

      if (date) return date;
    }

    // 时间戳按公众号页面使用的北京时间转换，
    // 避免浏览器所在时区让日期偏移。
    for (const name of ["oriCreateTime", "ct", "create_time"]) {
      const timestamp = getScriptVariable(name);

      if (!/^\d{10}$/.test(timestamp)) continue;

      const date = new Date(Number(timestamp) * 1000 + 8 * 60 * 60 * 1000);

      if (Number.isNaN(date.getTime())) continue;

      return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
    }

    return "";
  }

  const filenameModeKey = "wechat-cover-extractor-filename-mode";

  function readFilenameMode() {
    try {
      return localStorage.getItem(filenameModeKey) === "date"
        ? "date"
        : "title";
    } catch {
      return "title";
    }
  }

  function saveFilenameMode(mode) {
    try {
      localStorage.setItem(filenameModeKey, mode);
    } catch {
      // 存储不可用时，本页的切换仍然有效。
    }
  }

  const triggerPositionKey = "wechat-cover-extractor-trigger-position";

  function readTriggerPosition() {
    try {
      const position = JSON.parse(localStorage.getItem(triggerPositionKey));

      if (Number.isFinite(position?.left) && Number.isFinite(position?.top)) {
        return position;
      }
    } catch {
      // 使用默认位置。
    }

    return null;
  }

  function saveTriggerPosition(position) {
    try {
      localStorage.setItem(triggerPositionKey, JSON.stringify(position));
    } catch {
      // 存储不可用时，本页仍可拖动。
    }
  }

  function getExtension(url) {
    try {
      const u = new URL(url);
      const fmt = u.searchParams.get("wx_fmt");

      if (fmt) {
        if (fmt === "jpeg") return "jpg";
        return fmt;
      }

      if (u.pathname.includes("mmbiz_png")) return "png";
      if (u.pathname.includes("mmbiz_gif")) return "gif";
      if (u.pathname.includes("mmbiz_webp")) return "webp";

      return "jpg";
    } catch {
      return "jpg";
    }
  }

  function sanitizeFilename(name) {
    return name
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
  }

  function makeEl(tag, className, text) {
    const el = document.createElement(tag);

    if (className) {
      el.className = className;
    }

    if (text !== undefined) {
      el.textContent = text;
    }

    return el;
  }

  // 让某个区域「吞掉」点击，
  // 不触发外层翻转。
  function blockFlip(el) {
    for (const type of ["pointerdown", "click"]) {
      el.addEventListener(type, (event) => {
        event.stopPropagation();
      });
    }

    return el;
  }

  // =========================
  // 复制
  // =========================

  async function copyText(text, button) {
    if (!text) return;

    let success = false;

    // 方法 1：Tampermonkey
    try {
      if (typeof GM_setClipboard === "function") {
        GM_setClipboard(text, "text");
        success = true;
      }
    } catch (error) {
      console.warn("[微信公众号封面提取器] GM_setClipboard 失败：", error);
    }

    // 方法 2：Clipboard API
    if (!success) {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          success = true;
        }
      } catch (error) {
        console.warn("[微信公众号封面提取器] Clipboard API 失败：", error);
      }
    }

    // 方法 3：传统 fallback
    if (!success) {
      try {
        const textarea = document.createElement("textarea");

        textarea.value = text;

        textarea.style.position = "fixed";
        textarea.style.left = "-99999px";
        textarea.style.top = "-99999px";

        document.body.appendChild(textarea);

        textarea.focus();
        textarea.select();

        success = document.execCommand("copy");

        textarea.remove();
      } catch (error) {
        console.error("[微信公众号封面提取器] execCommand 失败：", error);
      }
    }

    if (!button) return;

    if (success) {
      button.classList.remove("error");
      button.classList.add("done");

      button.title = "已复制";

      setTimeout(() => {
        button.classList.remove("done");
        button.title = "复制链接";
      }, 1000);
    } else {
      button.classList.add("error");
      button.title = "复制失败";

      setTimeout(() => {
        button.classList.remove("error");
        button.title = "复制链接";
      }, 1200);
    }
  }

  // =========================
  // 下载
  // =========================

  function downloadCover(url, filenameStem, button) {
    if (!url) return;

    const ext = getExtension(url);
    const filename = `${filenameStem}.${ext}`;

    button?.classList.add("loading");

    GM_xmlhttpRequest({
      method: "GET",
      url,
      responseType: "blob",

      onload(response) {
        try {
          const blob = response.response;

          if (!(blob instanceof Blob)) {
            throw new Error("无法读取图片数据");
          }

          const blobUrl = URL.createObjectURL(blob);

          const a = document.createElement("a");

          a.href = blobUrl;
          a.download = filename;
          a.style.display = "none";

          document.body.appendChild(a);

          a.click();
          a.remove();

          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
          }, 5000);

          if (button) {
            button.classList.remove("loading");
            button.classList.add("done");

            setTimeout(() => {
              button.classList.remove("done");
            }, 1000);
          }
        } catch (error) {
          fail(error);
        }
      },

      onerror(error) {
        fail(error);
      },

      ontimeout(error) {
        fail(error);
      },
    });

    function fail(error) {
      console.error("[微信公众号封面提取器] 下载失败：", error);

      if (button) {
        button.classList.remove("loading");
        button.classList.add("error");

        setTimeout(() => {
          button.classList.remove("error");
        }, 1200);
      }
    }
  }

  // =========================
  // SVG 图标
  // =========================

  function iconSVG(type) {
    switch (type) {
      case "copy":
        return `
                    <svg viewBox="0 0 24 24">
                        <rect
                            x="9"
                            y="8"
                            width="10"
                            height="12"
                            rx="2"
                        ></rect>

                        <rect
                            x="5"
                            y="4"
                            width="10"
                            height="12"
                            rx="2"
                        ></rect>
                    </svg>
                `;

      // 「打开原图」= 新标签页打开，
      // 用外链箭头更贴切；
      // 且几何完全落在 viewBox 内，
      // 不会像原来的链条图标被裁掉两头。
      case "link":
        return `
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M14.5 3.5h6v6"
                        ></path>

                        <path
                            d="M20.5 3.5L12 12"
                        ></path>

                        <path
                            d="M17.5 14v4a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 013.5 18v-9A2.5 2.5 0 016 6.5h4"
                        ></path>
                    </svg>
                `;

      case "download":
        return `
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M12 3.5v12"
                        ></path>

                        <path
                            d="M7.5 11L12 15.5l4.5-4.5"
                        ></path>

                        <path
                            d="M5 20.5h14"
                        ></path>
                    </svg>
                `;

      case "title-name":
        return `
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M6 2.5h8l4 4V21H6a2 2 0 01-2-2V4.5a2 2 0 012-2z"
                        ></path>
                        <path d="M14 2.5v4h4"></path>
                        <path d="M8 11h7"></path>
                        <path d="M8 15h7"></path>
                    </svg>
                `;

      case "date-name":
        return `
                    <svg viewBox="0 0 24 24">
                        <rect
                            x="3.5" y="5" width="17" height="16"
                            rx="2"
                        ></rect>
                        <path d="M7.5 3v4"></path>
                        <path d="M16.5 3v4"></path>
                        <path d="M3.5 10h17"></path>
                        <path d="M8 14h2"></path>
                        <path d="M14 14h2"></path>
                        <path d="M8 18h2"></path>
                    </svg>
                `;

      case "close":
        return `
                    <svg viewBox="0 0 24 24">
                        <path d="M5 5l14 14"></path>
                        <path d="M19 5L5 19"></path>
                    </svg>
                `;

      default:
        return "";
    }
  }

  function createIconButton({ type, title, onClick }) {
    const btn = makeEl("button", "icon-btn");

    btn.type = "button";
    btn.title = title;
    btn.setAttribute("aria-label", title);

    btn.innerHTML = `
            <span class="icon-wrap">
                ${iconSVG(type)}
            </span>
        `;

    // 使用 pointerdown 就先截断事件，
    // 防止点击背面的复制按钮触发翻转。
    btn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    });

    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      onClick?.(btn);
    });

    return btn;
  }

  // =========================
  // 封面卡片
  // =========================

  function createCoverCard({ label, ratioText, url, suffix, getFilenameStem }) {
    const card = makeEl("div", "cover-card");

    // =========================
    // 标题栏
    // =========================

    const header = makeEl("div", "cover-header");

    const title = makeEl("div", "cover-title", `${label} · ${ratioText}`);

    header.append(title);

    // 找到封面才显示操作按钮
    if (url) {
      const headerActions = makeEl("div", "header-actions");

      const openBtn = createIconButton({
        type: "link",
        title: "打开原图",

        onClick: () => {
          window.open(url, "_blank", "noopener,noreferrer");
        },
      });

      const downloadBtn = createIconButton({
        type: "download",
        title: "保存封面",

        onClick: (button) => {
          downloadCover(url, getFilenameStem(suffix), button);
        },
      });

      headerActions.append(openBtn, downloadBtn);

      header.append(headerActions);
    }

    card.append(header);

    // =========================
    // 未找到封面
    // =========================

    if (!url) {
      const missing = makeEl("div", "missing-box", "未找到该封面");

      card.append(missing);

      return card;
    }

    // =========================
    // 翻转区域
    // =========================

    const stage = makeEl("div", "stage");

    const flipShell = makeEl("div", "flip-shell");

    const flipInner = makeEl("div", "flip-inner");

    // -------------------------
    // 正面
    // -------------------------

    const front = makeEl("div", "face front");

    const frontBg = makeEl("div", "stage-bg");

    frontBg.style.backgroundImage = `url("${url}")`;

    const frontOverlay = makeEl("div", "stage-overlay");

    const preview = makeEl("img", "preview");

    preview.src = url;
    preview.referrerPolicy = "no-referrer";

    front.append(frontBg, frontOverlay, preview);

    // -------------------------
    // 背面
    // -------------------------

    const back = makeEl("div", "face back");

    const backBg = makeEl("div", "stage-bg");

    backBg.style.backgroundImage = `url("${url}")`;

    const backOverlay = makeEl("div", "stage-overlay dark");

    const linkPanel = makeEl("div", "link-panel");

    const linkPanelHead = makeEl("div", "link-panel-head");

    const linkTitle = makeEl("div", "link-title", "封面链接");

    const copyBtn = createIconButton({
      type: "copy",
      title: "复制链接",

      onClick: (button) => {
        copyText(url, button);
      },
    });

    linkPanelHead.append(linkTitle, copyBtn);

    const linkText = makeEl("div", "link-text", url);

    // 只有「标题行 + 链接文本」这块不翻转，
    // 方便选中链接；
    // 面板其余留白仍可点击翻转。
    blockFlip(linkPanelHead);
    blockFlip(linkText);

    linkPanel.append(linkPanelHead, linkText);

    back.append(backBg, backOverlay, linkPanel);

    // =========================
    // 拼装
    // =========================

    flipInner.append(front, back);

    flipShell.append(flipInner);

    stage.append(flipShell);

    flipShell.addEventListener("click", () => {
      flipShell.classList.toggle("flipped");
    });

    card.append(stage);

    return card;
  }

  // =========================
  // UI
  // =========================

  function createUI(covers) {
    if (document.querySelector("#wechat-cover-extractor-host")) {
      return;
    }

    const publishDate = getPublishDate();
    let filenameMode = readFilenameMode();

    if (filenameMode === "date" && !publishDate) {
      filenameMode = "title";
    }

    const getFilenameStem = (suffix) =>
      filenameMode === "date"
        ? publishDate
        : `${sanitizeFilename(getArticleTitle())}_${suffix}`;

    const host = document.createElement("div");

    host.id = "wechat-cover-extractor-host";

    host.style.position = "fixed";
    host.style.right = "20px";
    host.style.bottom = "24px";
    host.style.zIndex = "2147483647";

    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({
      mode: "open",
    });

    const style = document.createElement("style");

    style.textContent = `

            * {
                box-sizing: border-box;
            }

            #trigger {
                width: 58px;
                height: 58px;

                border: none;
                border-radius: 50%;

                cursor: grab;

                touch-action: none;
                user-select: none;
                -webkit-user-select: none;

                background:
                    linear-gradient(
                        180deg,
                        #242424,
                        #101010
                    );

                color: #fff;

                font-size: 14px;
                font-weight: 600;

                box-shadow:
                    0 10px 24px
                    rgba(0,0,0,.24),
                    inset 0 1px 0
                    rgba(255,255,255,.10);
            }

            #trigger.dragging {
                cursor: grabbing;
            }

            #trigger:focus-visible {
                outline: 2px solid #111;
                outline-offset: 3px;
            }

            #panel {
                display: none;

                position: absolute;

                right: 0;
                bottom: 70px;

                width: clamp(280px, 24vw, 320px);
                max-width: calc(100vw - 16px);
                max-height: calc(100dvh - 16px);

                overflow-y: auto;

                padding: 14px;

                background: #f6f6f7;

                color: #111;

                border-radius: 18px;

                box-shadow:
                    0 18px 48px
                    rgba(0,0,0,.22),
                    inset 0 1px 0
                    rgba(255,255,255,.75);

                font-family:
                    -apple-system,
                    BlinkMacSystemFont,
                    "PingFang SC",
                    "Helvetica Neue",
                    Arial,
                    sans-serif;
            }

            #panel.show {
                display: block;
            }

            .panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;

                margin-bottom: 12px;
            }

            #panel.floating .panel-header {
                position: sticky;
                top: 0;
                z-index: 25;

                background: #f6f6f7;
            }

            .panel-title {
                min-width: 0;

                font-size: 15px;
                font-weight: 700;
                line-height: 1.3;

                overflow-wrap: anywhere;
            }

            .panel-header-actions {
                display: flex;
                align-items: center;
                gap: 6px;

                flex: 0 0 auto;
            }

            .panel-close.icon-btn {
                display: none;

                width: 30px;
                height: 30px;
                flex: 0 0 30px;
            }

            #panel.floating .panel-close {
                display: inline-flex;
            }

            .filename-switch {
                position: relative;

                display: inline-flex;
                align-items: center;
                gap: 2px;

                flex: 0 0 auto;

                padding: 3px;

                border: 1px solid rgba(0,0,0,.08);
                border-radius: 999px;

                appearance: none;
                -webkit-appearance: none;

                cursor: pointer;
                color: #777;

                background: #e9e9eb;

                box-shadow:
                    inset 0 1px 2px
                    rgba(0,0,0,.06);
            }

            .filename-switch::before {
                content: '';

                position: absolute;
                top: 4px;
                left: 4px;

                width: 32px;
                height: 32px;

                border-radius: 50%;

                background:
                    linear-gradient(
                        180deg,
                        #fff,
                        #f8f8f9
                    );

                box-shadow:
                    0 2px 5px
                    rgba(0,0,0,.14),
                    inset 0 1px 0
                    rgba(255,255,255,1);

                pointer-events: none;

                transition: transform .24s
                    cubic-bezier(.2, .75, .25, 1);
            }

            .filename-switch[data-mode="date"]::before {
                transform: translateX(34px);
            }

            .filename-option.icon-wrap {
                width: 32px;
                height: 32px;
                flex: 0 0 32px;

                position: relative;
                z-index: 1;

                transition: color .24s ease;
            }

            .filename-switch[data-mode="title"]
            .filename-option.title-name,
            .filename-switch[data-mode="date"]
            .filename-option.date-name {
                color: #161616;
            }

            .filename-switch:disabled {
                opacity: .5;
                cursor: not-allowed;
            }

            .filename-switch:focus-visible {
                outline: 2px solid #333;
                outline-offset: 2px;
            }

            @media (prefers-reduced-motion: reduce) {
                .filename-switch::before {
                    transition: none;
                }

                .filename-option.icon-wrap {
                    transition: none;
                }
            }

            /* =====================
               卡片
               ===================== */

            .cover-card {
                padding: 10px;

                border:
                    1px solid #e6e6e8;

                border-radius: 16px;

                margin-bottom: 10px;

                background:
                    linear-gradient(
                        180deg,
                        #fafafa,
                        #f4f4f5
                    );

                box-shadow:
                    inset 0 1px 0
                    rgba(255,255,255,.9);
            }

            .cover-card:last-child {
                margin-bottom: 0;
            }

            /* =====================
               标题栏
               ===================== */

            .cover-header {
                display: flex;

                align-items: center;

                justify-content:
                    space-between;

                min-height: 38px;

                margin-bottom: 8px;

                padding-left: 2px;
            }

            .cover-title {
                min-width: 0;

                font-size: 14px;
                font-weight: 700;
                line-height: 1.35;

                color: #181818;
            }

            .header-actions {
                display: flex;

                align-items: center;

                gap: 8px;
            }

            /* =====================
               图标按钮
               ===================== */

            .icon-btn {
                position: relative;

                width: 34px;
                height: 34px;

                flex:
                    0 0 34px;

                padding: 0;

                border:
                    1px solid
                    rgba(0,0,0,.09);

                border-radius: 50%;

                cursor: pointer;

                display: inline-flex;

                align-items: center;
                justify-content: center;

                color: #222;

                background:
                    linear-gradient(
                        180deg,
                        #ffffff,
                        #ededee
                    );

                box-shadow:
                    0 3px 7px
                    rgba(0,0,0,.11),

                    inset 0 1px 0
                    rgba(255,255,255,1),

                    inset 0 -1px 1px
                    rgba(0,0,0,.04);

                transition:
                    transform .12s ease,
                    box-shadow .12s ease,
                    background .15s ease;

                z-index: 20;

                touch-action: manipulation;
                user-select: none;
            }

            .icon-btn:hover {
                transform:
                    translateY(-1px);

                box-shadow:
                    0 5px 12px
                    rgba(0,0,0,.13),

                    inset 0 1px 0
                    rgba(255,255,255,1);
            }

            .icon-btn:active {
                transform:
                    translateY(0);

                box-shadow:
                    0 1px 3px
                    rgba(0,0,0,.10),

                    inset 0 2px 3px
                    rgba(0,0,0,.07);
            }

            .icon-btn.done {
                background:
                    linear-gradient(
                        180deg,
                        #edfff2,
                        #d8f8e2
                    );
            }

            .icon-btn.error {
                background:
                    linear-gradient(
                        180deg,
                        #fff0f0,
                        #ffdede
                    );
            }

            .icon-btn.loading {
                opacity: .62;
            }

            .icon-wrap {
                width: 18px;
                height: 18px;

                display: flex;

                align-items: center;
                justify-content: center;

                pointer-events: none;
            }

            .icon-wrap svg {
                width: 18px;
                height: 18px;

                fill: none;

                stroke:
                    currentColor;

                stroke-width: 1.9;

                stroke-linecap: round;
                stroke-linejoin: round;

                pointer-events: none;
            }

            /* =====================
               未找到
               ===================== */

            .missing-box {
                display: flex;

                align-items: center;
                justify-content: center;

                min-height: 96px;

                border-radius: 12px;

                background: #efeff0;

                color: #999;

                font-size: 13px;
            }

            /* =====================
               图片区域
               ===================== */

            .stage {
                position: relative;

                width: 100%;

                /* 两张卡共用 4:3 基准相框，
                   视口较大时再限制高度，
                   封面用 object-fit: contain 居中放置，
                   四周留白由模糊背景填充。

                   之前舞台直接照抄封面比例，
                   导致 2.35:1 的舞台只有 ~137px 高：
                   正面图被 padding 压得只有方形封面的
                   1/3.6 大，背面链接面板也放不下完整链接。 */
                aspect-ratio: 4 / 3;
                max-height: clamp(170px, 22dvh, 190px);

                overflow: hidden;

                border-radius: 18px;

                background: #eaeaec;
            }

            .flip-shell {
                position: relative;

                width: 100%;
                height: 100%;

                cursor: pointer;

                perspective: 1200px;
            }

            .flip-inner {
                position: relative;

                width: 100%;
                height: 100%;

                transition:
                    transform .55s
                    cubic-bezier(
                        .4,
                        .2,
                        .2,
                        1
                    );

                transform-style:
                    preserve-3d;
            }

            .flip-shell.flipped
            .flip-inner {
                transform:
                    rotateY(180deg);
            }

            .face {
                position: absolute;

                inset: 0;

                overflow: hidden;

                border-radius: 18px;

                backface-visibility:
                    hidden;

                -webkit-backface-visibility:
                    hidden;

                /* 关键：把每一面变成独立层叠上下文，
                   否则 .preview 的 z-index 会溢出到
                   .flip-inner，盖在背面之上，
                   导致背面的复制按钮点不到。 */
                isolation: isolate;
            }

            .front {
                background: #f4f4f4;

                z-index: 1;
            }

            .back {
                transform:
                    rotateY(180deg);

                background: #111;

                z-index: 1;
            }

            /* 只有正对用户的那一面可交互。
               backface-visibility 只影响绘制，
               不影响命中测试。 */
            .flip-shell.flipped .front,
            .flip-shell:not(.flipped) .back {
                pointer-events: none;
            }

            /* =====================
               模糊背景
               ===================== */

            .stage-bg {
                position: absolute;

                inset: -22px;

                background-size: cover;
                background-position: center;

                filter:
                    blur(30px)
                    saturate(1.18);

                transform:
                    scale(1.16);

                opacity: .95;
            }

            .stage-overlay {
                position: absolute;

                inset: 0;

                background:
                    linear-gradient(
                        180deg,
                        rgba(255,255,255,.12),
                        rgba(255,255,255,.20)
                    );
            }

            .stage-overlay.dark {
                background:
                    linear-gradient(
                        180deg,
                        rgba(0,0,0,.20),
                        rgba(0,0,0,.34)
                    );
            }

            .preview {
                position: absolute;

                inset: 0;

                width: 100%;
                height: 100%;

                object-fit: contain;

                padding: 12px;

                z-index: 2;

                filter:
                    drop-shadow(
                        0 5px 14px
                        rgba(0,0,0,.16)
                    );
            }

            /* =====================
               链接背面
               ===================== */

            .link-panel {
                position: absolute;

                inset: 12px;

                z-index: 5;

                display: flex;

                flex-direction: column;

                padding: 12px;

                border-radius: 18px;

                background:
                    rgba(
                        255,
                        255,
                        255,
                        .86
                    );

                backdrop-filter:
                    blur(12px);

                -webkit-backdrop-filter:
                    blur(12px);

                color: #111;

                box-shadow:
                    inset 0 1px 0
                    rgba(255,255,255,.9);
            }

            .link-panel-head {
                display: flex;

                align-items: center;

                justify-content:
                    space-between;

                min-height: 36px;

                margin-bottom: 10px;
            }

            .link-title {
                font-size: 12px;
                font-weight: 700;
            }

            .link-text {
                /* 不再 flex:1 撑满整块面板，
                   否则下方大片留白也会
                   跟着「点了不翻转」。 */
                flex: 0 1 auto;

                min-height: 0;

                overflow: auto;

                padding-right: 2px;

                font-size: 11px;
                line-height: 1.55;

                color: #333;

                word-break: break-all;

                user-select: text;

                cursor: text;
            }

            @media (max-width: 360px) {
                #panel {
                    padding: 12px;
                    border-radius: 16px;
                }

                .panel-header {
                    gap: 6px;
                }

                .panel-title {
                    font-size: 14px;
                }

                .cover-card {
                    padding: 10px;
                }

                .preview {
                    padding: 12px;
                }

                .link-panel {
                    inset: 12px;
                    padding: 12px;
                }
            }
        `;

    const trigger = makeEl("button", null, "封面");

    trigger.id = "trigger";
    trigger.type = "button";
    trigger.title = "点击打开，拖动调整位置";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", "panel");

    const panel = makeEl("div");

    panel.id = "panel";

    const panelTitle = makeEl("div", "panel-title", "微信公众号封面提取器");

    const panelHeader = makeEl("div", "panel-header");

    const filenameSwitch = makeEl("button", "filename-switch");

    filenameSwitch.type = "button";
    filenameSwitch.innerHTML = `
            <span class="filename-option icon-wrap title-name"
                aria-hidden="true">
                ${iconSVG("title-name")}
            </span>
            <span class="filename-option icon-wrap date-name"
                aria-hidden="true">
                ${iconSVG("date-name")}
            </span>
        `;

    function updateFilenameSwitch() {
      const label =
        filenameMode === "date"
          ? "当前按发布日期命名，点击切换为文章标题"
          : "当前按文章标题命名，点击切换为发布日期";

      filenameSwitch.setAttribute("data-mode", filenameMode);
      filenameSwitch.setAttribute(
        "aria-pressed",
        String(filenameMode === "date"),
      );
      filenameSwitch.setAttribute("aria-label", label);
      filenameSwitch.title = label;
    }

    updateFilenameSwitch();

    if (publishDate) {
      filenameSwitch.addEventListener("click", () => {
        filenameMode = filenameMode === "date" ? "title" : "date";

        updateFilenameSwitch();
        saveFilenameMode(filenameMode);
      });
    } else {
      filenameSwitch.disabled = true;
      filenameSwitch.title = "当前文章未找到发布日期";
      filenameSwitch.setAttribute("aria-label", filenameSwitch.title);
    }

    const closeBtn = createIconButton({
      type: "close",
      title: "关闭面板",
      onClick: () => setPanelOpen(false),
    });

    closeBtn.classList.add("panel-close");

    const panelHeaderActions = makeEl("div", "panel-header-actions");

    panelHeaderActions.append(filenameSwitch, closeBtn);
    panelHeader.append(panelTitle, panelHeaderActions);

    const squareCard = createCoverCard({
      label: "方形封面",

      ratioText: "1:1",

      url: covers.square,

      suffix: "方形封面_1x1",

      getFilenameStem,
    });

    const wideCard = createCoverCard({
      label: "横版封面",

      ratioText: "2.35:1",

      url: covers.wide,

      suffix: "横版封面_2.35x1",

      getFilenameStem,
    });

    panel.append(panelHeader, squareCard, wideCard);

    shadow.append(style, trigger, panel);

    function clamp(value, minimum, maximum) {
      return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
    }

    function positionPanel() {
      if (!panel.classList.contains("show")) return;

      const triggerRect = host.getBoundingClientRect();
      const panelWidth =
        panel.getBoundingClientRect().width ||
        Math.min(320, window.innerWidth - 16);

      const spaceAbove = triggerRect.top - 20;
      const spaceBelow = window.innerHeight - triggerRect.bottom - 20;
      const openAbove = spaceAbove >= spaceBelow;
      const floating =
        Math.max(spaceAbove, spaceBelow) <
        Math.min(360, window.innerHeight * 0.6);

      panel.classList.toggle("floating", floating);
      panel.style.position = floating ? "fixed" : "absolute";

      const preferredLeft = floating
        ? (window.innerWidth - panelWidth) / 2
        : triggerRect.left < window.innerWidth / 2
          ? triggerRect.left
          : triggerRect.right - panelWidth;

      const panelLeft = clamp(
        preferredLeft,
        8,
        window.innerWidth - panelWidth - 8,
      );

      panel.style.left = `${
        floating ? panelLeft : panelLeft - triggerRect.left
      }px`;
      panel.style.right = "auto";

      panel.style.top = floating ? "8px" : openAbove ? "auto" : "70px";
      panel.style.bottom = floating ? "auto" : openAbove ? "70px" : "auto";
      panel.style.maxHeight = `${
        floating
          ? Math.max(0, window.innerHeight - 16)
          : Math.max(0, openAbove ? spaceAbove : spaceBelow)
      }px`;
    }

    function setPanelOpen(open) {
      panel.classList.toggle("show", open);
      trigger.setAttribute("aria-expanded", String(open));

      if (open) positionPanel();
    }

    function moveTrigger(left, top) {
      const rect = host.getBoundingClientRect();
      const position = {
        left: clamp(left, 8, window.innerWidth - rect.width - 8),
        top: clamp(top, 8, window.innerHeight - rect.height - 8),
      };

      host.style.left = `${position.left}px`;
      host.style.top = `${position.top}px`;
      host.style.right = "auto";
      host.style.bottom = "auto";

      positionPanel();

      return position;
    }

    const savedPosition = readTriggerPosition();

    if (savedPosition) {
      moveTrigger(savedPosition.left, savedPosition.top);
    }

    let drag = null;
    let suppressNextClick = false;

    trigger.addEventListener("pointerdown", (event) => {
      if (drag || (event.pointerType === "mouse" && event.button !== 0)) {
        return;
      }

      suppressNextClick = false;

      const rect = host.getBoundingClientRect();

      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
        moved: false,
      };

      trigger.setPointerCapture?.(event.pointerId);
    });

    trigger.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;

      if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) {
        return;
      }

      if (!drag.moved) {
        drag.moved = true;
        trigger.classList.add("dragging");
      }

      event.preventDefault();

      moveTrigger(drag.left + deltaX, drag.top + deltaY);
    });

    function finishDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      const moved = drag.moved;
      drag = null;

      trigger.classList.remove("dragging");

      if (moved) {
        const rect = host.getBoundingClientRect();

        saveTriggerPosition({
          left: Math.round(rect.left),
          top: Math.round(rect.top),
        });

        suppressNextClick = true;

        setTimeout(() => {
          suppressNextClick = false;
        }, 350);
      }
    }

    trigger.addEventListener("pointerup", finishDrag);
    trigger.addEventListener("pointercancel", finishDrag);

    trigger.addEventListener("click", (event) => {
      if (suppressNextClick && event.detail !== 0) {
        suppressNextClick = false;
        event.preventDefault();
        return;
      }

      setPanelOpen(!panel.classList.contains("show"));
    });

    window.addEventListener("resize", () => {
      if (host.style.left) {
        const rect = host.getBoundingClientRect();

        moveTrigger(rect.left, rect.top);
      } else {
        positionPanel();
      }
    });
  }

  // =========================
  // 初始化
  // =========================

  function init() {
    const covers = getCovers();

    if (!covers.square && !covers.wide) {
      return false;
    }

    console.log("[微信公众号封面提取器]", {
      "1:1": covers.square,

      "2.35:1": covers.wide,
    });

    createUI(covers);

    return true;
  }

  if (!init()) {
    let count = 0;

    const timer = setInterval(() => {
      count++;

      if (init() || count >= 20) {
        clearInterval(timer);
      }
    }, 500);
  }
})();
