# Silen1 的画室

一个纯静态的个人画作网站，做成小型美术馆的样子（「白厅」）：

- **首页**：展览海报式的首屏（最新一幅画）→ 展厅（一面墙挂一幅画，旁边是展签：编号、标题、英文名、年份、媒材）→ 作品目录 → 关于。
- **作品详情页**：大图挂在墙上，展签、创作信息、绘画过程回放，以及上一件 / 下一件。
- 编号按完成顺序，最早的一幅是 No. 01；展示时新的在前。

全部是 HTML + CSS + 原生 JavaScript，**没有框架、不用编译、不连接任何外部网站**。

---

## 文件结构

```
index.html          首页
work.html           作品详情页，通过 work.html?id=作品id 打开
404.html            找不到页面时显示
css/style.css       所有样式，最上面的 :root 里可以改颜色
js/main.js          所有交互
data/works.js       作品列表（加画、改标题都在这里）
works/<id>/         每幅作品一个文件夹：大图、小图、缩时视频
assets/             网站图标、分享预览图 og.jpg
assets/fonts/       网站字体（只包含用到的字），许可见 OFL.txt
tools/add-work.py   自动处理并登记新作品
tools/subset-fonts.py 重新生成网站字体
```

## 加一幅新画

### 方法一：用脚本（推荐）

需要 Python 3 和 Pillow（`pip install Pillow`），处理缩时视频还需要 ffmpeg。

1. 在 Procreate 里：**操作 → 分享 → PNG** 导出成品；**操作 → 视频 → 导出缩时视频**（选“30 秒”即可）。
2. 在网站文件夹里运行：

```bash
python3 tools/add-work.py \
  --id sleepy-cat \
  --title "睡着的猫" \
  --date 2026-11-01 \
  --image ~/Desktop/猫.png \
  --timelapse ~/Desktop/猫.mp4 \
  --hours 4 --brushes "6B 铅笔,水彩" \
  --notes "午后的光很好。" \
  --title-en "Sleeping Cat"
```

脚本会自动压缩图片（WebP）、**清除图片和视频里的元数据**、把视频压到 720p 并控制在 24 秒内，然后写进 `data/works.js`。
用同一个 `--id` 再运行一次就是更新。标题里有新的汉字时，再运行一次 `tools/subset-fonts.py`（见脚本开头的说明），否则那几个字会用系统宋体显示。

### 方法二：手动

1. 在 `works/` 下新建文件夹，比如 `works/sleepy-cat/`。
2. 放入压缩好的大图（建议长边 2000 像素以内的 WebP 或 JPG）、一张宽 800 的小图，和可选的 `timelapse.mp4`。可以用 [Squoosh](https://squoosh.app) 在网页里压缩图片。
3. 打开 `data/works.js`，照着已有的格式加一项：

```json
{
  "id": "sleepy-cat",
  "title": "睡着的猫",
  "title_en": "Sleeping Cat",
  "date": "2026-11-01",
  "image": "works/sleepy-cat/sleepy-cat.webp",
  "thumb": "works/sleepy-cat/sleepy-cat-thumb.webp",
  "width": 1600,
  "height": 2000,
  "timelapse": "works/sleepy-cat/timelapse.mp4",
  "app": "Procreate",
  "canvas": "2048 × 2560 px",
  "hours": 4,
  "brushes": ["6B 铅笔", "水彩"],
  "tags": ["猫"],
  "notes": "午后的光很好。"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 英文、数字和短横线，用在网址里 |
| `title` | 是 | 作品标题 |
| `title_en` | 建议 | 英文标题，显示在展签上 |
| `image` | 是 | 大图路径 |
| `width` / `height` | 建议 | 大图的像素尺寸，用来提前占好位置、避免页面跳动 |
| `date` | 建议 | 完成日期，列表按它从新到旧排列 |
| `thumb` | 否 | 列表用的小图，不填就用大图 |
| `timelapse` | 否 | 缩时视频，有它才有回放 |
| 其它 | 否 | `app`、`canvas`、`hours`、`brushes`、`tags`、`notes` 会显示在详情页 |

注意 `works.js` 必须是合法的 JSON：用双引号，最后一项后面不要加逗号。

## 要改成你自己的地方

- `index.html` 里首屏的展名「墨与线 / Ink & Line」和“关于”那一段。
- `assets/og.jpg`：分享到社交平台时显示的预览图，1200×630。
- 颜色：`css/style.css` 最上面的 `--wall`、`--ink`、`--seal`。

## 本地预览

在网站文件夹里运行 `python3 -m http.server`，然后打开 <http://localhost:8000>。
直接双击 `index.html` 也能看，但部分浏览器会限制本地视频的拖动。

## 托管

见 `HANDOFF.md`：交给 ChatGPT Sites 的步骤，以及几个同样免费的备选托管方式。

## 安全细节

- 每个页面都设置了内容安全策略（CSP）：只允许加载本站自己的脚本、样式、图片和视频，不加载任何第三方资源。
- 页面用 DOM API 插入作品数据，不拼接 HTML，标题里写了特殊字符也不会变成代码。
- 添加作品的脚本会去掉 EXIF、GPS 等元数据。
- 如果托管平台需要注入自己的脚本（比如统计代码）导致页面异常，把 `index.html` 和 `work.html` 里的 `Content-Security-Policy` 那一行删掉即可。
