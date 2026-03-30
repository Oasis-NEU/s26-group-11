import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { PageBackground } from '../PageBackground';

export function Layout() {
  return (
    <div className="relative min-h-screen" style={{ backgroundColor: 'var(--bg-page)' }}>
      <PageBackground />
      <Navbar />
      <main className="mx-auto max-w-screen-xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
