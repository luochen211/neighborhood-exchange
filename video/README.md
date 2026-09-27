# Remotion 演示视频

固定 1920×1080 / 30 fps / 9000 帧。网页区域 `(192,124,1536,864)`，标题区域结束于 y=106，字幕始于 y=1003，均不重叠。每段原始浏览器录像完整播放，不用定格、循环或截图缩放补足时间。

```sh
cd video
npm ci
npm run typecheck
npm run studio        # 编辑、预览场景
npm run render        # 输出 docs/delivery/邻里闲置_演示视频.mp4
npm run render -- --sample  # 前15秒样片
```

`src/index.tsx` 是唯一画面合成实现；`src/scenes.json` 定义旁白、原始素材时长和播放速率。`public/01.webm` 至 `09.webm` 来自真实 HTTP 浏览器连续操作，已保存供无数据库重渲染。后 3 章是明确标记的历史 AI 证据与技术说明。`public/mix.m4a` 是中文旁白和原创背景音乐的侧链混音。

全部依赖由本目录 package-lock.json 锁定。首次渲染会自动下载 Chromium。完整重录按 docs/delivery/README.md 的隔离环境步骤执行；音频可用 `node scripts/prepare_delivery_audio.cjs` 从仓库根目录重新生成（需 macOS say、FFmpeg 和带 NumPy 的 Python，通过 DELIVERY_PYTHON 指定）。音频预处理不合成或改动网页视频；最终画面与声音由 Remotion 渲染。
