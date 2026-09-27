import React from 'react';
import {AbsoluteFill, Audio, Composition, Img, OffthreadVideo, Sequence, interpolate, registerRoot, staticFile, useCurrentFrame} from 'remotion';
import scenes from './scenes.json';
const GREEN='#cbed8b';
const titles=['搜索与筛选，找到附近闲置','填写事实，确认发布','表达意向，公开交流','选择领取人，约定交接','拒绝预约，恢复可领取','保留历史，重新预约','双方确认，准备交接','确认送出，保留记录','统计更新与手机适配','AI 建议，先核对再采用','简单架构，可靠状态','从想法到可运行的交付'];
import layout from './layout.json';
const card:React.CSSProperties={boxSizing:'border-box',height:650,padding:36,background:'#fff',borderRadius:20,fontSize:30,lineHeight:1.5};
const Evidence=({index}:{index:number})=>{
 const frame=useCurrentFrame();
 const reveal=interpolate(frame,[0,18],[0,1],{extrapolateRight:'clamp'});
 return <AbsoluteFill className="evidence" style={{background:'#f5f5ed',color:'#193b30',padding:64,opacity:reveal}}>
  <style>{'.evidence h2 {font-size:38px;line-height:1.25;margin:12px 0 20px}.evidence p {margin:18px 0}'}</style>
  {index===9?<><h1 style={{fontSize:48,margin:'0 0 32px'}}>AI 建议 · 既有真实调用证据</h1><div style={{display:'flex',gap:48,height:650}}><Img src={staticFile('ai-preview.png')} style={{width:670,height:650,objectFit:'contain'}}/><div style={{...card,flex:1}}><h2>核对事实，再采用</h2><p>第 5 次真实调用<br/>DeepSeek → FLEXIBLE / null<br/>建议方式：随便给</p><p>逐句核验输入事实<br/>采用文案与交易方式<br/>手动确认发布</p><div style={{fontSize:24}}>这是历史证据回看。<br/>本次录制没有新增模型请求。</div></div></div></>:
  index===10?<><h1 style={{fontSize:48,margin:'0 0 32px'}}>实现结构与数据关系</h1><div style={{display:'flex',gap:40}}><div style={{...card,width:620}}><b>React + TypeScript + Vite</b><p>↓ 同源 /api/v1<br/>Node.js + Fastify<br/>↓ 事务与运行时契约<br/>SQLite + Drizzle</p><p>模型调用只发生在服务端<br/>6 张表 · 9 个外键 · 10 张 ER 图</p></div><Img src={staticFile('er-global.png')} style={{width:660,height:650,objectFit:'contain'}}/></div></>:
  <><h1 style={{fontSize:48,margin:'0 0 32px'}}>可复现的本地交付</h1><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:32}}><div style={card}><h2>102 项单元 / 集成测试</h2><p>权限 · 事务 · 幂等 · 月边界<br/>AI 异常与草稿保留</p><h2>4 项真实 HTTP E2E</h2><p>双身份交易 · 取消重约<br/>图片解码 · 重启持久化</p></div><div style={card}><h2>AI Coding 与复核</h2><p>辅助需求、代码和测试<br/>审查 PR 与真实运行证据</p><h2>Remotion 成片</h2><p>真实动态录屏 · 中文旁白<br/>原创 BGM · 隔离字幕区域</p><p style={{fontSize:23}}>此处说明本地验收结果。<br/>物理交接在线下完成。</p></div></div></>}
 </AbsoluteFill>;
};
const Chapter=({index}:{index:number})=>{
 const f=useCurrentFrame(),s=scenes[index];
 const caption=s.lines[Math.min(2,Math.floor(f/240))];
 const enter=interpolate(f,[0,18],[18,0],{extrapolateRight:'clamp'});
 const mobile=index===8&&f>=(s.mobileStartFrame??9000);
 return <AbsoluteFill style={{background:'#102920',fontFamily:'"PingFang SC", "Microsoft YaHei", sans-serif',color:'#fff'}}>
  <header data-region="header" style={{position:'absolute',left:layout.header.x,top:layout.header.y,width:layout.header.w,height:layout.header.h,overflow:'hidden'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',height:52}}><div style={{fontSize:38,transform:`translateX(${enter}px)`}}><span style={{color:GREEN,marginRight:24}}>{String(index+1).padStart(2,'0')}</span>{titles[index]}</div><span style={{fontSize:24,color:GREEN}}>邻里闲置 / 05:00</span></div>
   <div style={{fontSize:22,color:'#b4cbbd',marginTop:8}}>{index<9?'真实网页操作 · 双角色演示':s.source}</div>
  </header>
  <div data-region="web" style={{position:'absolute',left:layout.web.x,top:layout.web.y,width:layout.web.w,height:layout.web.h,background:'#f7f6f1',overflow:'hidden'}}>
   {index<9?<div style={{position:'absolute',left:mobile?(1536-468)/2:0,top:0,width:mobile?468:1536,height:864,overflow:'hidden'}}><OffthreadVideo src={staticFile(`${String(index+1).padStart(2,'0')}.webm`)} muted playbackRate={s.playbackRate||1} style={{width:1536,height:864,maxWidth:'none'}}/></div>:<Evidence index={index}/>}
  </div>
  <div aria-label="chapter progress" style={{position:'absolute',left:86,top:260,display:'flex',flexDirection:'column',gap:24}}>{titles.map((_,i)=><div key={i} style={{height:22,width:6,borderRadius:4,background:i===index?GREEN:'#375447'}}/>)}</div>
  <footer data-region="caption" style={{position:'absolute',left:layout.caption.x,top:layout.caption.y,width:layout.caption.w,height:layout.caption.h,textAlign:'center',fontSize:32,lineHeight:'48px',whiteSpace:'nowrap'}}>{caption}</footer>
  <div style={{position:'absolute',left:0,bottom:0,height:5,width:`${(index*750+f)/9000*100}%`,background:GREEN}}/>
 </AbsoluteFill>;
};
const Film=()=> <AbsoluteFill>{scenes.map((_,i)=><Sequence key={i} from={i*750} durationInFrames={750}><Chapter index={i}/></Sequence>)}<Audio src={staticFile('mix.m4a')}/></AbsoluteFill>;
registerRoot(()=> <Composition id="NeighborhoodDemo" component={Film} durationInFrames={9000} fps={30} width={1920} height={1080}/>);
