import { useState } from 'react';
import { Send, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

interface CommentsSectionProps {
  comments: Comment[];
  setComments: (comments: Comment[]) => void;
}

export function CommentsSection({ comments, setComments }: CommentsSectionProps) {
  const { currentUser } = useAuth();
  const [newComment, setNewComment] = useState('');

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    const comment: Comment = {
      id: Date.now().toString(),
      text: newComment.trim(),
      author: currentUser?.name || 'System',
      timestamp: new Date().toISOString()
    };
    
    setComments([...comments, comment]);
    setNewComment('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  return (
    <div className="flex flex-col h-full border border-border rounded-xl overflow-hidden" style={{ background: 'var(--surface)' }}>
      <div className="bg-muted px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Discussion</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-64 custom-scrollbar">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground opacity-60 text-sm">
            No comments yet. Start the conversation!
          </div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                <span className="font-bold text-xs">{c.author.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-foreground">{c.author}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(c.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-sm text-foreground/90 bg-muted/40 p-2.5 rounded-lg rounded-tl-none border border-border/50">
                  {c.text}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-border bg-background">
        <div className="relative flex items-end gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment..."
            className="w-full bg-surface border border-border rounded-lg pl-3 pr-10 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none min-h-[44px] max-h-32"
            rows={1}
          />
          <button 
            type="button"
            onClick={handleAddComment}
            disabled={!newComment.trim()}
            className="absolute right-2 bottom-2 p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-right">Press Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  );
}
