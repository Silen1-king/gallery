# 交给 ChatGPT Sites 托管

这个网站已经是完整的成品，ChatGPT 只需要**原样托管**，不需要重写。

## 步骤

1. 在 ChatGPT 里新建对话，输入 `@Sites` 或说明要创建网站（Sites 功能目前只对部分套餐和地区开放，如果你的账号里看不到 `@Sites`，用下面的备选方案）。
2. 上传 `silen1-gallery.zip`。
3. 把下面这段话复制过去：

---

> 请把我上传的 zip 原样发布成网站，不要重新设计或改写代码。要求：
>
> 1. 解压后保持目录结构不变，`index.html` 作为首页，`404.html` 作为 404 页面。
> 2. 这是纯静态网站：HTML、CSS、原生 JavaScript，没有构建步骤，不需要后端、数据库或登录。
> 3. 原样提供 `css/`、`js/`、`data/`、`works/`、`assets/` 里的所有文件。`.mp4` 的 Content-Type 用 `video/mp4`，`.webp` 用 `image/webp`，`.svg` 用 `image/svg+xml`。
> 4. `work.html?id=xxx` 通过查询参数打开不同作品，请不要改写成别的路由。
> 5. 页面里有 Content-Security-Policy 的 meta 标签。如果平台必须注入脚本而被它挡住，只删掉这一行，其它代码不要动。
> 6. `tools/`、`README.md`、`HANDOFF.md` 不需要公开，可以不发布。
>
> 发布后请确认：首页往下滚时，画面会钻进画里的圆形洞口、一层层掉进下一幅画；作品区可以拖动；点作品能进入详情页并播放绘画过程。

---

## 以后更新作品

在本地用 `tools/add-work.py` 加好新作品，重新打包 zip，在同一个 ChatGPT 对话里上传并说“用新的 zip 替换网站文件，其它不变”。

## 免费备选托管（任选一个）

网站不依赖任何平台功能，直接上传文件夹就能用：

| 平台 | 做法 | 网址 |
|---|---|---|
| Cloudflare Pages | 控制台 → Workers & Pages → 创建 → Pages → 上传资产，把整个文件夹拖进去 | `xxx.pages.dev`，国内访问相对稳定 |
| GitHub Pages | 新建仓库，上传文件，Settings → Pages 选 main 分支 | `用户名.github.io/仓库名` |
| Netlify Drop | 打开 app.netlify.com/drop，把文件夹拖进去 | `xxx.netlify.app` |

这三个都免费，作品数量在几十幅以内都不会超出额度。
