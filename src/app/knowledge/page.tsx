'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Search, BookOpen, Edit3, Trash2, Save, Clock, User, ChevronRight, Hash, Image as ImageIcon, Link as LinkIcon, Video as VideoIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface Article {
  id: number;
  title: string;
  content: string;
  author: string;
  category: string;
  tags: string;
  views: number;
  likes: number;
  created_at: string;
  updated_at: string;
}

export default function KnowledgeBasePage() {
  const { currentUser } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('General');
  const [editTags, setEditTags] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const CATEGORIES = ['General', 'Hardware', 'Software', 'Network', 'Policies', 'Troubleshooting'];

  useEffect(() => {
    fetchArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/articles');
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
        if (data.length > 0 && !activeArticle) {
          setActiveArticle(data[0]);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setActiveArticle(null);
    setEditTitle('');
    setEditContent('');
    setEditCategory('General');
    setEditTags('');
    setIsEditing(true);
  };

  const handleEdit = (article: Article) => {
    setActiveArticle(article);
    setEditTitle(article.title);
    setEditContent(article.content);
    setEditCategory(article.category);
    
    // Parse tags safely
    let parsedTags = '';
    try { parsedTags = JSON.parse(article.tags).join(', '); } catch { parsedTags = article.tags.replace(/[\[\]"]/g, ''); }
    setEditTags(parsedTags);
    
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    const tagArray = editTags.split(',').map(t => t.trim()).filter(Boolean);

    const payload = {
      id: activeArticle?.id,
      title: editTitle,
      content: editContent,
      author: activeArticle?.author || currentUser?.name || 'System',
      category: editCategory,
      tags: JSON.stringify(tagArray)
    };

    try {
      const isNew = !activeArticle;
      const res = await fetch('/api/articles', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(`Article ${isNew ? 'created' : 'updated'} successfully`);
        setIsEditing(false);
        fetchArticles(); // refresh list
      } else {
        toast.error('Failed to save article');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error saving article');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    try {
      const res = await fetch(`/api/articles?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Article deleted');
        if (activeArticle?.id === id) {
          setActiveArticle(null);
          setIsEditing(false);
        }
        fetchArticles();
      }
    } catch {
      toast.error('Failed to delete article');
    }
  };

  // Upload file helper
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (res.ok) {
        const data = await res.json();
        const url = data.url;
        const isVideo = file.type.startsWith('video/');
        const markdownFormat = isVideo ? `\n[Video](${url})\n` : `\n![${file.name}](${url})\n`;
        
        setEditContent(prev => prev + markdownFormat);
        toast.success(isVideo ? 'Video uploaded!' : 'Image uploaded!');
      } else {
        toast.error('Upload failed!');
      }
    } catch (error) {
       toast.error('Error during upload');
    } finally {
       setIsUploading(false);
       if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Simple Markdown Parser for Preview
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-bold mb-4 mt-6 text-foreground">{line.substring(2)}</h1>;
      if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-semibold mb-3 mt-5 text-foreground">{line.substring(3)}</h2>;
      if (line.startsWith('### ')) return <h3 key={i} className="text-xl font-medium mb-2 mt-4 text-foreground">{line.substring(4)}</h3>;
      if (line.startsWith('- ')) return <li key={i} className="ml-4 mb-1 list-disc text-muted-foreground">{line.substring(2)}</li>;
      if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-primary pl-4 py-1 my-3 bg-primary/5 text-muted-foreground italic rounded-r-lg">{line.substring(2)}</blockquote>;
      if (line.startsWith('```')) return <div key={i} className="bg-black/50 p-3 rounded-lg my-3 font-mono text-sm text-green-400 overflow-x-auto">{line.replace(/`/g, '') || ' '}</div>;
      if (line.trim() === '') return <div key={i} className="h-4"></div>;
      
      // Auto-Embed YouTube links
      const ytMatch = line.match(/(?:(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/))([a-zA-Z0-9_-]{11})/i);
      if (ytMatch && ytMatch[1]) {
        return (
          <div key={i} className="my-6 aspect-video max-w-3xl rounded-xl overflow-hidden shadow-lg border border-border/50 relative bg-black/50">
            <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${ytMatch[1]}`} allowFullScreen frameBorder="0"></iframe>
          </div>
        );
      }

      // Inline formatting (Bold, Images, Links, Inline-Video)
      const parseInline = (content: string, keyPrefix: string) => {
        // split by Bold
        const boldParts = content.split(/\*\*(.*?)\*\*/g);
        return boldParts.map((part, idx) => {
          if (idx % 2 === 1) return <strong key={`${keyPrefix}-${idx}`} className="text-foreground">{part}</strong>;
          
          // Next split by Markdown Link / Image parsing:  [text](url) or ![alt](url)
          const linkRegex = /(!?)\[(.*?)\]\((.*?)\)/g;
          const pieces = [];
          let lastIdx = 0;
          let match;
          while ((match = linkRegex.exec(part)) !== null) {
            // Push preceding plain text
            if (match.index > lastIdx) pieces.push(part.substring(lastIdx, match.index));
            lastIdx = match.index + match[0].length;
            
            const isImage = match[1] === '!';
            const linkText = match[2];
            const url = match[3];

            if (isImage) {
              pieces.push(<div key={`${keyPrefix}-${idx}-${lastIdx}`} className="my-4"><img src={url} alt={linkText} className="max-w-full md:max-w-3xl rounded-xl border border-border pointer-events-none" /></div>);
            } else if (url.match(/\.(mp4|webm|ogg)$/i)) {
              pieces.push(<div key={`${keyPrefix}-${idx}-${lastIdx}`} className="my-4"><video controls src={url} className="max-w-full md:max-w-3xl rounded-xl border border-border shadow-md aspect-video bg-black/50" /></div>);
            } else {
              pieces.push(<a key={`${keyPrefix}-${idx}-${lastIdx}`} href={url} target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline hover:text-primary/80 transition-colors inline-block break-words">{linkText}</a>);
            }
          }
          if (lastIdx < part.length) pieces.push(part.substring(lastIdx));
          
          return pieces.length === 1 ? pieces[0] : pieces;
        });
      };

      return (
        <div key={i} className="mb-2 text-muted-foreground/90 leading-relaxed text-[15px]">
          {parseInline(line, String(i))}
        </div>
      );
    });
  };

  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden relative">
      
      {/* Magic UI Inspired Glowing Background Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-violet-500/5 blur-[100px]" />
      </div>

      {/* Sidebar List */}
      <div className="w-[320px] shrink-0 border-r flex flex-col relative z-10 bg-background/50 backdrop-blur-xl" style={{ borderColor: 'var(--border)' }}>
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" /> Wiki Space</h1>
            <button 
              onClick={handleCreateNew}
              className="p-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors"
              title="New Article"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search knowledge base..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {loading ? (
            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground text-sm">No articles found</div>
          ) : (
            filteredArticles.map(article => (
              <button
                key={article.id}
                onClick={() => { setActiveArticle(article); setIsEditing(false); }}
                className={`w-full text-left p-3 rounded-xl transition-all ${activeArticle?.id === article.id && !isEditing ? 'bg-primary/10 border-primary/20 shadow-sm' : 'hover:bg-surface border-transparent'} border`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-surface border border-border text-muted-foreground">{article.category}</span>
                </div>
                <h3 className={`font-medium text-sm line-clamp-2 ${activeArticle?.id === article.id && !isEditing ? 'text-primary' : 'text-foreground'}`}>
                  {article.title}
                </h3>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1 opacity-70"><User className="w-3 h-3" /> {article.author.split(' ')[0]}</span>
                  <span className="flex items-center gap-1 opacity-70"><Clock className="w-3 h-3" /> {new Date(article.updated_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden bg-background">
        {isEditing ? (
          <div className="flex-1 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Edit Header */}
            <div className="h-14 border-b border-border/50 flex items-center justify-between px-6 bg-surface/30 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span>Wiki</span>
                <ChevronRight className="w-4 h-4" />
                <span className="text-foreground">{activeArticle ? 'Edit Article' : 'New Article'}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-surface transition-colors">Cancel</button>
                <button onClick={handleSave} className="flex items-center gap-2 px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20">
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>
            </div>
            {/* Edit Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <input 
                    type="text" 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Article Title..." 
                    className="w-full text-4xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground/30"
                  />
                </div>
                
                <div className="flex flex-wrap items-center gap-4 py-4 border-y border-border/50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground w-20">Category</span>
                    <select 
                      value={editCategory} 
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary text-foreground"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  
                  <div className="w-px h-6 bg-border mx-2 hidden sm:block"></div>
                  
                  <div className="flex text-sm items-center gap-2 flex-1 min-w-[200px]">
                    <span className="text-sm font-medium text-muted-foreground"><Hash className="w-4 h-4" /></span>
                    <input 
                      type="text" 
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="Tags (comma separated)..."
                      className="bg-transparent border-none focus:outline-none flex-1 text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>

                {/* Editor Toolbar */}
                <div className="flex items-center gap-2 border border-border rounded-lg bg-surface/50 p-2 overflow-x-auto custom-scrollbar">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface rounded-md text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
                     {isUploading ? <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"/> : <ImageIcon className="w-4 h-4"/>}
                     Insert Local Media
                  </button>
                  <div className="w-px h-4 bg-border mx-2"></div>
                  <button onClick={() => setEditContent(p => p + '\n[Custom text](https://website.com)')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface rounded-md text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
                     <LinkIcon className="w-4 h-4"/> Link
                  </button>
                  <button onClick={() => setEditContent(p => p + '\nhttps://youtube.com/watch?v=...')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface rounded-md text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
                     <VideoIcon className="w-4 h-4"/> YouTube Link
                  </button>
                </div>

                <div className="flex gap-6 h-full min-h-[500px]">
                  <textarea 
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Write your documentation here using Markdown..."
                    className="w-full h-full min-h-[500px] bg-transparent resize-none focus:outline-none text-foreground leading-relaxed font-mono text-sm"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
        ) : activeArticle ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
             <div className="absolute top-0 w-full h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
             <div className="max-w-4xl mx-auto p-8 md:p-12 relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                        {activeArticle.category}
                      </span>
                      {(() => {
                        try {
                          return JSON.parse(activeArticle.tags).map((t: string) => (
                            <span key={t} className="text-xs text-muted-foreground flex items-center before:content-['#'] before:opacity-50 break-words">{t}</span>
                          ));
                        } catch { return null; }
                      })()}
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight leading-tight mb-4">{activeArticle.title}</h1>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground/80 font-medium">
                      <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {activeArticle.author}</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {new Date(activeArticle.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleEdit(activeArticle)} className="p-2 rounded-xl bg-surface border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(activeArticle.id)} className="p-2 rounded-xl bg-surface border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/5 transition-all shadow-sm">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="w-full h-px bg-border/60 my-8" />
                
                {/* Markdown Render Area */}
                <div className="prose prose-invert max-w-none text-muted-foreground pb-20">
                  {renderMarkdown(activeArticle.content) || (
                    <div className="text-center py-20 text-muted-foreground/50 flex flex-col items-center gap-3">
                      <BookOpen className="w-12 h-12 opacity-20" />
                      <p>This article has no content yet.</p>
                      <button onClick={() => handleEdit(activeArticle)} className="text-primary hover:underline text-sm font-medium mt-2">Edit Article</button>
                    </div>
                  )}
                </div>
             </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-50 relative z-10">
            <BookOpen className="w-16 h-16 text-muted-foreground mb-4 opacity-20" />
            <h2 className="text-xl font-medium text-foreground mb-2">Wiki Knowledge Base</h2>
            <p className="text-muted-foreground text-center max-w-md">Select an article from the sidebar to start reading, or create a new one to document workflows.</p>
          </div>
        )}
      </div>
    </div>
  );
}
