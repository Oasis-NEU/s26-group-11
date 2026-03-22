import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { PageBackground } from '../PageBackground';

export function Layout() {
  return (
    <div className="relative min-h-screen" style={{ backgroundColor: 'var(--bg-page)' }}>
      <PageBackground />
      <Navbar />
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
