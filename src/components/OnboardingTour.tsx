'use client';

import { useEffect, useState } from 'react';
import { driver } from 'driver.js';

export function OnboardingTour() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const driverObj = driver({
      showProgress: true,
      steps: [
        { 
          element: '#sidebar-nav', 
          popover: { 
            title: 'Navigation Menu', 
            description: 'Navigate between all your IT modules from here.', 
            side: 'right', 
            align: 'start' 
          } 
        },
        { 
          element: '#dashboard-stats', 
          popover: { 
            title: 'Quick Metrics', 
            description: 'Stay on top of active tickets, tasks, and members at a glance.', 
            side: 'bottom', 
            align: 'center' 
          } 
        },
        { 
          element: '#tour-search', 
          popover: { 
            title: 'Global Search', 
            description: 'Press Cmd+K to search across all data modules instantly.', 
            side: 'bottom', 
            align: 'center' 
          } 
        },
        { 
          element: '#tour-role', 
          popover: { 
            title: 'Your Role', 
            description: 'Check your current access level (Admin vs Member). This controls what you can view and edit.', 
            side: 'left', 
            align: 'start' 
          } 
        }
      ]
    });

    const startTour = () => {
      driverObj.drive();
    };

    // Listen for custom event to start tour
    document.addEventListener('start-tour', startTour);

    // Auto start on first visit
    const hasSeenTour = localStorage.getItem('it-mgt-tour');
    if (!hasSeenTour) {
      // Delay slightly for initial render animations to finish
      setTimeout(() => {
        startTour();
        localStorage.setItem('it-mgt-tour', 'true');
      }, 1000);
    }

    return () => document.removeEventListener('start-tour', startTour);
  }, [mounted]);

  return null;
}
