#!/usr/bin/env python3
"""Build the Word project report from committed ER diagrams and screenshot evidence.
Requires python-docx and Pillow. Run from any working directory.
"""
from pathlib import Path
import json
from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/delivery'
DIAGRAMS=ROOT/'docs/engineering/diagrams'
SCREENSHOTS=OUT/'screenshots'
REPORT=OUT/'邻里闲置_项目设计说明书.docx'

def east_font(style,name='Songti SC'):
    style.font.name='Times New Roman'
    style.element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),name)

def paragraph(doc,content,style=None):
    p=doc.add_paragraph(content,style)
    p.paragraph_format.space_after=Pt(7)
    return p

def heading(doc,text,level=1):
    return doc.add_heading(text,level)

def table(doc,headers,rows,widths=None):
    t=doc.add_table(rows=1,cols=len(headers));t.style='Table Grid'
    widths=widths or ([4,13] if len(headers)==2 else [3,5,9])
    t.autofit=False
    for col,width in zip(t.columns,widths): col.width=Cm(width)
    for c,v in zip(t.rows[0].cells,headers):c.text=v
    repeat=OxmlElement('w:tblHeader');t.rows[0]._tr.get_or_add_trPr().append(repeat)
    for row in rows:
        cells=t.add_row().cells
        for c,v in zip(cells,row):c.text=str(v)
    for i,row in enumerate(t.rows):
        no_split=OxmlElement('w:cantSplit');row._tr.get_or_add_trPr().append(no_split)
        for j,cell in enumerate(row.cells):
            if widths: cell.width=Cm(widths[j])
            for p in cell.paragraphs:
                p.paragraph_format.space_after=Pt(4);p.paragraph_format.space_before=Pt(4)
                for r in p.runs:
                    r.font.size=Pt(10);r.bold=(i==0)
                    if i==0:
                        shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'EAF0EE');cell._tc.get_or_add_tcPr().append(shade)
    return t

def image(doc,path,caption,width=6):
    p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after=Pt(2)
    p.paragraph_format.keep_with_next=True
    from PIL import Image
    with Image.open(path) as im: ratio=im.height/im.width
    width=min(width,6.4/ratio)
    p.add_run().add_picture(str(path),width=Inches(width))
    p=paragraph(doc,caption,'Caption');p.alignment=WD_ALIGN_PARAGRAPH.CENTER

def new_page(doc,title):
    doc.add_page_break();heading(doc,title)

def main():
    OUT.mkdir(exist_ok=True)
    evidence=json.loads((SCREENSHOTS/'manifest.json').read_text())
    if evidence['kind']!='real-http': raise ValueError('Final report requires real HTTP evidence')
    d=Document();s=d.sections[0]
    s.page_width=Cm(21);s.page_height=Cm(29.7)
    s.top_margin=Cm(1.8);s.bottom_margin=Cm(1.8);s.left_margin=Cm(2);s.right_margin=Cm(2)
    s.header_distance=Cm(.8);s.footer_distance=Cm(.8)
    normal=d.styles['Normal'];east_font(normal);normal.font.size=Pt(11)
    normal.paragraph_format.line_spacing=1.15
    for name,size in [('Title',30),('Subtitle',15),('Heading 1',18),('Heading 2',13),('Heading 3',11)]:
        st=d.styles[name];east_font(st,'PingFang SC');st.font.size=Pt(size);st.font.color.rgb=RGBColor.from_string('18372E')
    east_font(d.styles['Caption']);d.styles['Caption'].font.size=Pt(10)
    h=s.header.paragraphs[0];h.text='邻里闲置  |  项目设计与实现说明书';h.style='Caption'
    f=s.footer.paragraphs[0];f.alignment=WD_ALIGN_PARAGRAPH.CENTER
    f.add_run('第 ');field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');f._p.append(field);f.add_run(' 页')
    d.core_properties.title='邻里闲置 · 项目设计与实现说明书'
    d.core_properties.subject='真实全栈运行、Chen E-R 图、验收与演示视频'
    d.core_properties.author='邻里闲置项目组'
    for _ in range(3):paragraph(d,'')
    p=d.add_paragraph('邻里闲置','Title');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p=d.add_paragraph('项目设计与实现说明书','Subtitle');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p=paragraph(d,'社区闲置物品流转 Web 应用');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    table(d,['项目','交付内容'],[
        ('应用','React 网页、Fastify HTTP API、持久 SQLite、服务端 AI 发布辅助'),
        ('运行材料','真实页面截图、10 张 Chen E-R 图、约 5 分钟实际操作与讲解视频'),
        ('本地验收','102 项单元/集成测试、4 项真实 HTTP E2E、5 次真实模型调用'),
        ('证据范围','隔离数据库录屏；既有真实 AI 截图明确标识；数据为虚构演示数据'),
        ('部署','本地运行已验收；未做远端部署'),
        ('版本 / 日期','2.0 / 2026-09-27')])
    paragraph(d,'应用已实现发布、意向、预约、取消、确认、归档与看板闭环。本报告区分自动化测试、真实模型和材料录制证据；第 5 次模型调用返回随便给，不将其表述为数值报价成功。')
    new_page(d,'1  项目背景与使用流程')
    paragraph(d,'小区群里的闲置容易被新消息淹没，领取者难以判断是否还能领，双方需要反复沟通时间地点。邻里闲置通过物品卡片、明确状态和预约交接，让同一社区的邻居完成线下流转。')
    heading(d,'1.1 范围与角色',2)
    paragraph(d,'采用单一演示社区和预置虚构身份。访客可浏览；用户可发布、留言或领取别人的物品。发布者和领取者是同一用户实体在不同交易中的角色。物品图使用 30 张 AI 生成的演示图片，页面明确标注，不能当作真实二手物品照片。')
    table(d,['功能','实现行为'],[
        ('发现与发布','关键词与交易方式组合筛选；免费送、随便给、标价；预置图片和自提楼栋'),
        ('意向与留言','表达想要、撤回和重新激活；公开留言；名单仅物主可读'),
        ('预约交接','物主选择意向人，约定未来 7 天内的时间和公共地点；双方确认或取消'),
        ('完成归档','物主二次确认后归档；详情留言保留，禁止新写入；统计同步更新'),
        ('AI 辅助','服务端调用真实模型；严格结构校验；用户主动采用、手动发布；失败保留草稿')])
    heading(d,'1.2 典型路径',2)
    paragraph(d,'发布者发布 → 领取者想要和留言 → 物主发起预约 → 领取者确认 → 线下交接 → 物主确认完成 → 归档并更新看板。时间不合适时可取消，再建立新预约；历史取消记录保留。')
    paragraph(d,'本项目不包含在线支付、快递、即时私聊、真实注册、多社区或用户上传照片。演示身份不能作为生产认证。物理交接由双方线下完成；录屏演示的是软件确认流程。')
    new_page(d,'2  技术架构与核心实现')
    table(d,['层次','选型','职责'],[
        ('前端','React / TypeScript / Vite','页面、表单、身份状态、API adapter 和错误反馈'),
        ('API','Node.js 24 / Fastify','23 个契约操作、会话、权限、参数校验和业务事务'),
        ('数据','SQLite / Drizzle','6 张表、9 个外键、版本迁移、CHECK 和唯一索引'),
        ('契约','OpenAPI 3.1 / Zod','统一输入输出与错误结构；运行时校验'),
        ('AI','服务端 Chat Completions','DeepSeek 发布辅助、超时、限流、输出校验与安全降级'),
        ('验证','Vitest / Playwright / CI','临时数据库、真实 HTTP、多身份浏览器和构建检查')])
    paragraph(d,'浏览器经同源 /api/v1 访问后端；后端操作 SQLite 并调用模型服务。生产构建由 Fastify 托管前端，支持页面深链接。密钥只保存在服务端环境，浏览器不接收密钥。数据库记录会话令牌的哈希，Cookie 使用 HttpOnly。')
    heading(d,'2.1 事务与幂等',2)
    paragraph(d,'物品状态为可领取、已预约、已送出；交易为待确认、已确认、已完成、已取消。创建预约、取消和完成在同一事务内检查状态并更新。唯一部分索引限制每件物品最多一笔未取消交易；重复完成不重复成交，旧取消请求不影响新预约。')
    heading(d,'2.2 统计与性能',2)
    paragraph(d,'金额保存整数分；时间以 UTC 毫秒存储，本月看板按北京时间统计。当前在售包含可领取和已预约。后端隔离性能复核在 1,000 件物品、5 并发、100 次读取下测得 p95 13.75ms；这是本机样本，不是线上容量保证。')
    for i,page in enumerate(evidence['pages'],1):
        new_page(d,f'3.{i}  真实运行：{page["title"]}')
        image(d,SCREENSHOTS/page['file'],f'图 3-{i}  {page["title"]}',6.5)
        paragraph(d,page['description'])
        paragraph(d,f'来源：{page["source"]}。采集：{page["viewport"]}；页面：{page["route"]}。')
    new_page(d,'4  数据库概念结构与全局 E-R 图')
    paragraph(d,'Chen 表示法：矩形是实体，椭圆是属性，菱形是联系，主键名称加下划线，直线无箭头，1 / n 表示最大基数。共 6 张实体属性图、3 张局部图和 1 张全局图。图内只保留模型结构与名称。')
    image(d,DIAGRAMS/'er-global.png','图 4-1  全局实体联系图',6.0)
    paragraph(d,'六个实体为用户、登录会话、物品、意向记录、留言和交易记录，属性见第 5 节。取消联系可选，交易有零个或一个取消人；物品与交易的一对多包含取消历史，不表示同时成交给多人。')
    attrs=[('user','用户'),('session','登录会话'),('item','物品'),('interest','意向记录'),('comment','留言'),('trade','交易记录')]
    for group in range(3):
        new_page(d,f'5.{group+1}  实体属性图')
        for j in range(2):
            i=group*2+j;slug,name=attrs[i]
            image(d,DIAGRAMS/f'attribute-{slug}.png',f'图 5-{i+1}  {name}实体属性图',5.65)
        if group==0:paragraph(d,'标识属性以椭圆内文字下划线表示。外键通过联系图表达；字段英文名、数据类型和约束见迁移核对记录。')
    locals=[('publishing','用户发布与登录','一个用户可拥有多个会话、发布多件物品。会话和物品各属于一个用户。'),('interest-comments','物品意向与留言','每条意向或留言关联一个用户和一件物品。同一用户对同一物品仅一条意向记录，撤回后可重新激活。'),('trading','交易交接','每笔交易关联一件物品和一个领取者；发布者由物品确定。取消联系可选，取消人限交易双方；每件物品可有多次取消历史，但最多一笔未取消交易。')]
    for i,(slug,name,note) in enumerate(locals,1):
        new_page(d,f'6.{i}  局部实体联系图：{name}')
        image(d,DIAGRAMS/f'local-{slug}.png',f'图 6-{i}  {name}联系图',6.3);paragraph(d,note)
    new_page(d,'7  实际迁移与完整性核对')
    paragraph(d,'已在独立内存数据库执行 migration001 和 migration002，核验 user_version=2、6 张表、9 个外键及全部属性。v2 仅把物品图片标识白名单扩展到 30 项，没有改变实体或联系；现有 10 张图与迁移一致。')
    table(d,['关系表','主键与引用','核对的约束'],[
        ('users','id','昵称、楼栋、创建时间'),
        ('sessions','id；user_id → users','token_hash 唯一、到期时间晚于创建时间'),
        ('items','id；owner_id → users','价格与交易方式匹配、GIVEN 送出时间、30 图片标识'),
        ('interests','id；item_id、user_id','联合唯一与 active 有效状态'),
        ('comments','id；item_id、author_id','正文长度 CHECK，创建时间'),
        ('trades','id；item_id、recipient_id、cancelled_by','状态时间 CHECK、可空取消人、未取消交易唯一索引')])
    paragraph(d,'图展示概念结构。字段类型、最小参与、唯一索引、金额和状态 CHECK 属于逻辑约束，不在图内堆放说明。物主不能领取自己物品、取消人限双方、跨表状态同步等规则由服务端事务和权限检查保证。逐字段记录见 docs/delivery/erd-verification.md。')
    new_page(d,'8  测试、真实 AI 与已知边界')
    table(d,['验证','实际结果'],[
        ('单元与集成','102 项通过；含会话、权限、状态事务、回滚、幂等、月边界、AI 异常'),
        ('真实 HTTP E2E','4 项通过；双身份完整交易、拒绝重约、30 图片解码、独立进程重启持久化'),
        ('页面核验','桌面与手机无横向溢出；本次录制无页面脚本错误，成交统计增加 1'),
        ('真实模型','累计 5 次 DeepSeek 请求：4 次脚本、1 次浏览器；本次交付零新增调用'),
        ('干净启动','协调者 clone 237b491 后安装、构建、迁移、种子、启动成功；首页、健康、图片 200'),
        ('远端部署','未部署；GitHub Actions 为 CI，没有 CD 或线上运行验收')])
    heading(d,'8.1 模型输出的实际质量',2)
    paragraph(d,'第一次稀疏描述获得 0.01–99,999 元的全范围报价，属于无实用价值的质量失败。已调整提示词并增加服务端拒绝回归。修复后脚本中，稀疏描述返回随便给，充分描述返回 80–150 元；价格仍不是市场行情认证。')
    paragraph(d,'第五次真实浏览器调用返回 FLEXIBLE/null，即随便给，没有数值报价。协调者逐句核对标题、功能、成色和配件均来自输入，再采用文案与交易方式并手动发布。报告截图复用该次验收，未为获得特定价格再次调用。')
    paragraph(d,'CI 使用标明的模型 stub，不调用付费服务。已有真实调用与独立浏览器核验单独记录在 acceptance.md / backend.md；两类证据互不替代。')
    new_page(d,'9  运行、视频与 AI Coding 记录')
    heading(d,'9.1 本地复现',2)
    paragraph(d,'使用 Node.js 24 / npm 11：npm ci → npm run build → 创建根 .env → npm run db:migrate → npm run db:seed → npm start。DEMO_MODE=true，APP_ORIGIN 与访问端口一致；默认 http://127.0.0.1:3000。完整配置步骤与检查命令见根 README。')
    paragraph(d,'数据库路径相对仓库根解析。迁移和种子不会重置已有业务；复现及测试使用独立数据库。模型凭据可选填入本地 .env；缺凭据时 AI 明确报错，手动发布仍可使用。')
    heading(d,'9.2 实际演示成片',2)
    paragraph(d,'docs/delivery/邻里闲置_演示视频.mp4：约 5 分钟，包含真实浏览器交易、取消重约、手机界面，以及既有 AI 证据、架构与验收讲解。成片附中文合成讲解音轨、烧录字幕和独立 SRT；镜头来源标明，物理交接未在视频中声称发生。')
    heading(d,'9.3 AI Coding 与核验',2)
    paragraph(d,'Codex 辅助需求与接口契约、前后端实现、测试与文档生成。独立任务按完整前端、完整后端和集成验收分工；协调者审查 PR、真实浏览器证据和 CI。关键迭代包括事务与幂等、30 图片迁移、真实模型接入及全范围无效报价修复。')
    paragraph(d,'自动化完成后仍逐页目视检查截图、10 张 ER 图和 PDF 排版，并核验视频时长、音轨和抽帧。用户提供的学校参考文档未修改；现有用户数据库未用于录制写操作。')
    paragraph(d,'交付索引：docs/delivery/README.md；验收：acceptance.md；ER 核对：erd-verification.md；视频时间轴与制作证据：video.md。最终 Issue 与 Epic 由协调者在 PR 合并、main CI 核验后关闭。')
    d.save(REPORT);print(REPORT)

if __name__=='__main__':main()
