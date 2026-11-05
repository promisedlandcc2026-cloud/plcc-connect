import React from 'react';
import { Outlet } from 'react-router-dom';
import { CommunityReactionsProvider } from '../context/CommunityReactionsContext';
import { CommunityPostsSyncProvider } from '../context/CommunityPostsSyncContext';

/**
 * Community-only providers — kept out of the public home bundle via lazy route loading.
 */
export const CommunityProvidersLayout: React.FC = () => (
  <CommunityReactionsProvider>
    <CommunityPostsSyncProvider>
      <Outlet />
    </CommunityPostsSyncProvider>
  </CommunityReactionsProvider>
);
