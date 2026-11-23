import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  friendlyMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      friendlyMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = 'حدث خلل غير متوقع في عرض الواجهة. يمكنك المحاولة مجدداً.';
    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
      };
      if (parsed?.error) {
        if (parsed.error.toLowerCase().includes('permission')) {
          message =
            'تعذر الوصول للبيانات السحابية لعدم كفاية الصلاحيات أو الحاجة لإعادة التحقق من الجلسة.';
        } else if (parsed.error.toLowerCase().includes('quota')) {
          message =
            'تم بلوغ الحد اليومي لقراءة البيانات السحابية. يستمر العمل محلياً دون فقدان بيانات.';
        } else {
          message = 'تعذر إتمام المزامنة السحابية حالياً. بياناتك المحلية محفوظة بأمان.';
        }
      }
    } catch {
      if (error.message && error.message.length < 160) {
        message = error.message;
      }
    }
    return {
      hasError: true,
      friendlyMessage: message,
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="flex min-h-screen items-center justify-center p-6"
          style={{
            backgroundColor: 'var(--bg-main, #0f172a)',
            color: 'var(--text-primary, #f8fafc)',
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-6 text-center space-y-4 shadow-xl"
            style={{
              backgroundColor: 'var(--bg-surface, #1e293b)',
              borderColor: 'var(--border-color, #334155)',
            }}
          >
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border"
              style={{
                borderColor: 'var(--danger, #ef4444)',
                backgroundColor: 'var(--danger-bg, rgba(239,68,68,0.12))',
                color: 'var(--danger, #ef4444)',
              }}
            >
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold">Morrow — تنبيه استقرار الواجهة</h1>
            <p
              className="text-xs leading-relaxed"
              style={{ color: 'var(--text-muted, #94a3b8)' }}
            >
              {this.state.friendlyMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, friendlyMessage: '' });
                window.location.reload();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold"
              style={{
                backgroundColor: 'var(--accent, #38bdf8)',
                color: 'var(--accent-fg, #0f172a)',
              }}
            >
              <RotateCcw className="h-4 w-4" />
              <span>إعادة تحميل التطبيق</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
