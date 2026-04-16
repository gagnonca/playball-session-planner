import AppShell from './components/AppShell';
import SharedView from './components/SharedView';

const isSharedRoute = window.location.pathname.startsWith('/shared/');

function App() {
  if (isSharedRoute) return <SharedView />;
  return <AppShell />;
}

export default App;
