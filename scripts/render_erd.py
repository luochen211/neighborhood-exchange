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


def attributes_diagram(index, name, attrs):
    a=start(1200,800,f'邻里闲置：{name}实体属性图','矩形实体、椭圆属性，标识属性加下划线。')
    text(a,600,55,f'图 {index}  {name}实体属性图',34,True)
    cx,cy=600,420
    positions=[]
    for j,attr in enumerate(attrs):
        angle=-math.pi/2+2*math.pi*j/len(attrs)
        pos=(cx+440*math.cos(angle),cy+235*math.sin(angle));positions.append(pos)
        line(a,boundary((cx,cy),pos,'rect',90,38),boundary(pos,(cx,cy),'ellipse',86,31))
    entity(a,cx,cy,name)
    for pos,attr in zip(positions,attrs):
        label,key=attr if isinstance(attr,tuple) else (attr,False)
        ellipse(a,*pos,label,key)
    text(a,600,755,'下划线表示标识属性；实体间引用见局部和全局实体联系图。',22)
    return finish(a)


def local_diagram(index, title, nodes, edges, note):
    a=start(1400,1000,title,'Chen 局部实体联系图，连接线无箭头，1/n 为最大基数。')
    text(a,700,60,f'图 {index}  {title}',34,True)
    for left,r,label,right,o1,o2 in edges:
        connect(a,nodes[left],r,'1',o1)
        connect(a,nodes[right],r,'n',o2)
    for _,r,label,*_ in edges: relation(a,*r,label)
    for label,pos in nodes.items(): entity(a,*pos,label)
    text(a,700,945,note,22)
    return finish(a)


def diagrams():
    names=['user','session','item','interest','comment','trade']
    result=[(f'attribute-{slug}',attributes_diagram(i,name,attrs))
            for i,(slug,(name,attrs)) in enumerate(zip(names,ENTITIES),1)]
    result.append(('local-publishing',local_diagram(7,'用户发布与登录联系图',
        {'用户':(260,500),'登录会话':(1100,270),'物品':(1100,730)},
        [('用户',(680,380),'拥有','登录会话',(0,-26),(0,-26)),
         ('用户',(680,620),'发布','物品',(0,26),(0,26))],
        '用户可拥有多个登录会话、发布多件物品；会话和物品各属于一个用户。')))
    result.append(('local-interest-comments',local_diagram(8,'物品意向与留言联系图',
        {'用户':(180,500),'物品':(1220,500),'意向记录':(700,220),'留言':(700,780)},
        [('用户',(420,340),'表达','意向记录',(0,-25),(0,-25)),
         ('物品',(980,340),'收到','意向记录',(0,-25),(0,-25)),
         ('用户',(420,660),'撰写','留言',(0,25),(0,25)),
         ('物品',(980,660),'包含','留言',(0,25),(0,25))],
        '每条意向或留言关联一个用户和一件物品；同一用户对同一物品只有一条意向记录。')))
    result.append(('local-trading',local_diagram(9,'交易交接联系图',
        {'用户':(220,260),'物品':(1180,260),'交易记录':(800,760)},
        [('用户',(700,260),'发布','物品',(0,-25),(0,-25)),
         ('用户',(550,500),'领取','交易记录',(5,-25),(5,-25)),
         ('用户',(220,760),'取消','交易记录',(-26,0),(0,26)),
         ('物品',(1130,590),'记录','交易记录',(26,0),(0,26))],
        '一件物品可有多次取消历史，但最多一笔未取消交易；取消人为可选，限交易双方。')))
    result.append(('er-global',global_diagram()))
    return result


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    renderer=shutil.which('rsvg-convert')
    if not renderer: raise SystemExit('Install librsvg / rsvg-convert to export the diagrams.')
    for name,content in diagrams():
        svg=OUT/f'{name}.svg';svg.write_text(content,encoding='utf-8')
        subprocess.run([renderer,str(svg),'-o',str(OUT/f'{name}.png')],check=True)
    print('Generated Chen SVG sources and PNG exports in',OUT)


if __name__=='__main__':main()
