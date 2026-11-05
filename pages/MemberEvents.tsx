import React from 'react';
import { UpcomingEvents } from '../components/UpcomingEvents';
import { MemberPageHeader } from '../components/member/MemberPageHeader';

/** Member Events destination — reuses existing events table / UpcomingEvents UI. */
export const MemberEventsPage: React.FC = () => (
  <main className="flex-1 px-5 pt-10 pb-28">
    <MemberPageHeader
      title="Events"
      subtitle="Services, studies, and gatherings coming up at PLCC."
    />
    <UpcomingEvents heading="Coming up" />
  </main>
);
