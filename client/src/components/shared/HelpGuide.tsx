import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, LayoutDashboard, FileText, CheckSquare, Bell, Search, Users, Settings, MessageSquare, GitBranch, Send } from 'lucide-react';

interface HelpGuideProps {
  onClose: () => void;
}

interface Step {
  title: string;
  icon: React.ElementType;
  screenshot: string;
  content: string[];
}

const steps: Step[] = [
  {
    title: 'Dashboard Overview',
    icon: LayoutDashboard,
    screenshot: '/help/dashboard-overview.png',
    content: [
      'The Dashboard is your home screen in ReqFlow. It gives you an at-a-glance summary of all requisition activity.',
      'At the top, you\'ll see status cards showing counts for each request status: Draft, Pending Approval, Approved, Rejected, and Completed. Click any card to jump directly to that filtered list.',
      'Below the status cards, key metrics show how many requests are awaiting your action, how many are at risk of missing their SLA deadline, and the total number of requests in the system.',
      'The "Awaiting Purchase Completion" section (visible to N4 and Admin roles) lists approved requests that are ready for final purchase processing.',
      'At the bottom, "Pending Your Action" shows requests that need your review or approval, while "Recent Activity" provides a timeline of the latest actions across all requests.',
    ],
  },
  {
    title: 'Creating a Request',
    icon: FileText,
    screenshot: '/help/create-request-form.png',
    content: [
      'To create a new request, click "My Requests" in the sidebar, then click the "+ New Request" button in the top right corner.',
      'First, select a template. The Standard Request template includes all standard fields for military requisitions.',
      'After selecting a template, you\'ll see the request form with fields for Command, Request Type, Department/Troop, Fiscal Year, Fiscal Quarter, and more.',
      'Fill in the Primary Requestor information (name, phone, email) and optionally a Secondary Requestor. Set the Priority level and provide a detailed Description of what you need.',
      'You can also upload supporting documents using the file upload field at the bottom of the form. Multiple files are supported.',
      'Click "Save as Draft" to save your work and come back later, or "Submit" to send it into the approval pipeline immediately.',
    ],
  },
  {
    title: 'Approval Pipeline',
    icon: GitBranch,
    screenshot: '/help/approval-pipeline.png',
    content: [
      'Every submitted request goes through a multi-step approval pipeline. The pipeline is defined by the template and typically includes steps like Supervisor Approval, N4 Review, and Contracting Final.',
      'On any request detail page, click the "Approval Pipeline" tab to see all approval steps and their current status.',
      'Each step shows who it\'s assigned to, whether it\'s been approved or is still pending, and any comments the approver left when taking action.',
      'Green checkmarks indicate completed approval steps. The pipeline proceeds sequentially — each step must be approved before the next one activates.',
      'Once all steps are approved, the request moves to "Approved" status and becomes available for purchase completion.',
    ],
  },
  {
    title: 'Request Statuses',
    icon: Send,
    screenshot: '/help/request-statuses.png',
    content: [
      'Requests move through a defined lifecycle of statuses. The "My Requests" page shows all your requests with their current status displayed as a colored badge.',
      'Draft — The request has been created but not yet submitted. You can still edit all fields.',
      'Pending Approval — The request has been submitted and is working through the approval pipeline.',
      'Approved — All approval steps are complete. The request is ready for purchase processing.',
      'Rejected — An approver has rejected the request. You\'ll receive a notification with the reason.',
      'Returned for Revision — An approver sent the request back for changes. Edit and resubmit it.',
      'Completed — The purchase has been finalized and the request is closed.',
      'Use the status filter pills at the top of the request list to quickly filter by any status.',
    ],
  },
  {
    title: 'Comments & Discussion',
    icon: MessageSquare,
    screenshot: '/help/comments-section.png',
    content: [
      'Every request has a Comments tab where team members can discuss the request, ask questions, or provide updates.',
      'Comments support threading — click "Reply" on any comment to start a nested conversation. This keeps related discussions organized.',
      'Comments marked with an "Internal" badge are only visible to approvers and admins, not to the original requester. Use internal comments for sensitive notes about budget, vendor discussions, or approval reasoning.',
      'The comment count is displayed on the tab header so you can quickly see if there are new comments to review.',
    ],
  },
  {
    title: 'Notifications',
    icon: Bell,
    screenshot: '/help/notifications-page.png',
    content: [
      'ReqFlow sends real-time notifications to keep you informed about your requests. The bell icon in the top bar shows your unread notification count.',
      'Click "Notifications" in the sidebar to see all your notifications. Unread notifications are marked with a blue dot.',
      'You\'ll receive notifications for: approval step completions, request approvals, request rejections, returned requests, purchase completions, new comments, and nudge reminders.',
      'Click "Mark all as read" to clear all unread indicators at once.',
      'Notifications update in real-time — you\'ll see new notifications appear without refreshing the page.',
    ],
  },
  {
    title: 'Search & Filters',
    icon: Search,
    screenshot: '/help/search-filters.png',
    content: [
      'Use the search bar at the top of any page to quickly find requests by reference number, title, or submitter name.',
      'On the Requests page, status filter pills let you narrow the list to show only requests in a specific status. Click a pill to activate it; click it again or click "All" to clear the filter.',
      'The request list shows key information at a glance: reference number, title, template, status badge, priority, submitter, and creation date.',
      'Click any row in the request list to open the full request detail page.',
    ],
  },
  {
    title: 'User Management',
    icon: Users,
    screenshot: '/help/user-management.png',
    content: [
      'Administrators can manage user accounts from the "Users" page under the Admin section in the sidebar.',
      'The user table shows each person\'s name, email, role, account status (Active/Inactive), and password status.',
      'Password status shows "Set" (green) if the user has configured their password, or "Pending Setup" (yellow) if they still need to set it on first login.',
      'Click the edit icon to modify a user\'s role or status. Click the key icon to reset a user\'s password, which will require them to set a new one on next login.',
      'To add a new user, click "+ Add User" and fill in their name, email, and role. They\'ll receive instructions to set their password on first login.',
      'Available roles: Administrator, Approver, N4, Contracting, Reviewer, Requester, and Viewer. Each role has different permissions for viewing, creating, and approving requests.',
    ],
  },
  {
    title: 'System Settings',
    icon: Settings,
    screenshot: '/help/system-settings.png',
    content: [
      'The Settings page (Admin only) lets you configure system-wide preferences for ReqFlow.',
      'General: Set the application display name that appears in the sidebar and login page.',
      'SLA & Nudge Settings: Configure the Default SLA (hours before a request is flagged as at-risk), Nudge Threshold (hours before the nudge button appears for requesters), and Nudge Cooldown (minimum hours between nudges).',
      'Email Notifications: Enable or disable email notifications and configure SMTP settings (host, port, username, password, from address) for outbound email delivery.',
      'Changes take effect immediately after saving.',
    ],
  },
];

export function HelpGuide({ onClose }: HelpGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const goNext = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  }, []);

  const goPrev = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goNext, goPrev]);

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col"
        style={{ width: 'min(1100px, 95vw)', height: 'min(700px, 90vh)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Help Guide</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <nav className="w-56 border-r border-gray-200 dark:border-gray-700 py-3 px-2 overflow-y-auto shrink-0">
            {steps.map((s, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  i === currentStep
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                }`}
              >
                <s.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">{step.title}</h3>

            <img
              src={step.screenshot}
              alt={step.title}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 mb-5 shadow-sm"
            />

            <div className="space-y-3">
              {step.content.map((paragraph, i) => (
                <p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            onClick={goPrev}
            disabled={currentStep === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <span className="text-xs text-gray-400">
            {currentStep + 1} of {steps.length}
          </span>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={goNext}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
