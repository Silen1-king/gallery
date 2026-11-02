#!/usr/bin/env python3
"""
把网站用到的字从完整字体里挑出来，生成很小的网页字体，放进 assets/fonts/。

加了新作品、改了页面上的文字以后运行一次，新出现的汉字才会用上网站字体
（没运行也不会坏，只是那几个字会用系统自带的宋体显示）。

需要：pip install fonttools brotli
完整字体（不放进仓库，体积大）：
  Noto Serif SC（SIL OFL 1.1）  noto-serif-sc-chinese-simplified-400-normal.woff2 / -600-normal.woff2
  Cormorant Garamond（SIL OFL 1.1）cormorant-garamond-latin-400-normal.woff2 / -400-italic.woff2
都可以从 npm 包 @fontsource/noto-serif-sc 和 @fontsource/cormorant-garamond 的 files/ 目录里拿到。

用法：
  python3 tools/subset-fonts.py --src 放完整字体的文件夹
"""
import argparse
import re
import sys
from pathlib import Path

try:
    from fontTools import subset
except ImportError:
    sys.exit("缺少 fonttools，请先运行：pip install fonttools brotli")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "fonts"
TEXT_FILES = ["index.html", "work.html", "404.html", "js/main.js", "data/works.js"]
# 常用标点、数字、字母总是带上
BASE = "".join(chr(c) for c in range(0x20, 0x7F)) + "·×—–…“”‘’、。，：；！？（）《》「」『』【】　©→←"

FONTS = [
    ("noto-serif-sc-chinese-simplified-400-normal.woff2", "serif-400.woff2", "cjk"),
    ("noto-serif-sc-chinese-simplified-600-normal.woff2", "serif-600.woff2", "cjk"),
    ("cormorant-garamond-latin-400-normal.woff2", "latin-400.woff2", "latin"),
    ("cormorant-garamond-latin-400-italic.woff2", "latin-400i.woff2", "latin"),
]


def collect_text():
    text = BASE
    for name in TEXT_FILES:
        p = ROOT / name
        if p.exists():
            raw = p.read_text(encoding="utf-8")
            # JSON 里的 \uXXXX 也解出来
            raw += re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), raw)
            text += raw
    return "".join(sorted(set(text)))


def main():
    ap = argparse.ArgumentParser(description="生成网站用的小字体")
    ap.add_argument("--src", default=str(ROOT / "tools" / "fonts-src"), help="放完整字体的文件夹")
    a = ap.parse_args()
    src = Path(a.src).expanduser()
    text = collect_text()
    latin_text = "".join(c for c in text if ord(c) < 0x3000)
    OUT.mkdir(parents=True, exist_ok=True)
    for src_name, out_name, kind in FONTS:
        f = src / src_name
        if not f.exists():
            sys.exit(f"找不到 {f}，请用 --src 指向放完整字体的文件夹")
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]
        font = subset.load_font(str(f), opts)
        s = subset.Subsetter(opts)
        s.populate(text=text if kind == "cjk" else latin_text)
        s.subset(font)
        subset.save_font(font, str(OUT / out_name), opts)
        print(f"{out_name}: {(OUT / out_name).stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
