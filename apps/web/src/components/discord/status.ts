import type { DiscordMemberStatus } from '@automata/types';

export type DiscordPresenceStatus = DiscordMemberStatus['status'];

type StatusMeta = {
  readonly icon: string;
  readonly color: string;
  readonly label: string;
  readonly order: number;
};

const STATUS_META: Record<DiscordPresenceStatus, StatusMeta> = {
  online: {
    icon: 'mdi-circle',
    color: 'success',
    label: 'Online',
    order: 0,
  },
  idle: {
    icon: 'mdi-minus-circle',
    color: 'warning',
    label: 'Idle',
    order: 1,
  },
  dnd: {
    icon: 'mdi-do-not-disturb',
    color: 'error',
    label: 'DND',
    order: 2,
  },
  offline: {
    icon: 'mdi-circle-outline',
    color: 'grey',
    label: 'Offline',
    order: 3,
  },
};

export function getStatusMeta(status: DiscordPresenceStatus): StatusMeta {
  return STATUS_META[status];
}

export function getStatusIcon(status: DiscordPresenceStatus): string {
  return STATUS_META[status]?.icon ?? STATUS_META.offline.icon;
}

export function getStatusColor(status: DiscordPresenceStatus): string {
  return STATUS_META[status]?.color ?? STATUS_META.offline.color;
}

export function compareStatus(a: DiscordPresenceStatus, b: DiscordPresenceStatus): number {
  return getStatusMeta(a).order - getStatusMeta(b).order;
}
