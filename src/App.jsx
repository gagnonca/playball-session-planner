import AppShell from './components/AppShell';
import DiagramPlayground from './components/DiagramPlayground';
import SharedView from './components/SharedView';

const isSharedRoute = window.location.pathname.startsWith('/shared/');
const isDiagramPlaygroundRoute = window.location.pathname === '/diagram-playground';

function App() {
  if (isDiagramPlaygroundRoute) return <DiagramPlayground />;
  if (isSharedRoute) return <SharedView />;
  return <AppShell />;
}

export default App;
