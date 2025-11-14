import { useEffect, useState, useRef, useCallback } from 'react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * ProctorGuard - Full Screen-Only Proctoring Enforcement
 * Implements strict proctoring with fullscreen enforcement, DevTools detection, and violation tracking
 */
export default function ProctorGuard({ sessionId, proctorConfig, children, onInvalidated }) {
  const [invalidated, setInvalidated] = useState(false);
  const [proctorSummary, setProctorSummary] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const { user } = useAuth();
  const consentGivenRef = useRef(false);
  const devToolsCheckIntervalRef = useRef(null);
  const fullscreenCheckIntervalRef = useRef(null);
  
  // Check localStorage for consent (persists across sessions)
  const hasConsent = () => {
    if (user?.proctorConsent) return true;
    const stored = localStorage.getItem('proctorConsent');
    return stored === 'true';
  };

  // End assessment when user leaves proctored environment
  const endAssessment = useCallback(async () => {
    if (!sessionId || invalidated) return;
    try {
      await apiFetch('/api/assessment/finish', {
        method: 'POST',
        body: { sessionId },
      });
      sessionStorage.removeItem('assessmentSession');
    } catch (error) {
      console.error('Failed to end assessment:', error);
    }
  }, [sessionId, invalidated]);

  // Post proctor event to backend
  const postEvent = useCallback(async (violationType, details = '') => {
    if (!sessionId || !proctorConfig || invalidated) return;

    try {
      const result = await apiFetch('/api/proctor/event', {
        method: 'POST',
        body: {
          sessionId,
          violationType,
          details,
        },
      });

      if (result.proctorSummary) {
        setProctorSummary(result.proctorSummary);
      }

      if (result.invalidated || result.status === 'invalidated') {
        setInvalidated(true);
        // Automatically end the assessment when invalidated
        await endAssessment();
        if (onInvalidated) {
          onInvalidated(result);
        }
        // Redirect to dashboard after ending assessment
        setTimeout(() => {
          window.location.href = '/student/dashboard';
        }, 2000);
      }

      // Update violation count for UI warning
      setViolationCount(prev => prev + 1);
    } catch (error) {
      console.error('Failed to post proctor event:', error);
    }
  }, [sessionId, proctorConfig, invalidated, onInvalidated, endAssessment]);

  // Force fullscreen on mount
  const enterFullscreen = useCallback(async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        await document.documentElement.webkitRequestFullscreen();
      } else if (document.documentElement.mozRequestFullScreen) {
        await document.documentElement.mozRequestFullScreen();
      } else if (document.documentElement.msRequestFullscreen) {
        await document.documentElement.msRequestFullscreen();
      }
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      postEvent('fullscreen_exit', 'Failed to enter fullscreen');
    }
  }, [postEvent]);

  // Check if in fullscreen
  const isFullscreen = () => {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  };

  // Detect DevTools by viewport difference (outer vs inner size)
  const detectDevTools = useCallback(() => {
    const threshold = 160; // pixels
    const outerWidth = window.outerWidth;
    const outerHeight = window.outerHeight;
    const innerWidth = window.innerWidth;
    const innerHeight = window.innerHeight;

    const widthDiff = outerWidth - innerWidth;
    const heightDiff = outerHeight - innerHeight;

    // If difference is significant, DevTools might be open
    if (widthDiff > threshold || heightDiff > threshold) {
      postEvent('devtools_opened', `Viewport difference detected: ${widthDiff}x${heightDiff}`);
    }
  }, [postEvent]);

  useEffect(() => {
    if (!sessionId || !proctorConfig) return;

    // Check proctor consent
    if (!hasConsent() && !consentGivenRef.current) {
      setShowConsentModal(true);
      return;
    }

    // 1. Force fullscreen on mount
    enterFullscreen();

    // Monitor fullscreen changes
    const handleFullscreenChange = () => {
      if (!isFullscreen()) {
        postEvent('fullscreen_exit', 'User exited fullscreen');
        // Re-enter fullscreen immediately
        setTimeout(() => enterFullscreen(), 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // 2. Detect tab switching (document.hidden) - End assessment if user leaves
    const handleVisibilityChange = () => {
      if (document.hidden) {
        postEvent('tab_switch', 'Tab switch detected: document.hidden=true');
        // If user leaves for more than 5 seconds, end the assessment
        setTimeout(async () => {
          if (document.hidden && !invalidated) {
            await endAssessment();
            setInvalidated(true);
            window.location.href = '/student/dashboard';
          }
        }, 5000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Detect window blur - End assessment if user leaves
    const handleBlur = () => {
      postEvent('window_blur', 'Window blur detected');
      // If window stays blurred for more than 5 seconds, end the assessment
      setTimeout(async () => {
        if (document.hidden && !invalidated) {
          await endAssessment();
          setInvalidated(true);
          window.location.href = '/student/dashboard';
        }
      }, 5000);
    };
    window.addEventListener('blur', handleBlur);

    // 4. Block copy/paste/cut
    const handleCopy = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      postEvent('copy_attempt', 'Copy attempt detected');
      return false;
    };

    const handlePaste = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      postEvent('paste_attempt', 'Paste attempt detected');
      return false;
    };

    const handleCut = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      postEvent('copy_attempt', 'Cut attempt detected');
      return false;
    };

    document.addEventListener('copy', handleCopy, { capture: true, passive: false });
    document.addEventListener('paste', handlePaste, { capture: true, passive: false });
    document.addEventListener('cut', handleCut, { capture: true, passive: false });

    // 5. Block right click
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      postEvent('right_click_attempt', 'Right-click attempt detected');
      return false;
    };
    document.addEventListener('contextmenu', handleContextMenu, { capture: true, passive: false });

    // 6. Detect cheat key combos (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+L, Ctrl+S)
    const handleKeyDown = (e) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        postEvent('devtools_opened', 'F12 key pressed');
        return false;
      }

      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        postEvent('devtools_opened', `Keyboard shortcut detected: Ctrl+Shift+${e.key}`);
        return false;
      }

      // Ctrl+U (view source)
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        postEvent('devtools_opened', 'Ctrl+U (view source) detected');
        return false;
      }

      // Ctrl+L (address bar focus - can be used to navigate away)
      if (e.ctrlKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        postEvent('page_exit_attempt', 'Ctrl+L (address bar) detected');
        return false;
      }

      // Ctrl+S (save page)
      if (e.ctrlKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        postEvent('copy_attempt', 'Ctrl+S (save page) detected');
        return false;
      }

      // Mac shortcuts: Cmd+Option+I, Cmd+Option+J
      if (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        postEvent('devtools_opened', `Mac shortcut detected: Cmd+Option+${e.key}`);
        return false;
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });

    // 7. Detect PrintScreen
    const handlePrintScreen = (e) => {
      if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'PrintScreen')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        postEvent('screenshot_key_pressed', 'PrintScreen key pressed');
        return false;
      }
    };
    window.addEventListener('keydown', handlePrintScreen, { capture: true, passive: false });

    // 8. Detect DevTools by viewport difference (check every 1 second)
    devToolsCheckIntervalRef.current = setInterval(() => {
      detectDevTools();
    }, 1000);

    // 9. Block back button/refresh - End assessment when user tries to leave
    const handleBeforeUnload = async (e) => {
      postEvent('page_exit_attempt', 'Page exit attempt detected (beforeunload)');
      // End the assessment when user tries to leave
      await endAssessment();
      const message = 'Your assessment is proctored. Leaving will end your session.';
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 10. Prevent text selection (except in input/textarea)
    const handleSelectStart = (e) => {
      // Allow selection in input fields for answering
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return true;
      }
      e.preventDefault();
      return false;
    };
    document.addEventListener('selectstart', handleSelectStart, { capture: true, passive: false });

    // Apply CSS to prevent selection
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.MozUserSelect = 'none';
    document.body.style.msUserSelect = 'none';
    
    // Allow selection in input/textarea
    const style = document.createElement('style');
    style.setAttribute('data-proctor', 'true');
    style.textContent = `
      input, textarea {
        user-select: text !important;
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
      }
    `;
    document.head.appendChild(style);

    // Monitor fullscreen continuously
    fullscreenCheckIntervalRef.current = setInterval(() => {
      if (!isFullscreen()) {
        postEvent('fullscreen_exit', 'Fullscreen exited (detected by interval check)');
        enterFullscreen();
      }
    }, 2000);

    // Cleanup
    return () => {
      // End assessment on unmount if still active
      if (!invalidated && sessionId) {
        endAssessment();
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('copy', handleCopy, { capture: true });
      document.removeEventListener('paste', handlePaste, { capture: true });
      document.removeEventListener('cut', handleCut, { capture: true });
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keydown', handlePrintScreen, { capture: true });
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('selectstart', handleSelectStart, { capture: true });
      
      if (devToolsCheckIntervalRef.current) {
        clearInterval(devToolsCheckIntervalRef.current);
      }
      if (fullscreenCheckIntervalRef.current) {
        clearInterval(fullscreenCheckIntervalRef.current);
      }
      
      // Restore text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.MozUserSelect = '';
      document.body.style.msUserSelect = '';
      
      // Remove style tag
      const styleTag = document.querySelector('style[data-proctor]');
      if (styleTag) styleTag.remove();
    };
  }, [sessionId, proctorConfig, user, postEvent, enterFullscreen, detectDevTools, invalidated, endAssessment]);

  // Fetch proctor summary periodically
  useEffect(() => {
    if (!sessionId || !proctorConfig) return;

    const interval = setInterval(async () => {
      try {
        const summary = await apiFetch(`/api/proctor/session/${sessionId}/summary`);
        if (summary.proctorSummary) {
          setProctorSummary(summary.proctorSummary);
        }
      if (summary.invalidated) {
        setInvalidated(true);
        await endAssessment();
        if (onInvalidated) {
          onInvalidated(summary);
        }
        setTimeout(() => {
          window.location.href = '/student/dashboard';
        }, 2000);
      }
      } catch (error) {
        console.error('Failed to fetch proctor summary:', error);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [sessionId, proctorConfig, onInvalidated, invalidated, endAssessment]);

  // Handle consent
  const handleConsent = async () => {
    try {
      await apiFetch('/api/auth/proctor-consent', { method: 'POST' });
      localStorage.setItem('proctorConsent', 'true');
      consentGivenRef.current = true;
      setShowConsentModal(false);
    } catch (error) {
      console.error('Failed to save consent:', error);
      localStorage.setItem('proctorConsent', 'true');
      consentGivenRef.current = true;
      setShowConsentModal(false);
    }
  };

  // Show consent modal
  if (showConsentModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900 max-w-md mx-4">
          <h3 className="text-xl font-semibold mb-4">Proctoring Consent Required</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            This assessment session is proctored. We will monitor:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Fullscreen mode (required)</li>
              <li>Tab switches and window focus</li>
              <li>Copy/paste attempts</li>
              <li>Right-click attempts</li>
              <li>Developer tools access</li>
              <li>Screenshot attempts</li>
            </ul>
            <strong>No camera or screenshots will be used.</strong>
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleConsent}
              className="flex-1 rounded bg-indigo-600 px-4 py-2 text-white hover:brightness-105"
            >
              I Consent
            </button>
            <button
              onClick={() => window.location.href = '/student'}
              className="rounded border px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show invalidation overlay
  if (invalidated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-900/95">
        <div className="rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900 max-w-md mx-4 text-center">
          <h3 className="text-2xl font-bold text-red-600 mb-4">Assessment Invalidated</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            This session has been invalidated due to proctoring violations. Please contact your instructor.
          </p>
          {proctorSummary && (
            <div className="text-sm text-slate-500 mb-4 space-y-1">
              <p><strong>Risk Score:</strong> {proctorSummary.riskScore || 0}</p>
              <p><strong>Total Violations:</strong> {proctorSummary.totalViolations || 0}</p>
              <p><strong>Major Violations:</strong> {proctorSummary.majorViolations || 0}</p>
              <p><strong>Minor Violations:</strong> {proctorSummary.minorViolations || 0}</p>
            </div>
          )}
          <button
            onClick={() => window.location.href = '/student'}
            className="rounded bg-indigo-600 px-6 py-2 text-white hover:brightness-105"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show proctor status indicator
  const getStatusColor = () => {
    if (!proctorSummary) return 'bg-gray-200';
    const riskScore = proctorSummary.riskScore || 0;
    if (riskScore >= 15) return 'bg-red-500';
    if (riskScore >= 10) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="relative">
      {proctorConfig && (
        <>
          {proctorSummary && (
            <div className={`fixed top-4 right-4 z-40 rounded-lg px-3 py-2 text-white text-xs font-medium shadow-lg ${getStatusColor()}`}>
              Proctor: {proctorSummary.riskScore || 0} risk ({violationCount} violations)
            </div>
          )}
          {violationCount > 0 && violationCount < 3 && (
            <div className="fixed top-20 right-4 z-40 rounded-lg bg-yellow-500 px-3 py-2 text-white text-xs font-medium shadow-lg animate-pulse">
              ⚠️ Warning: {violationCount} violation{violationCount !== 1 ? 's' : ''} detected
            </div>
          )}
        </>
      )}
      {children}
    </div>
  );
}
