import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import AppBackground from '../components/AppBackground.jsx';
import Topbar from '../components/Topbar.jsx';
import { Button, SectionHeader } from '../components/ui.jsx';
import TestForm from '../components/TestForm.jsx';
import TestHistory from '../components/TestHistory.jsx';
import DeleteDialog from '../components/DeleteDialog.jsx';
import TestDetail from './TestDetail.jsx';
import { listTests, deleteTest } from '../api.js';
import { isRunning } from '../helpers.js';
import '../app.css';

const RECENT_COUNT = 5;

// view is one of: 'home' | 'history' | 'newTest' | 'testDetail'
function Dashboard({ user, onLogout }) {
  const [view, setView] = useState('home');
  const [openTestId, setOpenTestId] = useState(null);
  const [notice, setNotice] = useState('');

  const [tests, setTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [testsError, setTestsError] = useState('');
  const latestLoad = useRef(0); // numbers each loadTests call, so only the newest answer is used

  const [testToDelete, setTestToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // showSpinner is false for quiet refreshes, so the list does not flash "Loading tests..."
  async function loadTests(showSpinner = true) {
    const thisLoad = ++latestLoad.current;
    if (showSpinner) setLoadingTests(true);
    setTestsError('');
    try {
      const data = await listTests();
      if (thisLoad === latestLoad.current) setTests(data.tests); // an older answer must not overwrite a newer one
    } catch (err) {
      console.error(err);
      if (thisLoad === latestLoad.current) setTestsError(err.message || 'Unable to load tests.');
    } finally {
      if (thisLoad === latestLoad.current) setLoadingTests(false);
    }
  }

  // Reload the list whenever a screen that shows it opens, so statuses are up to date
  useEffect(() => {
    if (view === 'home' || view === 'history') loadTests(false);
  }, [view]);

  function openTest(test) {
    setOpenTestId(test.id);
    setNotice('');
    setView('testDetail');
  }

  function handleCreated(test) {
    setOpenTestId(test.id);
    setNotice('Baseline test created. Click Capture Baseline to start.');
    setView('testDetail');
  }

  function askToDelete(test) {
    setDeleteError('');
    setTestToDelete(test);
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteTest(testToDelete.id);
      setTests((current) => current.filter((test) => test.id !== testToDelete.id));
      loadTests(false); // also throws away any older list request still on its way
      if (view === 'testDetail' && openTestId === testToDelete.id) setView('history');
      setTestToDelete(null);
    } catch (err) {
      console.error(err);
      setDeleteError(err.message || 'Unable to delete the test.');
    } finally {
      setDeleting(false);
    }
  }

  function startNewTest() {
    setNotice('');
    setView('newTest');
  }

  function handleSidebarSelect(section) {
    setNotice('');
    setView(section === 'history' ? 'history' : 'home');
  }

  const list = {
    loading: loadingTests,
    error: testsError,
    onRetry: () => loadTests(),
    onOpen: openTest,
    onDelete: askToDelete,
    onNewTest: startNewTest,
  };
  const sidebarSection = view === 'history' || view === 'testDetail' ? 'history' : 'dashboard';

  // A quiet summary line, counted from the saved tests
  const running = tests.filter((test) => isRunning(test.status)).length;
  const summary = tests.length > 0 ? `${tests.length} ${tests.length === 1 ? 'test' : 'tests'}${running > 0 ? ` · ${running} running` : ''}` : null;

  // Each screen fades and rises in
  const page = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.2, 0.7, 0.2, 1] } }, exit: { opacity: 0, y: -4, transition: { duration: 0.12 } } };

  return (
    <div className="app">
      <AppBackground />
      <Topbar
        section={sidebarSection}
        onSelect={handleSidebarSelect}
        onNewTest={startNewTest}
        user={user}
        onLogout={onLogout}
      />

      <main className="app-main">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div key="home" className="content" {...page}>
              <header className="page-head">
                <div>
                  <h1>Visual Regression Testing</h1>
                  <p className="page-lead">Capture an approved website and compare future deployments against it.</p>
                </div>
                <Button variant="primary" size="lg" icon={Plus} onClick={startNewTest}>New Test</Button>
              </header>

              <SectionHeader
                title="Recent tests"
                note={summary}
                action={tests.length > RECENT_COUNT && <button className="link-button" onClick={() => setView('history')}>View all</button>}
              />
              <TestHistory tests={tests.slice(0, RECENT_COUNT)} {...list} />
            </motion.div>
          )}

          {view === 'newTest' && (
            <motion.div key="new" className="content content-narrow" {...page}>
              <TestForm onCreated={handleCreated} onCancel={() => setView('home')} />
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div key="history" className="content" {...page}>
              <header className="page-head">
                <div>
                  <h1>Test History</h1>
                  <p className="page-lead">Every test in your workspace, newest first.</p>
                </div>
              </header>
              <TestHistory tests={tests} {...list} />
            </motion.div>
          )}

          {view === 'testDetail' && (
            <motion.div key={`detail-${openTestId}`} className="content" {...page}>
              <TestDetail
                key={openTestId}
                testId={openTestId}
                notice={notice}
                onBack={() => setView('history')}
                onDelete={askToDelete}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {testToDelete && (
        <DeleteDialog
          test={testToDelete}
          busy={deleting}
          error={deleteError}
          onCancel={() => setTestToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

export default Dashboard;
