import { Component, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { Button, StatusMessage } from '../components/ui';
import { AuthProvider, IdentitySwitcher } from '../features/auth';
import { DiscoveryPage } from '../features/discovery';
import { DetailPage } from '../features/detail';
import { ArchivePage } from '../features/archive';
import { PublishPage } from '../features/publish';
import { MePage } from '../features/me';

class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <StatusMessage title="页面暂时无法显示" error action={<Button onClick={() => window.location.reload()}>重新加载</Button>}>请重新加载后再试。</StatusMessage>;
    return this.props.children;
  }
}
export function App() {
  return <PageErrorBoundary><AuthProvider><a className="skip-link" href="#content">跳到主要内容</a>
    <header className="site-header"><Link className="brand" to="/">邻里闲置</Link><IdentitySwitcher /></header>
    <main id="content" tabIndex={-1}><Routes>
      <Route path="/" element={<DiscoveryPage />} /><Route path="/items/:id" element={<DetailPage />} />
      <Route path="/archive" element={<ArchivePage />} /><Route path="/publish" element={<PublishPage />} />
      <Route path="/me" element={<MePage />} />
      <Route path="*" element={<StatusMessage title="没有找到这个页面" action={<Link to="/">返回首页</Link>} />} />
    </Routes></main>
    <nav className="main-nav" aria-label="主要导航"><NavLink to="/" end>发现</NavLink><NavLink to="/publish">发布</NavLink><NavLink to="/archive">历史</NavLink><NavLink to="/me">我的</NavLink></nav>
  </AuthProvider></PageErrorBoundary>;
}
