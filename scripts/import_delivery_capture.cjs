/** Import a completed isolated capture and use actual durations, never frozen padding. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),work=process.env.DELIVERY_WORK;
if(!work)throw Error('Set DELIVERY_WORK to the completed isolated capture');
const manifest=JSON.parse(fs.readFileSync(path.join(work,'scenes.json')));
const evidence=JSON.parse(fs.readFileSync(path.join(work,'capture-events.json')));
if(manifest.length!==9||!evidence.isolatedDatabase||evidence.modelCalls!==0)throw Error('Need nine verified isolated scenes');
const p=path.join(root,'video/src/scenes.json'),scenes=JSON.parse(fs.readFileSync(p));
for(let i=0;i<9;i++){
 const file=path.join(work,`${String(i+1).padStart(2,'0')}.webm`);
 const duration=Number(cp.execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file]).toString());
 scenes[i].playbackRate=duration/25;scenes[i].rawDuration=duration;
 fs.copyFileSync(file,path.join(root,'video/public',path.basename(file)));
}
const mobile=evidence.events.find(e=>e.scene===9&&e.kind==='viewport');if(!mobile)throw Error('Missing recorded mobile viewport event');
// Cross-check the viewport event against the actual first mobile frame. Playwright
// pads the unused recording surface gray after the viewport narrows to 390px.
const pixels=cp.execFileSync('ffmpeg',['-v','error','-i',path.join(root,'video/public/09.webm'),'-vf','fps=25,scale=128:72','-pix_fmt','gray','-f','rawvideo','-'],{maxBuffer:20*1024*1024});
let mobileFrame=-1;
for(let f=0;f<pixels.length/(128*72);f++){
 let sum=0,squares=0,count=0;
 for(let y=0;y<72;y++)for(let x=45;x<128;x++){const v=pixels[f*128*72+y*128+x];sum+=v;squares+=v*v;count++;}
 const mean=sum/count,variance=squares/count-mean*mean;
 if(mean>110&&mean<150&&variance<0.5){mobileFrame=f;break;}
}
if(mobileFrame<0||Math.abs(mobileFrame/25-mobile.seconds)>1)throw Error('Viewport event does not match actual mobile footage');
scenes[8].mobileSourceSeconds=mobileFrame/25;
scenes[8].mobileStartFrame=Math.ceil(scenes[8].mobileSourceSeconds/scenes[8].playbackRate*30);
fs.writeFileSync(p,JSON.stringify(scenes,null,2)+'\n');
fs.copyFileSync(path.join(work,'capture-events.json'),path.join(root,'video/capture-events.json'));
const summary=JSON.parse(fs.readFileSync(path.join(process.env.DELIVERY_SCREENSHOTS||path.join(root,'docs/delivery/screenshots'),'manifest.json')));
const {kind,capturedAt,base,isolatedDatabase,modelCallsDuringCapture,verification}=summary;
if(kind!=='real-http'||!isolatedDatabase||modelCallsDuringCapture!==0||verification.completedDelta!==1||verification.consoleErrors.length)throw Error('Capture business assertions failed');
fs.writeFileSync(path.join(root,'video/capture-summary.json'),JSON.stringify({kind,capturedAt,base,isolatedDatabase,modelCallsDuringCapture,verification},null,2)+'\n');
console.log('Imported all nine continuous recordings with measured playback rates');
