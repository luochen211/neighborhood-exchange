#!/usr/bin/env python3
"""Render the project's Chen ER diagrams. Requires Python 3 and rsvg-convert."""
from pathlib import Path
import math
import shutil
import subprocess
from html import escape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/engineering/diagrams'
FONT = 'Songti SC, Noto Serif CJK SC, serif'


def start(w, h, title, desc):
    return [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc">',
            f'<title id="title">{escape(title)}</title><desc id="desc">{escape(desc)}</desc>',
            f'<rect width="{w}" height="{h}" fill="white"/>',
            f'<g font-family="{FONT}" fill="#111" stroke-linejoin="miter">']


def text(a, x, y, label, size=26, bold=False, under=False, anchor='middle'):
    a.append(f'<text x="{x:g}" y="{y:g}" font-size="{size}" text-anchor="{anchor}" dominant-baseline="central"'
             + (' font-weight="bold"' if bold else '')
             + (' text-decoration="underline"' if under else '') + f'>{escape(label)}</text>')


def line(a, p, q):
    a.append(f'<line x1="{p[0]:g}" y1="{p[1]:g}" x2="{q[0]:g}" y2="{q[1]:g}" stroke="#111" stroke-width="2"/>')


def entity(a, x, y, label, w=180, h=76):
    a.append(f'<rect x="{x-w/2:g}" y="{y-h/2:g}" width="{w}" height="{h}" fill="white" stroke="#111" stroke-width="2.5"/>')
    text(a, x, y, label, 29, True)


def relation(a, x, y, label, rx=76, ry=46):
    a.append(f'<polygon points="{x:g},{y-ry:g} {x+rx:g},{y:g} {x:g},{y+ry:g} {x-rx:g},{y:g}" fill="white" stroke="#111" stroke-width="2"/>')
    text(a, x, y, label, 25)


def ellipse(a, x, y, label, key=False, rx=86, ry=31):
    a.append(f'<ellipse cx="{x:g}" cy="{y:g}" rx="{rx}" ry="{ry}" fill="white" stroke="#111" stroke-width="1.8"/>')
    text(a, x, y, label, 23, under=key)


def boundary(c, toward, shape, rx, ry):
    dx, dy = toward[0]-c[0], toward[1]-c[1]
    if shape == 'rect': scale = 1/max(abs(dx)/rx, abs(dy)/ry)
    elif shape == 'diamond': scale = 1/(abs(dx)/rx+abs(dy)/ry)
    else: scale = 1/math.sqrt((dx/rx)**2+(dy/ry)**2)
    return (c[0]+dx*scale,c[1]+dy*scale)


def connect(a, e, r, count, offset):
    p = boundary(e,r,'rect',90,38)
    q = boundary(r,e,'diamond',76,46)
    line(a,p,q)
    # Cardinality is placed near the entity end, offset away from the line.
    t=.22
    text(a,p[0]+(q[0]-p[0])*t+offset[0],p[1]+(q[1]-p[1])*t+offset[1],count,25)


def finish(a):
    return '\n'.join(a+['</g>','</svg>'])+'\n'


def global_diagram():
    a=start(1500,1440,'邻里闲置：全局实体联系图','Chen 表示法；六个实体，九个联系；实体用矩形，联系用菱形，连线没有箭头，标记 1 和 n。')
    text(a,750,57,'邻里闲置 · 全局实体联系图',38,True)
    text(a,750,106,'概念结构设计（Chen 表示法）',24)
    nodes={'user':(180,650),'item':(1320,650),'session':(180,195),'interest':(750,355),'comment':(750,885),'trade':(750,1210)}
    # Each entry is entity, relationship, entity, then endpoint cardinalities.
    edges=[('user',(180,420),'拥有','session','1','n',(-25,0),(-25,0)),
           ('user',(750,650),'发布','item','1','n',(0,-24),(0,-24)),
           ('user',(440,475),'表达','interest','1','n',(-12,-23),(0,-23)),
           ('item',(1060,475),'收到','interest','1','n',(12,-23),(0,-23)),
           ('user',(440,780),'撰写','comment','1','n',(-9,23),(0,23)),
           ('item',(1060,780),'包含','comment','1','n',(9,23),(0,23)),
           ('user',(440,1040),'领取','trade','1','n',(17,-6),(0,-23)),
           ('item',(1060,1040),'记录','trade','1','n',(-17,-6),(0,-23)),
           ('user',(180,1210),'取消','trade','1','n',(-25,0),(0,24))]
    for n1,r,label,n2,c1,c2,o1,o2 in edges:
        connect(a,nodes[n1],r,c1,o1);connect(a,nodes[n2],r,c2,o2)
    for _,r,label,*_ in edges: relation(a,*r,label)
    for key,label in [('user','用户'),('item','物品'),('session','登录会话'),('interest','意向记录'),('comment','留言'),('trade','交易记录')]: entity(a,*nodes[key],label)
    text(a,750,1325,'1 / n 标注联系的最大基数；实体的属性见配套实体属性图。',23)
    text(a,750,1370,'“取消”为可选联系：一笔交易至多有一位取消人，未取消时没有取消人。',22)
    return finish(a)


ENTITIES=[
 ('用户',[('用户编号',True),'昵称','楼栋','创建时间']),
 ('登录会话',[('会话编号',True),'令牌哈希','到期时间','创建时间']),
 ('物品',[('物品编号',True),'名称','描述','交易方式','价格','图片标识','自提楼栋','物品状态','发布时间','更新时间','送出时间']),
 ('意向记录',[('意向编号',True),'是否有效','创建时间','更新时间']),
 ('留言',[('留言编号',True),'留言内容','创建时间']),
 ('交易记录',[('交易编号',True),'交易状态','交接开始时间','交接结束时间','交接地点','创建时间','确认时间','完成时间','取消时间'])]


def attributes_diagram():
    a=start(2400,2220,'邻里闲置：实体属性图','六个实体的属性分别用椭圆连接；标识属性加下划线。实体间外键由全局联系表达。')
    text(a,1200,57,'邻里闲置 · 实体属性图',40,True)
    text(a,1200,110,'矩形：实体    椭圆：属性    下划线：标识属性（主键）',25)
    for i,(name,attrs) in enumerate(ENTITIES):
        ox=(i%2)*1200;oy=160+(i//2)*660;cx=ox+600;cy=oy+335
        text(a,ox+600,oy+35,f'图 {i+1}  {name}实体属性图',29,True)
        positions=[]
        for j,attr in enumerate(attrs):
            angle=-math.pi/2+2*math.pi*j/len(attrs)
            pos=(cx+440*math.cos(angle),cy+227*math.sin(angle));positions.append(pos)
            line(a,boundary((cx,cy),pos,'rect',90,38),boundary(pos,(cx,cy),'ellipse',86,31))
        entity(a,cx,cy,name)
        for pos,attr in zip(positions,attrs):
            label,key=attr if isinstance(attr,tuple) else (attr,False)
            ellipse(a,*pos,label,key)
    text(a,1200,2170,'外键由全局实体联系图表达；字段英文名、类型和完整性约束见 SRS。',25)
    return finish(a)


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    renderer=shutil.which('rsvg-convert')
    if not renderer: raise SystemExit('Install librsvg / rsvg-convert to export the diagrams.')
    for name,content in [('er-global',global_diagram()),('er-attributes',attributes_diagram())]:
        svg=OUT/f'{name}.svg';svg.write_text(content,encoding='utf-8')
        subprocess.run([renderer,str(svg),'-o',str(OUT/f'{name}.png')],check=True)
    print('Generated Chen SVG sources and PNG exports in',OUT)


if __name__=='__main__':main()
