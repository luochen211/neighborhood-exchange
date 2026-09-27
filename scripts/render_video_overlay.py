"""Create transparent title/source/caption overlays; does not edit evidence images."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
source=Path(sys.argv[1]);scene=json.loads(source.read_text())
font='/System/Library/Fonts/STHeiti Medium.ttc'
for j,line in enumerate(scene['lines']):
    im=Image.new('RGBA',(1280,864),(0,0,0,0));d=ImageDraw.Draw(im)
    for xy,text,size,color in [((32,12),f"{scene['number']:02} / 12  {scene['title']}",27,'white'),((32,49),scene['source'],17,'#c9dece')]:
        d.text(xy,text,font=ImageFont.truetype(font,size),fill=color)
    f=ImageFont.truetype(font,28);width=d.textlength(line,font=f)
    if width>1220: raise ValueError('Caption too wide')
    d.text(((1280-width)/2,816),line,font=f,fill='white')
    im.save(source.with_name(source.stem+f'-{j}.png'))
