import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Home from './pages/Home';
import Debugger from './pages/Debugger';
import PayrollScheduler from './pages/PayrollScheduler';
import EmployeeEntry from './pages/EmployeeEntry';
import AppLayout from './components/AppLayout';
import HelpCenter from './pages/HelpCenter';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorFallback from './components/ErrorFallback';
import Settings from './pages/Settings';
import CustomReportBuilder from './pages/CustomReportBuilder';
import CrossAssetPayment from './pages/CrossAssetPayment';
import TransactionHistory from './pages/TransactionHistory';
import VestingEscrow from './pages/VestingEscrow';
import RevenueSplitDashboard from './pages/RevenueSplitDashboard';
import CashFlowForecast from './pages/CashFlowForecast';

import EmployeePortal from './pages/EmployeePortal';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import { useTranslation } from 'react-i18next';
import { contractService } from './services/contracts';

function App() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const { t } = useTranslation();

  // Initialize contract service on app startup
  useEffect(() => {
    contractService.initialize().catch((error) => {
      console.error('Failed to initialize contract service:', error);
    });
  }, []);

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          path="/"
          element={
            <ErrorBoundary
              fallback={
                <ErrorFallback
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                  title={t('errorFallback.homeTitle')}
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                  description={t('errorFallback.homeDescription')}
                />
              }
            >
              <Home />
            </ErrorBoundary>
          }
        />
        <Route
          path="/payroll"
          element={
            <ErrorBoundary
              fallback={
                <ErrorFallback
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                  title={t('errorFallback.payrollTitle')}
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                  description={t('errorFallback.payrollDescription')}
                />
              }
            >
              <PayrollScheduler />
            </ErrorBoundary>
          }
        />
        <Route
          path="/employee"
          element={
            <ErrorBoundary
              fallback={
                <ErrorFallback
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                  title={t('errorFallback.employeesTitle')}
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                  description={t('errorFallback.employeesDescription')}
                />
              }
            >
              <EmployeeEntry />
            </ErrorBoundary>
          }
        />
        <Route
          path="/portal"
          element={
            <ErrorBoundary
              fallback={
                <ErrorFallback
                  title="Employee Portal Error"
                  description="Something went wrong loading your portal."
                />
              }
            >
              <EmployeePortal />
            </ErrorBoundary>
          }
        />
        <Route
          path="/reports"
          element={
            <ErrorBoundary fallback={<ErrorFallback />}>
              <CustomReportBuilder />
            </ErrorBoundary>
          }
        />
        <Route
          path="/debug"
          element={
            <ErrorBoundary
              fallback={
                <ErrorFallback
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                  title={t('errorFallback.debuggerTitle')}
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                  description={t('errorFallback.debuggerDescription')}
                />
              }
            >
              <Debugger />
            </ErrorBoundary>
          }
        />
        <Route
          path="/debug/:contractName"
          element={
            <ErrorBoundary
              fallback={
                <ErrorFallback
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                  title={t('errorFallback.debuggerTitle')}
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                  description={t('errorFallback.debuggerDescription')}
                />
              }
            >
              <Debugger />
            </ErrorBoundary>
          }
        />
        <Route
          path="/settings"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
              <Settings />
            </ErrorBoundary>
          }
        />
        <Route
          path="/help"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
              <HelpCenter />
            </ErrorBoundary>
          }
        />
        <Route
          path="/cross-asset-payment"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
              <CrossAssetPayment />
            </ErrorBoundary>
          }
        />
        <Route
          path="/transactions"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
              <TransactionHistory />
            </ErrorBoundary>
          }
        />
        <Route
          path="/vesting"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
              <VestingEscrow />
            </ErrorBoundary>
          }
        />
        <Route
          path="/revenue-split"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
              <RevenueSplitDashboard />
            </ErrorBoundary>
          }
        />
        <Route
          path="/cash-flow"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
              <CashFlowForecast />
            </ErrorBoundary>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/auth-callback" element={<AuthCallback />} />
      </Route>
    </Routes>
  );
}

export default App;
