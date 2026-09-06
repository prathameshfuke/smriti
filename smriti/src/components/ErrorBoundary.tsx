'use client';

import { Component, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';

interface ErrorBoundaryClassProps {
  children: ReactNode;
  onGoHome: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render errors in its subtree. The fallback never shows the error
 * message or stack — a patient with dementia gets confused, not informed, by
 * technical detail; the message goes to the console for developers only.
 *
 * Only a class component can catch render errors, but `useRouter` is a hook
 * — so navigation is supplied in as a prop from the functional wrapper below
 * rather than called directly here.
 */
class ErrorBoundaryClass extends Component<ErrorBoundaryClassProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('SMRITI: caught render error', error, info);
  }

  goHome = (): void => {
    this.setState({ hasError: false });
    this.props.onGoHome();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="mx-auto flex min-h-dvh max-w-patient flex-col items-center justify-center gap-5 bg-surface px-4 py-16 text-center">
        <span className="text-6xl" aria-hidden="true">
          😔
        </span>
        <p className="font-serif-display text-patient-heading text-ink">
          Something went wrong. Let us go back home.
        </p>
        <BigButton label="Go Home" variant="primary" onClick={this.goHome} />
      </div>
    );
  }
}

export default function ErrorBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();
  return <ErrorBoundaryClass onGoHome={() => router.push('/app')}>{children}</ErrorBoundaryClass>;
}
