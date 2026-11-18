'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PageName, Period } from '@/types';
import { currentMonthKey, monthOptions } from '@/lib/dates';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastState {
  message: string;
  actions?: ToastAction[];
}

interface UIContextType {
  currentPage: PageName;
  setPage: (page: PageName) => void;
  selectedPeriod: Period;
  setPeriod: (period: Period) => void;
  currentMonth: string;
  setMonth: (month: string) => void;
  monthOptions: { value: string; label: string }[];
  ovFilter: string;
  setOvFilter: (filter: string) => void;
  cashModalOpen: boolean;
  setCashModalOpen: (open: boolean) => void;
  openCashModal: () => void;
  closeCashModal: () => void;
  budgetModalOpen: boolean;
  setBudgetModalOpen: (open: boolean) => void;
  editingBudgetId: string | null;
  setEditingBudgetId: (id: string | null) => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  drawerTransactionId: string | null;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  toast: ToastState | null;
  showToast: (msg: string, actions?: ToastAction[]) => void;
  hideToast: () => void;
  filterAccount: (short: string) => void;
  goCat: (cat: string) => void;
  goReview: () => void;
  isMasked: boolean;
  toggleMasked: () => void;
  selectedAccountFilter: string;
  setSelectedAccountFilter: (acc: string) => void;
  selectedCategoryFilter: string;
  setSelectedCategoryFilter: (cat: string) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

const pathToPage: Record<string, PageName> = {
  '/': 'Overview',
  '/transactions': 'Transactions',
  '/budgets': 'Budgets',
  '/accounts': 'Accounts',
  '/categories': 'Categories',
  '/import-export': 'Import & export',
  '/settings': 'Settings',
};

const pageToPath: Record<PageName, string> = {
  Overview: '/',
  Transactions: '/transactions',
  Budgets: '/budgets',
  Accounts: '/accounts',
  Categories: '/categories',
  'Import & export': '/import-export',
  Settings: '/settings',
};

export function UIProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [currentPage, setCurrentPage] = useState<PageName>(
    pathToPage[pathname] || 'Overview'
  );
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('week');
  const [currentMonth, setCurrentMonth] = useState<string>(() => currentMonthKey());
  const [monthOptionsState] = useState(() => monthOptions());
  const [ovFilter, setOvFilter] = useState<string>('All');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTransactionId, setDrawerTransactionId] = useState<string | null>(
    null
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isMasked, setIsMasked] = useState(false);

  useEffect(() => {
    const page = pathToPage[pathname];
    if (page) {
      setCurrentPage(page);
    }
  }, [pathname]);

  useEffect(() => {
    if (isMasked) {
      document.body.classList.add('masked');
    } else {
      document.body.classList.remove('masked');
    }
  }, [isMasked]);

  const toggleMasked = () => setIsMasked((prev) => !prev);

  const showToast = (message: string, actions?: ToastAction[]) => {
    setToast({ message, actions });
    const duration = actions && actions.length > 0 ? 5500 : 2600;
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, duration);
  };

  const hideToast = () => setToast(null);

  const openCashModal = () => setCashModalOpen(true);
  const closeCashModal = () => setCashModalOpen(false);

  const openDrawer = (id: string) => {
    setDrawerTransactionId(id);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerTransactionId(null);
  };

  const handleSetPage = (p: PageName) => {
    closeDrawer();
    setCurrentPage(p);
    const targetPath = pageToPath[p];
    if (targetPath && targetPath !== pathname) {
      router.push(targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filterAccount = (short: string) => {
    setSelectedAccountFilter(short);
    setSelectedCategoryFilter('all');
    setSelectedPeriod('month');
    handleSetPage('Transactions');
  };

  const goCat = (cat: string) => {
    setSelectedCategoryFilter(cat);
    setSelectedAccountFilter('all');
    setSelectedPeriod('month');
    handleSetPage('Transactions');
  };

  const goReview = () => {
    handleSetPage('Overview');
    setTimeout(() => {
      const el = document.getElementById('reviewPanel');
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  // Keyboard shortcut: Escape to close modals and drawer; '/' to go to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrawer();
        closeCashModal();
        setBudgetModalOpen(false);
      }
      if (
        e.key === '/' &&
        !['INPUT', 'SELECT', 'TEXTAREA'].includes(
          (document.activeElement as HTMLElement)?.tagName
        )
      ) {
        e.preventDefault();
        handleSetPage('Transactions');
        setTimeout(() => {
          document.getElementById('txSearch')?.focus();
        }, 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <UIContext.Provider
      value={{
        currentPage,
        setPage: handleSetPage,
        selectedPeriod,
        setPeriod: setSelectedPeriod,
        currentMonth,
        setMonth: setCurrentMonth,
        monthOptions: monthOptionsState,
        ovFilter,
        setOvFilter,
        cashModalOpen,
        setCashModalOpen,
        openCashModal,
        closeCashModal,
        budgetModalOpen,
        setBudgetModalOpen,
        editingBudgetId,
        setEditingBudgetId,
        drawerOpen,
        setDrawerOpen,
        drawerTransactionId,
        openDrawer,
        closeDrawer,
        toast,
        showToast,
        hideToast,
        filterAccount,
        goCat,
        goReview,
        isMasked,
        toggleMasked,
        selectedAccountFilter,
        setSelectedAccountFilter,
        selectedCategoryFilter,
        setSelectedCategoryFilter,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUIState() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUIState must be used within a UIProvider');
  }
  return context;
}