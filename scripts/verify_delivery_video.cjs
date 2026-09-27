/** Verify actual source coverage and editorial geometry before rendering. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const scenes=JSON.parse(fs.readFileSync(path.join(root,'video/src/scenes.json')));
const layout=JSON.parse(fs.readFileSync(path.join(root,'video/src/layout.json')));
const rects=Object.values(layout);
for(const r of rects){assert(r.x>=0&&r.y>=0&&r.x+r.w<=1920&&r.y+r.h<=1080);}
for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
 const a=rects[i],b=rects[j];assert(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'Editorial regions overlap');
}
(async()=>{
 const browser=await chromium.launch();const page=await browser.newPage();
 const widths=await page.evaluate(lines=>{const c=document.createElement('canvas').getContext('2d');c.font='32px "PingFang SC", "Microsoft YaHei", sans-serif';return lines.map(text=>({text,width:c.measureText(text).width}));},scenes.flatMap(s=>s.lines));
 await browser.close();for(const x of widths)assert(x.width<=layout.caption.w-40,`Subtitle too wide: ${x.text}`);
 const media=[];
 for(let i=0;i<9;i++){
  const file=path.join(root,'video/public',`${String(i+1).padStart(2,'0')}.webm`);
  const p=JSON.parse(cp.execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file]));
  const duration=Number(p.format.duration),played=duration/scenes[i].playbackRate;
  assert(played>=25&&played<25.1,`Source ${i+1} does not cover 25 seconds exactly`);
  assert(p.streams[0].width===1280&&p.streams[0].height===720);
  const raw=cp.execFileSync('ffmpeg',['-v','error','-i',file,'-vf','fps=2,scale=160:90','-pix_fmt','gray','-f','rawvideo','-'],{maxBuffer:4*1024*1024});
  const size=160*90,frames=raw.length/size;let changed=0,run=0,longest=0,maxDifference=0;
  for(let f=1;f<frames;f++){
   let sum=0;for(let p=0;p<size;p++)sum+=Math.abs(raw[f*size+p]-raw[(f-1)*size+p]);
   const difference=sum/size;maxDifference=Math.max(maxDifference,difference);
   if(difference>.15){changed++;run=0;}else{run++;longest=Math.max(longest,run);}
  }
  assert(changed>=6,`Scene ${i+1} lacks visible page changes`);
  media.push({scene:i+1,duration,playbackRate:scenes[i].playbackRate,played,sampledFrames:frames,changedIntervals:changed,longestNearStillSeconds:longest*.5,maxFrameDifference:Number(maxDifference.toFixed(2))});
 }
 assert(scenes[8].mobileStartFrame>0&&scenes[8].mobileStartFrame<750);
 const result={layout,subtitleMaxWidth:Math.max(...widths.map(x=>x.width)),subtitleCount:widths.length,media,mobileStartFrame:scenes[8].mobileStartFrame};
 fs.writeFileSync(path.join(root,'video/verification.json'),JSON.stringify(result,null,2)+'\n');
 console.log('PASS: no region overlap, all subtitles fit, all nine sources cover their full sequence');
})().catch(e=>{console.error(e);process.exitCode=1});
