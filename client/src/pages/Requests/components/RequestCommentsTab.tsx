import { MessageSquare } from 'lucide-react';
import { formatRelative } from '../../../utils/dateFormat';
import type { Comment } from '@req-tracker/shared';

interface RequestCommentsTabProps {
  comments: Comment[];
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onSubmitComment: () => void;
  canComment: boolean;
}

export function RequestCommentsTab({ comments, commentText, onCommentTextChange, onSubmitComment, canComment }: RequestCommentsTabProps) {
  return (
    <div className="space-y-4">
      <div className="card p-6">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-500 mb-4">No comments yet.</p>
        ) : (
          <div className="space-y-4 mb-6">
            {comments.map(function renderComment(c: Comment): JSX.Element {
              return (
                <div key={c.id}>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                      {c.user_name?.charAt(0) ?? '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.user_name}</span>
                        <span className="text-xs text-gray-400">
                          {formatRelative(c.created_at)}
                        </span>
                        {c.is_internal && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 px-1.5 py-0.5 rounded">Internal</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{c.body}</p>
                    </div>
                  </div>
                  {c.replies && c.replies.length > 0 && (
                    <div className="ml-10 mt-3 space-y-3 border-l-2 border-gray-100 dark:border-gray-700 pl-4">
                      {c.replies.map(renderComment)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {canComment && (
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-gray-400 mt-2" />
            <div className="flex-1">
              <textarea
                value={commentText}
                onChange={e => onCommentTextChange(e.target.value)}
                placeholder="Add a comment..."
                className="input"
                rows={2}
              />
              <div className="flex justify-end mt-2">
                <button onClick={onSubmitComment} className="btn-primary btn-sm" disabled={!commentText.trim()}>
                  Post Comment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
