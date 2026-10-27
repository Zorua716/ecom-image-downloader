# 电商图片提取下载助手

一个 Chrome 浏览器扩展（Manifest V3），在淘宝 / 天猫、京东、拼多多商家版商品详情页右下角显示「获取图片」按钮，点击后自动收集当前详情页的图片，并在新页面中预览、多选、批量下载，所有图片统一转换为 PNG 格式。

## 功能

- 支持站点：淘宝 / 天猫商品详情页、京东商品详情页、拼多多商家版（含 `mms.pinduoduo.com` 及拼多多商品页）。
- 右下角悬浮「获取图片」按钮，使用 Shadow DOM 隔离样式，不受页面 CSS / z-index 干扰。
- 受控滚动扫描懒加载图片，扫描完成后恢复原滚动位置。
- 提取来源：`img`、`srcset`、`data-src` 等懒加载属性、`picture/source`、CSS 背景图、视频封面、`og:image`。
- 去重、过滤 1×1 占位图与常见图标/LOGO/装饰图，并尽量去除缩略图尺寸后缀以获取原图。
- 新页面网格预览、大图预览、全选 / 取消全选、实时已选数量、下载进度与失败汇总。
- 下载时统一经 Canvas/OffscreenCanvas 转换为 PNG，自动处理跨域 CDN 图片。

## 环境要求

- Node.js 18+（本机已确认 Node v24.18.0）
- Chrome 111+（本机已确认 Chrome 已安装）

## 安装依赖

```powershell
npm install
```

> 说明：如果安装时遇到缓存目录权限错误（`EPERM`，例如无法写入 `D:\npm-cache`），可以手动把缓存指向项目内目录：
>
> ```powershell
> npm install --cache .npm-cache
> ```

## 构建

```powershell
npm run build
```

构建产物位于 `dist/`：

- `manifest.json`：扩展清单
- `background.js`：后台 Service Worker
- `content.js`：内容脚本（悬浮按钮 + 图片提取）
- `gallery.html`：图片预览下载页面

## 安装到 Chrome

1. 打开 Chrome，地址栏输入 `chrome://extensions/`。
2. 右上角打开「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择本项目生成的 `dist` 目录。
4. 打开一个受支持的商品详情页，页面右下角应出现「获取图片」按钮。

## 使用

1. 在商品详情页点击右下角「获取图片」。
2. 等待按钮显示「正在获取…」并完成扫描，扩展会自动打开预览页。
3. 在预览页勾选需要下载的图片，或点击「全选」。
4. 点击「下载所选 (N)」，图片会以 `商品标题_序号.png` 的形式保存到浏览器默认下载目录。

## 常见问题

### 为什么不显示按钮

- 当前页面可能不是商品详情页。扩展只在这些路径注入按钮：
  - 淘宝 / 天猫：`/item.htm`、`/item/...`
  - 京东：`item.jd.com`、`item.m.jd.com` 或形如 `/\d{5,}.html` 的路径
  - 拼多多：`/goods.html`；拼多多商家版 `mms.pinduoduo.com` 中路径包含 `goods/product/spu/sku/detail` 的页面
- 页面若尚未加载完成，刷新一次再试。

### 为什么部分图片下载失败

- 该图片地址需要登录态或防盗链校验，扩展无法在后台代取。
- 图片是 SVG 且没有明确宽高，无法转换为 PNG。
- 图片超大导致解码或画布内存超限。

失败详情会显示在预览页顶部，不会中断其他图片下载。

### 关于权限

- `storage`：保存最近一次提取结果。
- `downloads`：保存 PNG 文件。
- `tabs`：打开 / 聚焦预览页。
- `host_permissions: <all_urls>`：电商图片通常存放在多个第三方 CDN 域名上，后台需要跨域拉取图片才能转换为 PNG。

这是本地个人使用的最省心配置。如果要上架 Chrome 应用商店，建议将 `<all_urls>` 收紧为具体的电商域名及其 CDN 域名，并补充隐私说明。

## 项目结构

```text
src/
  background/index.ts       后台：打开预览页、下载并转 PNG
  content/
    index.ts                悬浮按钮 + 扫描调度
    extractor.ts            通用图片提取、去重与过滤
    adapters/               站点适配器（淘宝/京东/拼多多，可扩展）
  gallery/
    App.vue                 预览页界面
    main.ts / gallery.css
  shared/
    types.ts / image-url.ts / storage.ts
```

新增电商平台时，在 `src/content/adapters/` 增加一个实现 `SiteAdapter` 接口的适配器，并在 `adapters/index.ts` 注册即可；同时把对应域名加入 `public/manifest.json` 的 `content_scripts.matches`。

## 部署官网到 Cloudflare

官网位于 `docs/`，是纯静态页面。仓库根目录的 `wrangler.jsonc` 已将 Cloudflare Workers 的静态资源目录指向 `./docs`。

- Workers 方式：Build command 可留空或填 `exit 0`，Deploy command 保持 `npx wrangler deploy`。
- Pages 方式：Framework preset 选 `None`，Build command 留空，Build output directory 填 `docs`。

不要把扩展的 `dist/` 当作官网发布目录，`dist/` 是 Chrome 扩展构建产物。

## 已知限制

- 页面需要登录、需要点击标签页才渲染、或通过 Canvas/WebGL 动态绘制的图片，无法通过 DOM 扫描获取。
- 防盗链严格或需要 Cookie 的图片，后台无法代取，会记录为失败。
- 极少数情况下去除缩略图参数可能改变图片地址语义，下载时会优先尝试原始地址作为兜底。
- 拼多多商家版具体页面结构可能随版本变化，若按钮未出现或图片不完整，可在 `src/content/adapters/pinduoduo.ts` 中调整选择器。
