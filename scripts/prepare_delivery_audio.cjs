/** Rebuild narration and original soundtrack; no network or application calls. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const work=path.resolve(process.env.DELIVERY_WORK||path.join(root,'../remotion-audio'));
const pub=path.join(root,'video/public');
const run=(bin,args)=>cp.execFileSync(bin,args,{stdio:'inherit'});
fs.mkdirSync(work,{recursive:true});
const scenes=JSON.parse(fs.readFileSync(path.join(root,'video/src/scenes.json')));
const pieces=[];
for(let i=0;i<scenes.length;i++)for(let j=0;j<3;j++){
 const stem=path.join(work,`${i+1}-${j}`);
 fs.writeFileSync(stem+'.txt',scenes[i].lines[j]);
 run('say',['-v','Tingting (中文（中国大陆）)','-r','230','-f',stem+'.txt','-o',stem+'.aiff']);
 const duration=Number(cp.execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',stem+'.aiff']).toString());
 run('ffmpeg',['-y','-v','error','-i',stem+'.aiff','-af',`atempo=${Math.max(1,duration/7.4)},apad`,'-t',String(j===2?9:8),'-ar','48000','-ac','1',stem+'.wav']);
 pieces.push(stem+'.wav');
}
fs.writeFileSync(path.join(work,'audio.txt'),pieces.map(p=>`file '${p}'`).join('\n'));
run('ffmpeg',['-y','-v','error','-f','concat','-safe','0','-i',path.join(work,'audio.txt'),'-c','copy',path.join(work,'voice.wav')]);
run(process.env.DELIVERY_PYTHON||'python3',[path.join(__dirname,'score_delivery_music.py'),path.join(work,'score.wav')]);
const mix='[0:a]highpass=f=75,aformat=channel_layouts=stereo,asplit=2[voice][sc];[1:a]volume=0.24[bed];[bed][sc]sidechaincompress=threshold=0.015:ratio=8:attack=15:release=420:makeup=1:level_sc=1[duck];[voice][duck]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=7[mix]';
run('ffmpeg',['-y','-v','error','-i',path.join(work,'voice.wav'),'-i',path.join(work,'score.wav'),'-filter_complex',mix,'-map','[mix]','-t','300','-ar','48000','-c:a','aac','-b:a','192k',path.join(pub,'mix.m4a')]);
run('ffmpeg',['-y','-v','error','-i',path.join(work,'score.wav'),'-af','loudnorm=I=-18:TP=-1.5:LRA=8','-c:a','libmp3lame','-b:a','192k',path.join(root,'docs/delivery/邻里闲置_背景音乐.mp3')]);
