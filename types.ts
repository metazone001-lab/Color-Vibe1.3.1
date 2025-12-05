export enum UserRole {
  GUEST = 'GUEST',
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export interface EventData {
  id: string;
  name: string;
  color: string; // Hex code
  isActive: boolean;
  isRandom?: boolean;
  startDateTime?: string; // ISO string date
  durationHours?: number; // Duration in hours
  adminId?: string; // ID of the admin who created the event
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  provider: 'google' | 'facebook' | 'guest';
}

export enum AppView {
  WELCOME = 'WELCOME',
  EVENT_SELECTION = 'EVENT_SELECTION',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  ADMIN_PREVIEW = 'ADMIN_PREVIEW',
  LIGHT_SCREEN = 'LIGHT_SCREEN',
}