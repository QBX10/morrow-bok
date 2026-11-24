import React from 'react';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  allowFullscreen?: boolean;
  initialFullscreen?: boolean;
  maxWidthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Legacy BottomSheet adapter upgraded to strict Full-Screen Push Navigation
 * so all existing consumers open seamlessly as isolated full-screen pages.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onClose,
  title,
  subtitle,
  icon,
  maxWidthClass = 'max-w-3xl',
  children,
  footer,
}) => {
  return (
    <FullScreenPushPage
      open={open}
      onBack={onClose}
      title={title}
      subtitle={subtitle}
      icon={icon}
      maxWidthClass={maxWidthClass}
      footer={footer}
      zIndexClass="z-[var(--z-sheet)]"
    >
      {children}
    </FullScreenPushPage>
  );
};
