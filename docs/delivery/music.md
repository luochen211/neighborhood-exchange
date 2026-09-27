# 配乐与声音制作

[视频成片](邻里闲置_演示视频.mp4) · [独立 BGM](邻里闲置_背景音乐.mp3)

本配乐由项目脚本直接编排并合成，无歌词，不下载第三方录音或采样，不调用音乐模型。音色由正弦振荡器、谐波、确定性噪声和包络产生，可从代码重建。

- **速度**：115.2 BPM，4/4 拍。12 小节正好 25 秒，对齐每个视频章节；整首 144 小节、300 秒。
- **和声**：Dmaj7 → Bm7 → Gmaj7 → Aadd9；暖色铺底、低音与短音旋律交替。
- **节奏**：底鼓、军鼓、带轻微错拍的踩镲；部分章节开头减掉鼓组，为重点讲解留空间。
- **层次**：前奏渐入、完整律动、AI/架构段落减配、尾声渐弱，章节切换加入短扫音和提示音。
- **混音**：保持原中文旁白；音乐受旁白侧链压缩控制，讲解时自动变轻，句间恢复。最终立体声混音按 -16 LUFS / -1.5 dBTP 目标处理，不用音乐覆盖信息。

生成代码：[score_delivery_music.py](../../scripts/score_delivery_music.py)。视频排版、动效和自动混音由 [style_delivery_video.py](../../scripts/style_delivery_video.py) 执行；完整制作入口仍为 [render_delivery_video.cjs](../../scripts/render_delivery_video.cjs)。

单独重建配乐：

```sh
python3 scripts/score_delivery_music.py /tmp/neighborhood-score.wav
```

在保留已有逐段录屏、旁白组装文件和来源 JSON 的工作目录中重新制作画面/混音：

```sh
python3 scripts/style_delivery_video.py --work /absolute/path/to/final-video
```

依赖：NumPy、Pillow、FFmpeg，以及当前脚本使用的 macOS 系统中文字体。原始旁白、证据截图与字幕语义没有改变，配乐不被当作新的真实操作证据。
