"""Add widescreen motion design and a ducked original score to the real delivery footage.
Requires FFmpeg, Pillow, NumPy; only consumes existing recordings, never calls the app.
"""
import argparse,json,subprocess,wave
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from score_delivery_music import compose

ROOT=Path(__file__).resolve().parents[1]
FONT='/System/Library/Fonts/STHeiti Medium.ttc'
W,H=1920,1080
ACCENT='#c9ee81'
TITLES=['看见附近的闲置','把事实写清楚','想要，也能公开交流','把交接约定下来','时间不合适？可以拒绝','保留历史，重新预约','双方确认，准备交接','确认送出，保留记录','成交有记录，手机也顺手','AI 建议，先核对再采用','简单架构，可靠状态','从想法到可运行的交付']
WORDS=['发现','发布','意向','预约','拒绝','重约','确认','归档','统计','AI','架构','验收']

def run(args):
    subprocess.run(args,check=True,stdout=subprocess.DEVNULL)

def font(size):return ImageFont.truetype(FONT,size)
def centered(draw,text,y,size=40,fill='white'):
    f=font(size);draw.text(((W-draw.textlength(text,font=f))/2,y),text,font=f,fill=fill)

def assets(work,scene,i):
    # Warm, restrained green stage keeps high-frequency motion outside the evidence pixels.
    yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
    glow=np.exp(-(((xx-1600)/850)**2+((yy-120)/600)**2))
    bg=np.stack([13+10*glow,27+22*glow,27+12*glow],axis=-1).astype('uint8')
    im=Image.fromarray(bg);d=ImageDraw.Draw(im)
    for x in range(0,W,120):d.line((x,100,x,H-70),fill='#19312e',width=1)
    for y in range(120,H,120):d.line((0,y,W,y),fill='#19312e',width=1)
    d.rounded_rectangle((180,96,1740,972),radius=18,fill='#071414',outline='#45634d',width=2)
    d.text((192,16),'邻里闲置',font=font(40),fill='white')
    d.text((405,24),'NEIGHBORHOOD  /  '+TITLES[i],font=font(25),fill=ACCENT)
    d.text((192,64),scene['source'],font=font(21),fill='#a9bfb4')
    d.text((1640,23),f'{i+1:02} / 12',font=font(29),fill='white')
    # Chapter rail is editorial, separated from the actual application window.
    for j in range(12):
        y=170+j*54;fill=ACCENT if j==i else '#496356'
        d.rounded_rectangle((90,y,96,y+26),radius=3,fill=fill)
        if j==i:d.text((23,y+2),f'{j+1:02}',font=font(23),fill=ACCENT)
    im.save(work/f'{i+1:02}-stage.png')
    for j,line in enumerate(scene['lines']):
        overlay=Image.new('RGBA',(W,H),(0,0,0,0));c=ImageDraw.Draw(overlay)
        size=36
        while c.textlength(line,font=font(size))>1720:size-=1
        centered(c,line,993,size)
        overlay.save(work/f'{i+1:02}-caption-{j}.png')
    badge=Image.new('RGBA',(380,88),(0,0,0,0));b=ImageDraw.Draw(badge)
    b.rounded_rectangle((0,0,379,87),radius=16,fill='#c9ee81')
    b.text((25,20),f'{i+1:02}  {WORDS[i]}',font=font(43),fill='#10271e')
    badge.save(work/f'{i+1:02}-badge.png')

def main(work):
    work=work.resolve();stage=work/'motion';stage.mkdir(exist_ok=True)
    out=ROOT/'docs/delivery'
    scenes=[json.loads((work/f'{i:02}-overlay.json').read_text()) for i in range(1,13)]
    bar=Image.new('RGBA',(1920,6),ACCENT);bar.save(stage/'progress.png')
    stripe=Image.new('RGBA',(180,1080),'#c9ee81');stripe.save(stage/'wipe.png')
    intro=Image.new('RGBA',(1536,864),(13,29,24,240));d=ImageDraw.Draw(intro)
    d.text((105,160),'让闲置',font=font(102),fill='white')
    d.text((105,295),'继续被需要',font=font(102),fill=ACCENT)
    d.text((112,475),'社区闲置流转 · 全栈产品实战',font=font(39),fill='white')
    d.text((112,568),'真实操作  /  数据库  /  AI 辅助  /  5 分钟',font=font(29),fill='#aec8b8')
    d.rounded_rectangle((1180,200,1310,550),radius=65,fill=ACCENT)
    d.rounded_rectangle((1070,310,1420,440),radius=65,fill=ACCENT)
    intro.save(stage/'intro.png')
    for i,scene in enumerate(scenes):
        assets(stage,scene,i);p=f'{i+1:02}'
        inputs=['-loop','1','-i',str(stage/f'{p}-stage.png'),'-i',str(work/f'{p}.mp4')]
        for j in range(3):inputs+=['-loop','1','-i',str(stage/f'{p}-caption-{j}.png')]
        inputs+=['-loop','1','-i',str(stage/f'{p}-badge.png'),'-loop','1','-i',str(stage/'progress.png'),'-loop','1','-i',str(stage/'wipe.png')]
        filters=[
            '[0:v]fps=30,format=yuv420p[bg]',
            '[1:v]crop=1280:720:0:80,scale=1536:864:flags=lanczos,fps=30,format=rgba,fade=t=in:st=0:d=0.25:alpha=1,fade=t=out:st=24.8:d=0.2:alpha=1[app]',
            "[bg][app]overlay=x=192:y='104+18*exp(-t*12)':shortest=1[v]",
            "[v][2:v]overlay=enable='lt(t,8)'[a]",
            "[a][3:v]overlay=enable='gte(t,8)*lt(t,16)'[b]",
            "[b][4:v]overlay=enable='gte(t,16)'[c]",
            # Editorial badge enters in the upper navigation strip, never covers form actions.
            "[c][5:v]overlay=x='if(lt(t,0.4),-400+620*t/0.4,if(lt(t,1.8),220,220-620*(t-1.8)/0.4))':y=124:enable='lt(t,2.2)'[d]",
            f"[d][6:v]overlay=x='-1920+1920*({i*25}+t)/300':y=1074[e]",
            "[e][7:v]overlay=x='-180+2200*t/0.28':y=0:enable='lt(t,0.28)'[f]",
        ]
        if i==0:
            inputs+=['-loop','1','-i',str(stage/'intro.png')]
            filters+=['[8:v]format=rgba,fade=t=out:st=1.7:d=0.6:alpha=1[intro]',"[f][intro]overlay=192:104:enable='lt(t,2.3)'[final]"]
        else:filters+=['[f]null[final]']
        run(['ffmpeg','-y','-v','error',*inputs,'-filter_complex',';'.join(filters),'-map','[final]','-an','-t','25','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(stage/f'{p}.mp4')])
        print('Motion rendered',p,flush=True)
    compose(stage/'score.wav')
    (stage/'join.txt').write_text('\n'.join(f"file '{stage/f'{i:02}.mp4'}'" for i in range(1,13)))
    run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(stage/'join.txt'),'-c','copy',str(stage/'picture.mp4')])
    base=work/'narrated-assembly.mp4'
    # The score breathes between sentences and ducks underneath speech; narration remains intact.
    mix='[0:a]highpass=f=75,aformat=channel_layouts=stereo,asplit=2[voice][sc];[1:a]volume=0.24[bed];[bed][sc]sidechaincompress=threshold=0.015:ratio=8:attack=15:release=420:makeup=1:level_sc=1[duck];[duck]asplit=2[bedmix][meter];[voice][bedmix]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=7[mix]'
    run(['ffmpeg','-y','-v','error','-i',str(base),'-i',str(stage/'score.wav'),'-filter_complex',mix,'-map','[mix]','-t','300','-ar','48000','-c:a','pcm_s24le',str(stage/'mix.wav'),'-map','[meter]','-t','300','-ar','48000','-c:a','pcm_s16le',str(stage/'ducked-music.wav')])
    run(['ffmpeg','-y','-v','error','-i',str(stage/'picture.mp4'),'-i',str(stage/'mix.wav'),'-map','0:v','-map','1:a','-t','300','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',str(out/'邻里闲置_演示视频.mp4')])
    run(['ffmpeg','-y','-v','error','-i',str(stage/'score.wav'),'-af','loudnorm=I=-18:TP=-1.5:LRA=8','-c:a','libmp3lame','-b:a','192k',str(out/'邻里闲置_背景音乐.mp3')])
    print('Created final widescreen video and original soundtrack',flush=True)

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--work',type=Path,default=ROOT.parent/'final-video');main(ap.parse_args().work)
