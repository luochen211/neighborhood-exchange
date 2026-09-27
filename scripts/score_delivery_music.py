"""Compose an original 115.2 BPM electronic instrumental using oscillator/noise synthesis.
No downloaded samples, model calls, or third-party recordings. Deterministic score.
"""
import argparse, wave
from pathlib import Path
import numpy as np

RATE=48000
BPM=115.2
BEAT=60/BPM
DURATION=300

def compose(dest):
    rng=np.random.default_rng(27092026)
    mix=np.zeros((RATE*DURATION,2),dtype=np.float32)
    def add(signal,start,level=1,pan=0):
        i=round(start*RATE)
        if i>=len(mix):return
        signal=signal[:min(len(signal),len(mix)-i)]*level
        if i<0:signal=signal[-i:];i=0
        gains=np.sqrt(np.array([1-pan,1+pan],dtype=np.float32)/2)
        mix[i:i+len(signal)]+=signal[:,None]*gains
    def grid(seconds):return np.arange(int(RATE*seconds),dtype=np.float32)/RATE
    def freq(midi):return 440*2**((midi-69)/12)
    def note(midi,seconds,kind):
        t=grid(seconds);f=freq(midi)
        if kind=='pad':
            env=np.minimum(t/.16,1)*np.minimum((seconds-t)/.28,1)
            wave_=np.sin(2*np.pi*f*t)+.2*np.sin(2*np.pi*f*2.003*t)
        elif kind=='bass':
            env=(1-np.exp(-t/0.008))*np.exp(-t/0.19)
            wave_=np.sin(2*np.pi*f*t)+.18*np.sin(2*np.pi*2*f*t)
        else:
            env=(1-np.exp(-t/.003))*np.exp(-t/.19)
            wave_=np.sin(2*np.pi*f*t)+.25*np.sin(2*np.pi*f*2*t)+.07*np.sin(2*np.pi*f*3*t)
        return (env*wave_).astype(np.float32)
    t=grid(.36);kick=(np.sin(2*np.pi*(47*t+95*.025*(1-np.exp(-t/.025))))*np.exp(-t/.085)).astype(np.float32)
    t=grid(.18);noise=rng.normal(size=len(t)).astype(np.float32)
    snare=(.72*(noise-np.roll(noise,1))*.45+.28*np.sin(2*np.pi*180*t))*np.exp(-t/.045)
    t=grid(.065);noise=rng.normal(size=len(t)).astype(np.float32)
    hat=(noise-np.roll(noise,1))*.3*np.exp(-t/.012)
    roots=[38,35,31,33]
    chords=[[62,66,69,73],[59,62,66,69],[55,59,62,66],[57,61,64,71]]
    motifs=[[0,2,1,3,2],[2,1,0,2,3],[0,1,3,2,1]]
    for bar in range(144):
        start=bar*4*BEAT;chapter=bar//12;within=bar%12;ci=bar%4
        # Two-bar breakdowns give AI/architecture speech more room; final four bars resolve.
        full=bar>=4 and not(chapter in (9,10) and within<2) and bar<140
        for k,midi in enumerate(chords[ci]):add(note(midi,4*BEAT+.25,'pad'),start,.05,(-.45 if k%2 else .45))
        for b in [0,1.5,2.5,3.5]:add(note(roots[ci],.48,'bass'),start+b*BEAT,.26 if full else .13)
        if full:
            for b in [0,1,2,3]:add(kick,start+b*BEAT,.28)
            for b in [1,3]:add(snare,start+b*BEAT,.10,-.08)
            for step in range(8):add(hat,start+(step*.5+(0.025 if step%2 else 0))*BEAT,.065 if step%2 else .04,.35*(-1 if step%2 else 1))
            if within==11:
                for b in [3.25,3.5,3.75]:add(snare,start+b*BEAT,.035,b/8-.2)
        if bar%2==0 or chapter in (0,11):
            for j,b in enumerate([0,.75,1.5,2.5,3.25]):
                midi=chords[ci][motifs[(bar//4)%3][j]]+12
                sound=note(midi,.8,'pluck');level=.055 if chapter not in (9,10) else .03
                pan=(-.4 if j%2 else .4)
                add(sound,start+b*BEAT,level,pan)
                add(sound,start+b*BEAT+BEAT*.75,level*.25,-pan)
    # Short transition sweeps and soft resolution chimes, composed from noise and sine.
    for chapter in range(1,12):
        t=grid(.28);noise=rng.normal(size=len(t)).astype(np.float32)
        sweep=(noise-np.roll(noise,1))*.15*np.sin(np.pi*t/.28)**2
        add(sweep,chapter*25-.14,.045,0)
        if chapter in (3,6,7,9,11):
            add(note(86,.9,'pluck'),chapter*25,.10,.2)
    # Smooth edges and control crest factor without hard clipping.
    env=np.minimum(np.arange(len(mix))/RATE/2,1)*np.minimum((len(mix)-np.arange(len(mix)))/RATE/4,1)
    mix*=env[:,None].astype(np.float32)
    mix=np.tanh(mix*1.8)
    mix*=.82/max(float(np.max(np.abs(mix))),1e-8)
    dest=Path(dest);dest.parent.mkdir(parents=True,exist_ok=True)
    with wave.open(str(dest),'wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(RATE)
        f.writeframes((mix*32767).astype('<i2').tobytes())
    print(f'Composed {DURATION}s, {BPM} BPM, stereo instrumental: {dest}')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('output');compose(parser.parse_args().output)
