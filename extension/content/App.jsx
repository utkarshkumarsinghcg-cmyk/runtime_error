import React from 'react';
import { CompanionProvider, useCompanionState } from './context/CompanionContext';
import FloatingActionButton from './components/FloatingActionButton';
import CompanionSidebar from './components/CompanionSidebar';
import CentralHubDashboard from './components/CentralHubDashboard';

function MainApp() {
  const { activeTab } = useCompanionState();

  return (
    <>
      {activeTab === 'sidebar' ? (
        <>
          <FloatingActionButton />
          <CompanionSidebar />
        </>
      ) : (
        <CentralHubDashboard />
      )}
    </>
  );
}

export default function App() {
  return (
    <CompanionProvider>
      <MainApp />
    </CompanionProvider>
  );
}
