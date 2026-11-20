import { useCallback, useEffect, useState } from 'react';
import { Layout, type Tab } from './components/Layout';
import { ScanSpoolModal } from './components/ScanSpoolModal';
import { ToastHost } from './components/ToastHost';
import { Dashboard } from './pages/Dashboard';
import { Calculator } from './pages/Calculator';
import { Inventory } from './pages/Inventory';
import { Orders } from './pages/Orders';
import { Printers } from './pages/Printers';
import { Settings } from './pages/Settings';

const TAB_IDS: Tab[] = ['dashboard', 'calculator', 'inventory', 'orders', 'printers', 'settings'];

function initialTab(): Tab {
  const param = new URLSearchParams(window.location.search).get('tab');
  return param && (TAB_IDS as string[]).includes(param) ? (param as Tab) : 'dashboard';
}

export default function App() {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [scanOpen, setScanOpen] = useState(false);
  const [newOrderNonce, setNewOrderNonce] = useState(0);
  const [focusSpoolId, setFocusSpoolId] = useState<string | null>(null);

  const navigate = useCallback((next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(null, '', url.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const newOrder = useCallback(() => {
    navigate('orders');
    setNewOrderNonce((n) => n + 1);
  }, [navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'n') {
        e.preventDefault();
        navigate('calculator');
      } else if (key === 's') {
        e.preventDefault();
        setScanOpen(true);
      } else if (key === 'k') {
        e.preventDefault();
        navigate('orders');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <>
      <Layout
        tab={tab}
        onNavigate={navigate}
        onScan={() => setScanOpen(true)}
        onNewOrder={newOrder}
        onNewQuote={() => navigate('calculator')}
        onOpenSettings={() => navigate('settings')}
      >
        {tab === 'dashboard' && (
          <Dashboard
            onNavigate={navigate}
            onScan={() => setScanOpen(true)}
            onNewQuote={() => navigate('calculator')}
          />
        )}
        {tab === 'calculator' && <Calculator onOrderCreated={() => navigate('orders')} />}
        {tab === 'inventory' && (
          <Inventory
            onScan={() => setScanOpen(true)}
            focusSpoolId={focusSpoolId}
            onFocusHandled={() => setFocusSpoolId(null)}
          />
        )}
        {tab === 'orders' && <Orders openNewNonce={newOrderNonce} />}
        {tab === 'printers' && <Printers />}
        {tab === 'settings' && <Settings onBack={() => navigate('dashboard')} />}
      </Layout>

      <ScanSpoolModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onOpenSpool={(spoolId) => {
          setFocusSpoolId(spoolId);
          navigate('inventory');
        }}
      />
      <ToastHost />
    </>
  );
}
