import React from 'react';
import { Feather } from '@expo/vector-icons';

export type IconName =
  | 'cpu'
  | 'layers'
  | 'shield'
  | 'terminal'
  | 'activity'
  | 'zap'
  | 'check-circle'
  | 'alert-triangle'
  | 'play'
  | 'rotate-ccw'
  | 'chevron-left'
  | 'chevron-right'
  | 'award'
  | 'book-open'
  | 'code'
  | 'git-pull-request'
  | 'server'
  | 'lock'
  | 'unlock'
  | 'search'
  | 'filter'
  | 'bookmark'
  | 'trending-up'
  | 'clock'
  | 'eye'
  | 'sliders'
  | 'database'
  | 'globe'
  | 'refresh-cw'
  | 'check'
  | 'x'
  | 'info'
  | 'star';

interface DynamicIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function DynamicIcon({ name, size = 20, color = '#F8FAFC' }: DynamicIconProps) {
  return <Feather name={name} size={size} color={color} />;
}
