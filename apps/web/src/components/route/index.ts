// Route components
export { default as RouteSummary } from './RouteSummary.vue';
export { default as RouteAlerts } from './RouteAlerts.vue';
export { default as RouteModeToggle } from './RouteModeToggle.vue';
export { default as RouteSettings } from './RouteSettings.vue';

// Route types
export interface RouteAlert {
  id: number;
  message: string;
}

export interface RouteSettingsProps {
  mode: import('../monitoringMode').MonitoringMode;
  refreshInterval: number;
  thresholdMinutes: number;
  isNavMode: boolean;
}

export interface RouteSummaryProps {
  routeData: import('@automata/types').RouteTimeResponse | null;
  isPolling: boolean;
  cacheDescription: string;
}

export interface RouteAlertsProps {
  alerts: RouteAlert[];
  compact: boolean;
}

export interface RouteModeToggleProps {
  modelValue: import('../monitoringMode').MonitoringMode;
  mandatory?: boolean;
  density?: 'default' | 'comfortable' | 'compact';
  color?: string;
  buttonClass?: string;
  ariaLabel?: string;
}
