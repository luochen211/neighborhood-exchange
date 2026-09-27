# 配乐与声音制作

[视频成片](邻里闲置_演示视频.mp4) · [独立 BGM](邻里闲置_背景音乐.mp3)

本配乐由项目脚本直接编排并合成，无歌词，不下载第三方录音或采样，不调用音乐模型。音色由正弦振荡器、谐波、确定性噪声和包络产生，可从代码重建。

- **速度**：115.2 BPM，4/4 拍。12 小节正好 25 秒，对齐每个视频章节；整首 144 小节、300 秒。
- **和声**：Dmaj7 → Bm7 → Gmaj7 → Aadd9；暖色铺底、低音与短音旋律交替。
- **节奏**：底鼓、军鼓、带轻微错拍的踩镲；部分章节开头减掉鼓组，为重点讲解留空间。
- **层次**：前奏渐入、完整律动、AI/架构段落减配、尾声渐弱，章节切换加入短扫音和提示音。
- **混音**：保持原中文旁白；音乐受旁白侧链压缩控制，讲解时自动变轻，句间恢复。最终立体声混音按 -16 LUFS / -1.5 dBTP 目标处理，不用音乐覆盖信息。

生成代码：[score_delivery_music.py](../../scripts/score_delivery_music.py)。[音频制作入口](../../scripts/prepare_delivery_audio.cjs) 生成旁白与侧链混音；[Remotion 工程](../../video/README.md) 完成唯一的最终画面/音轨渲染。

```sh
# 单独重建配乐
python3 scripts/score_delivery_music.py /tmp/neighborhood-score.wav
# 重建旁白与混音；需 macOS say、FFmpeg、NumPy
node scripts/prepare_delivery_audio.cjs
# 用已保存真实录像及混音渲染成片
npm ci --prefix video
npm run render --prefix video
```

Remotion 依赖由 video/package-lock.json 锁定。既有旁白、字幕语义与 AI 证据保留；配乐不被当作新的真实操作证据。
