import { EventData } from '../types';

const EVENTS_KEY = 'light_party_events';

// Helper to generate ID
const generateId = () => Math.random().toString(36).substr(2, 9);

export const getEvents = (): EventData[] => {
  const stored = localStorage.getItem(EVENTS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveEvents = (events: EventData[]) => {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  // Trigger a storage event manually for the current tab if needed, 
  // though 'storage' event only fires on OTHER tabs. 
  // We will dispatch a custom event for the current tab.
  window.dispatchEvent(new Event('local-storage-update'));
};

export const createEvent = (name: string, startDateTime?: string, durationHours?: number, adminId?: string): EventData => {
  const events = getEvents();
  const newEvent: EventData = {
    id: generateId(),
    name,
    color: '#000000', // Default off/black
    isActive: true,
    isRandom: false,
    startDateTime,
    durationHours,
    adminId: adminId || 'anonymous' // Track who created it
  };
  events.push(newEvent);
  saveEvents(events);
  return newEvent;
};

// New function to handle QR Codes: Join or Create
export const joinEvent = (id: string, defaultName: string): EventData => {
  const events = getEvents();
  const existingEvent = events.find(e => e.id === id);
  
  if (existingEvent) {
    return existingEvent;
  }

  // Create new event from QR ID
  const newEvent: EventData = {
    id: id,
    name: defaultName,
    color: '#FF0000', // Default to Red for instant feedback
    isActive: true,
    isRandom: false,
    adminId: 'qr-generated'
    // QR auto-created events don't have date/duration set initially
  };
  
  events.push(newEvent);
  saveEvents(events);
  return newEvent;
};

export const updateEventColor = (id: string, color: string) => {
  const events = getEvents();
  const index = events.findIndex(e => e.id === id);
  if (index !== -1) {
    events[index].color = color;
    saveEvents(events);
  }
};

export const updateEventRandom = (id: string, isRandom: boolean) => {
  const events = getEvents();
  const index = events.findIndex(e => e.id === id);
  if (index !== -1) {
    events[index].isRandom = isRandom;
    saveEvents(events);
  }
};

export const deleteEvent = (id: string) => {
  const events = getEvents();
  const filteredEvents = events.filter(e => e.id !== id);
  saveEvents(filteredEvents);
};

// Removes events that ended more than 30 days ago
export const cleanupOldEvents = () => {
  const events = getEvents();
  const now = new Date().getTime();
  const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

  const validEvents = events.filter(event => {
    // If no date is set, keep it (or decide to delete, but usually keep manual events)
    if (!event.startDateTime) return true;

    const startTime = new Date(event.startDateTime).getTime();
    // Default to 2 hours if not specified, just for calculation safety
    const durationMs = (event.durationHours || 2) * 60 * 60 * 1000;
    const endTime = startTime + durationMs;
    
    // Calculate expiration time (End of event + 30 days)
    const expirationTime = endTime + thirtyDaysInMs;

    // Keep event if we haven't passed the expiration time
    return now < expirationTime;
  });

  if (validEvents.length !== events.length) {
    console.log(`Cleaned up ${events.length - validEvents.length} old events.`);
    saveEvents(validEvents);
  }
};

export const getEventById = (id: string): EventData | undefined => {
  return getEvents().find(e => e.id === id);
};

// Hook helper to listen to changes
export const subscribeToEvents = (callback: () => void) => {
  const handler = () => callback();
  window.addEventListener('storage', handler); // For other tabs
  window.addEventListener('local-storage-update', handler); // For same tab
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('local-storage-update', handler);
  };
};