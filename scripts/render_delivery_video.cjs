/** Compose the captured HTTP scenes and explicitly labeled evidence slides.
 * Requires Playwright, ffmpeg/ffprobe, Python with Pillow, and macOS say Chinese voice.
 * Input: capture_report.cjs output; never sends application or model requests.
 */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'), out=path.join(root,'docs/delivery');
const work=path.resolve(process.env.DELIVERY_WORK||path.join(root,'../final-video'));
const run=(cmd,args)=>cp.execFileSync(cmd,args,{stdio:['ignore','pipe','pipe'],env:process.env});
const probe=file=>JSON.parse(run('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json',file]));
const png=p=>'data:image/png;base64,'+fs.readFileSync(p).toString('base64');
const stamp=s=>`${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')},000`;
(async()=>{
 const scenes=JSON.parse(fs.readFileSync(path.join(work,'scenes.json')));if(scenes.length!==9)throw Error('Need all 9 successful HTTP scenes');
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:720}});
 const slide=async(n,title,source,lines,body)=>{
  await page.setContent(`<html><meta charset="utf-8"><style>body{margin:0;background:#f7f6f1;color:#18372e;font-family:'PingFang SC',sans-serif}main{padding:40px 60px}h1{font-size:36px;margin:0 0 18px}h2{font-size:25px;margin:20px 0 10px}p,li{font-size:23px;line-height:1.7}.grid{display:grid;grid-template-columns:1fr 1fr;gap:36px}.box{background:white;padding:20px 26px;border-radius:16px}img{object-fit:contain}small{font-size:17px;color:#637265}</style><main>${body}</main></html>`);
  await page.screenshot({path:path.join(work,`${n}.png`)});
  scenes.push({number:n,title,source,image:path.join(work,`${n}.png`),lines});
 };
 await slide(10,'真实 AI：采用之前，先核对事实','既有真实截图 · 第5次请求 · 本次录制零模型调用',[
 '这张截图来自此前第五次真实模型调用，不是本次新请求。',
 '该次建议为随便给，没有数值报价；核对事实后采用发布。',
 '累计五次真实调用，早期无效全范围报价已修复并加入回归。'],
 `<h1>真实 AI 证据回看</h1><div class="grid"><div><img style="width:530px;height:550px" src="${png(path.join(out,'screenshots/ai-preview.png'))}"></div><div><h2>第 5 次 · 真实浏览器调用</h2><p>DeepSeek → FLEXIBLE / null<br>建议方式：随便给</p><p>逐句核验输入事实<br>采用文案与交易方式<br>手动确认发布成功</p><div class="box"><p>4 次脚本 + 1 次浏览器<br>本次材料制作：0 新调用</p></div><small>既有截图的回看，不模拟点击生成。<br>数值参考价不是市场行情认证。</small></div></div>`);
 await slide(11,'实现：同源 API、事务与六实体','讲解页 · 与实际迁移001/002核对一致',[
 '前端通过同源接口访问后端，密钥只在服务端环境。',
 '六张表、九个外键；主键、属性和联系已逐项核对。',
 '事务和唯一索引保护预约，重复确认不会增加成交记录。'],
 `<h1>实现结构与数据关系</h1><div class="grid"><div><div class="box"><h2>React + TypeScript + Vite</h2><p>↓ 同源 /api/v1<br>Node.js + Fastify<br>↓ 事务与运行时契约<br>SQLite + Drizzle</p></div><p>模型调用只发生在服务端<br>6 张表 · 9 个外键 · 10 张 ER 图</p></div><img style="width:520px;height:540px" src="${png(path.join(root,'docs/engineering/diagrams/er-global.png'))}"></div>`);
 await slide(12,'验收与交付：证据分开记录','讲解页 · 实际测试结果与交付边界',[
 '一百零二项测试、四项真实端到端用例通过，另有五次真实模型记录。',
 'Codex 辅助实现与测试，协调者审查提交、真实截图和运行结果。',
 '交付文档、十张图与本视频；已完成本地验收，没有远端部署。'],
 `<h1>可复现的本地交付</h1><div class="grid"><div class="box"><h2>102 项单元 / 集成测试</h2><p>权限、事务、幂等、月边界<br>AI 异常与草稿保留</p><h2>4 项真实 HTTP E2E</h2><p>双身份交易 · 取消重约<br>30 图片解码 · 进程重启持久化</p></div><div><h2>AI Coding 与复核</h2><p>Codex 辅助需求、代码和测试<br>协调者审查 PR 与真实运行证据<br>逐页排版检查 · 视频抽帧核验</p><div class="box"><p>Word / PDF / 10 对 SVG+PNG<br>实际录屏 / 中文讲解 / 字幕</p></div><small>合成语音讲解；软件流程使用虚构演示数据。<br>物理交接在线下完成。未做远端部署。</small></div></div>`);
 await browser.close();
 let srt=[],transcript=['# 视频讲解与镜头来源','', '成片由 9 段真实 HTTP 浏览器录屏与 3 段标明来源的证据/实现讲解页组成；每段 25 秒，共 300 秒。中文旁白为本机合成语音，不冒充真人录音。',''];
 for(let i=0;i<scenes.length;i++){
  const s=scenes[i],start=i*25,prefix=String(i+1).padStart(2,'0');
  transcript.push(`## ${stamp(start).slice(0,8)} ${s.title}`,s.source,'',...s.lines,'');
  let audio=[];
  for(let j=0;j<3;j++){
   const stem=path.join(work,`${prefix}-${j}`);fs.writeFileSync(stem+'.txt',s.lines[j]);
   run('say',['-v','Tingting (中文（中国大陆）)','-r','230','-f',stem+'.txt','-o',stem+'.aiff']);
   const duration=Number(probe(stem+'.aiff').format.duration);const tempo=Math.max(1,duration/7.4);
   run('ffmpeg',['-y','-v','error','-i',stem+'.aiff','-af',`atempo=${tempo},apad`,'-t',String(j===2?9:8),'-ar','48000','-ac','1',stem+'.wav']);audio.push(stem+'.wav');
   srt.push(`${srt.length+1}\n${stamp(start+j*8)} --> ${stamp(start+(j===2?25:(j+1)*8))}\n${s.lines[j]}\n`);
  }
  fs.writeFileSync(path.join(work,`${prefix}-audio.txt`),audio.map(a=>`file '${a}'`).join('\n'));
  run('ffmpeg',['-y','-v','error','-f','concat','-safe','0','-i',path.join(work,`${prefix}-audio.txt`),'-c','copy',path.join(work,`${prefix}.wav`)]);
  const overlayBase=path.join(work,`${prefix}-overlay`);
  fs.writeFileSync(overlayBase+'.json',JSON.stringify(s));
  run(process.env.DELIVERY_PYTHON||'python3',[path.join(__dirname,'render_video_overlay.py'),overlayBase+'.json']);
  const input=s.video?['-i',s.video]:['-loop','1','-i',s.image];
  const overlays=[0,1,2].flatMap(j=>['-loop','1','-i',overlayBase+`-${j}.png`]);
  // Reframe the narrow browser viewport after its recorded resize; retain real pixels.
  const mobile=s.number===9?"[0:v]split[d][m];[m]crop=390:720:0:0,pad=1280:720:445:0:color=0xf7f6f1[phone];[d][phone]overlay=enable='gte(t,8)'[source];":'';
  const source=s.number===9?'[source]':'[0:v]';
  const filter=mobile+`${source}fps=20,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0xf7f6f1,tpad=stop_mode=clone:stop_duration=25,pad=1280:864:0:80:color=0x18372e[v];[v][2:v]overlay=enable='lt(t,8)'[a];[a][3:v]overlay=enable='gte(t,8)*lt(t,16)'[b];[b][4:v]overlay=enable='gte(t,16)'[out]`;
  run('ffmpeg',['-y','-v','error',...input,'-i',path.join(work,`${prefix}.wav`),...overlays,'-filter_complex',filter,'-map','[out]','-map','1:a','-t','25','-c:v','libx264','-preset','fast','-crf','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart',path.join(work,`${prefix}.mp4`)]);
  console.log('Rendered',prefix,s.title);
 }
 fs.writeFileSync(path.join(work,'concat.txt'),scenes.map((_,i)=>`file '${path.join(work,String(i+1).padStart(2,'0')+'.mp4')}'`).join('\n'));
 const final=path.join(out,'邻里闲置_演示视频.mp4');
 run('ffmpeg',['-y','-v','error','-f','concat','-safe','0','-i',path.join(work,'concat.txt'),'-c','copy','-movflags','+faststart',final]);
 fs.writeFileSync(path.join(out,'邻里闲置_演示字幕.srt'),srt.join('\n'));
 fs.writeFileSync(path.join(out,'video-transcript.md'),transcript.join('\n'));
 fs.writeFileSync(path.join(work,'final-probe.json'),JSON.stringify(probe(final),null,2));
 console.log('Created',final);
})().catch(e=>{console.error(e.message,e.stderr?.toString());process.exitCode=1});
