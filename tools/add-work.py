#!/usr/bin/env python3
"""
把一幅新画加进网站。

它会自动：
  1. 把图片压缩成两种尺寸的 WebP（列表用小图，详情页用大图），并去掉 EXIF 等元数据
  2. 把 Procreate 导出的缩时视频压到 720p、去掉声音和元数据，并控制在指定时长内
  3. 在 data/works.js 里登记这幅画（同一个 id 再运行一次就是更新）

首页会按日期从新到旧，一幅接一幅地“掉进”画里的洞口。--portal 决定这幅画的洞开在哪里。

需要：Python 3.8+、Pillow（pip install Pillow），处理视频还需要 ffmpeg。

例子：
  python3 tools/add-work.py --image ~/Desktop/猫.png --title "睡着的猫" --date 2026-11-01 \
      --timelapse ~/Desktop/猫.mp4 --hours 4 --brushes "6B 铅笔,水彩" \
      --notes "午后的光很好。" --portal 0.62,0.35
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("缺少 Pillow，请先运行：pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
WORKS_DIR = ROOT / "works"
DATA_FILE = ROOT / "data" / "works.js"
PREFIX = "window.WORKS = "

THUMB_W = 800      # 列表小图宽度
LARGE_EDGE = 2000  # 详情页大图最长边


def slugify(text):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s or date.today().strftime("work-%Y%m%d")


def load_works():
    if not DATA_FILE.exists():
        return []
    raw = DATA_FILE.read_text(encoding="utf-8")
    start = raw.index(PREFIX) + len(PREFIX)
    body = raw[start:].strip().rstrip(";")
    return json.loads(body)


def save_works(works):
    header = (
        "/* 作品列表。可以手动编辑，也可以用 tools/add-work.py 自动添加。\n"
        "   每个字段的含义见 README.md。注意：必须保持合法的 JSON 格式（双引号、最后一项后面不要逗号）。 */\n"
    )
    DATA_FILE.write_text(header + PREFIX + json.dumps(works, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")


def flatten(img):
    """透明背景铺成白色，统一成 RGB；同时丢掉所有元数据。"""
    img = ImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        return bg
    return img.convert("RGB")


def process_image(src, out_dir, wid):
    img = flatten(Image.open(src))
    large = img.copy()
    large.thumbnail((LARGE_EDGE, LARGE_EDGE), Image.LANCZOS)
    thumb = img.copy()
    if thumb.width > THUMB_W:
        thumb = thumb.resize((THUMB_W, round(thumb.height * THUMB_W / thumb.width)), Image.LANCZOS)
    large_path = out_dir / f"{wid}.webp"
    thumb_path = out_dir / f"{wid}-thumb.webp"
    # 重新保存时不传 exif / icc 参数，元数据就不会被带过去
    large.save(large_path, "WEBP", quality=84, method=6)
    thumb.save(thumb_path, "WEBP", quality=80, method=6)
    return large_path, thumb_path, large.size, img.size


def probe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def process_video(src, out_dir, max_seconds):
    if not shutil.which("ffmpeg"):
        sys.exit("处理视频需要 ffmpeg：macOS 用 brew install ffmpeg，Windows 用 winget install ffmpeg")
    dst = out_dir / "timelapse.mp4"
    dur = probe_duration(src)
    vf = ["scale='min(720,iw)':-2", "fps=30", "format=yuv420p"]
    if dur > max_seconds:
        vf.insert(0, f"setpts=PTS*{max_seconds / dur:.6f}")  # 太长就加速
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
        "-vf", ",".join(vf), "-an", "-map_metadata", "-1",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
        "-g", "6", "-keyint_min", "6", "-sc_threshold", "0",  # 关键帧密一点，滚动拖动才顺滑
        "-movflags", "+faststart", str(dst),
    ]
    subprocess.run(cmd, check=True)
    return dst


def main():
    ap = argparse.ArgumentParser(description="把一幅新画加进网站")
    ap.add_argument("--image", required=True, help="Procreate 导出的 PNG/JPG")
    ap.add_argument("--title", required=True, help="作品标题")
    ap.add_argument("--title-en", help="英文标题，显示在展签上（可选），比如 Swallow")
    ap.add_argument("--id", help="网址里用的英文名，比如 sleepy-cat；不填会根据日期生成")
    ap.add_argument("--date", default=date.today().isoformat(), help="完成日期，格式 2026-11-01")
    ap.add_argument("--timelapse", help="Procreate 导出的缩时视频（可选）")
    ap.add_argument("--max-seconds", type=float, default=24, help="缩时视频最长秒数，超过会自动加速（默认 24）")
    ap.add_argument("--hours", type=float, help="大概画了几小时")
    ap.add_argument("--brushes", help="用到的笔刷，逗号分隔")
    ap.add_argument("--tags", help="标签，逗号分隔")
    ap.add_argument("--notes", default="", help="几句创作心得")
    ap.add_argument("--canvas", help="画布尺寸，不填就按原图像素")
    ap.add_argument("--app", help="用的软件，比如 Procreate（可选）")
    ap.add_argument("--portal", help="洞口位置“横,纵”，0~1，比如 0.5,0.3 表示水平居中、离顶部 30%%；不填会随机挑一个")
    a = ap.parse_args()

    wid = slugify(a.id or "") if a.id else date.fromisoformat(a.date).strftime("work-%Y%m%d")
    out_dir = WORKS_DIR / wid
    out_dir.mkdir(parents=True, exist_ok=True)

    large, thumb, (w, h), (ow, oh) = process_image(Path(a.image).expanduser(), out_dir, wid)
    entry = {
        "id": wid,
        "title": a.title,
        "date": a.date,
        "image": large.relative_to(ROOT).as_posix(),
        "thumb": thumb.relative_to(ROOT).as_posix(),
        "width": w,
        "height": h,
        "canvas": a.canvas or f"{ow} × {oh} px",
    }
    if a.title_en:
        entry = {**{k: entry[k] for k in ("id", "title")}, "title_en": a.title_en, **{k: v for k, v in entry.items() if k not in ("id", "title")}}
    if a.app:
        entry["app"] = a.app
    if a.timelapse:
        entry["timelapse"] = process_video(Path(a.timelapse).expanduser(), out_dir, a.max_seconds).relative_to(ROOT).as_posix()
    if a.hours:
        entry["hours"] = a.hours if a.hours % 1 else int(a.hours)
    if a.brushes:
        entry["brushes"] = [b.strip() for b in re.split(r"[,，、]", a.brushes) if b.strip()]
    if a.tags:
        entry["tags"] = [t.strip() for t in re.split(r"[,，、]", a.tags) if t.strip()]
    if a.notes:
        entry["notes"] = a.notes
    if a.portal:
        try:
            u, v = (float(x) for x in re.split(r"[,，]", a.portal))
            assert 0 <= u <= 1 and 0 <= v <= 1
        except Exception:
            sys.exit("--portal 格式不对，应该像 0.5,0.3 这样，两个 0 到 1 之间的数")
        entry["portal"] = [u, v]

    works = load_works()
    works = [x for x in works if x.get("id") != wid] + [entry]
    save_works(works)

    size = sum(f.stat().st_size for f in out_dir.iterdir()) / 1024 / 1024
    print(f"已添加「{a.title}」 → works/{wid}/（共 {size:.1f} MB）")
    print("如果标题里有新的汉字，记得运行 tools/subset-fonts.py 更新网站字体")
    print(f"本地预览：在网站文件夹运行 python3 -m http.server，然后打开 http://localhost:8000/work.html?id={wid}")


if __name__ == "__main__":
    main()
