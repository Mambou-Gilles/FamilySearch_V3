import { useState, useEffect, useRef } from "react";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, X, Send, Smile, Check, CheckCheck, Search } from "lucide-react";
import EmojiPicker from 'emoji-picker-react';

export default function ChatBox({ user }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [contacts, setContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef(null);

  // --- Realtime & Initial Load ---
  useEffect(() => {
    if (!user) return;
    loadContacts();

    const channel = supabase
      .channel('chat_messages_realtime')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `recipient_email=eq.${user.email}` 
      }, (payload) => {
        // Only update message list if the message is from the currently selected contact
        if (selectedContact && payload.new.sender_email === selectedContact.user_email) {
          setMessages(prev => [...prev, payload.new]);
        }
        if (!open || (selectedContact && payload.new.sender_email !== selectedContact.user_email)) {
          setUnread(u => u + 1);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages'
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, open, selectedContact]);

  useEffect(() => {
    if (open && selectedContact) {
      // 1. Mark these specific messages as read in the database
      const markAsRead = async () => {
        const { error } = await supabase
          .from('chat_messages')
          .update({ read: true })
          .eq('sender_email', selectedContact.user_email)
          .eq('recipient_email', user.email)
          .eq('read', false);

        if (!error) {
          // 2. Update local state so the UI updates instantly
          setMessages(prev => prev.map(m => 
            (m.sender_email === selectedContact.user_email) ? { ...m, read: true } : m
          ));
        }
      };

      markAsRead();
      loadMessages();
    }
  }, [open, selectedContact]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Contact & Message Logic ---
  function getAllowedContactRoles(myRole) {
    switch (myRole) {
      case "admin": return ["manager"]; // Admin -> Managers only
      case "manager": return ["team_lead", "reviewer", "contributor", "admin"];
      case "team_lead": return ["manager", "reviewer", "contributor"];
      case "reviewer": return ["manager", "team_lead", "contributor"];
      case "contributor": return ["manager", "team_lead", "reviewer"];
      case "client": return ["admin", "manager"];
      default: return [];
    }
  }

  async function loadContacts() {
    try {
      // 1. Get MY assignment
      const { data: myAssigns } = await supabase
        .from('team_assignments')
        .select('*')
        .eq('user_email', user.email)
        .eq('status', 'active');

      if (!myAssigns?.length) return;
      const myAsgn = myAssigns[0];
      const { project_id, geography, role, reviewer_email, team_lead_email } = myAsgn;

      // 2. NEW: Fetch anyone who has ever sent ME a message
      // This handles the "Leader reached out first" rule
      const { data: recentMessages } = await supabase
        .from('chat_messages')
        .select('sender_email')
        .eq('recipient_email', user.email);
      
      // Create a Set of unique emails for fast lookup
      const whoReachedOut = new Set(recentMessages?.map(m => m.sender_email) || []);

      // 3. Get ALL active people in this project/geo
      const { data: others } = await supabase
        .from('team_assignments')
        .select('*')
        .eq('project_id', project_id)
        .eq('geography', geography)
        .eq('status', 'active')
        .neq('user_email', user.email);

      const allowedRoles = getAllowedContactRoles(role);

      // 4. THE FILTER: This is where 'isVisible' logic lives
      const filtered = others?.filter(person => {
        // Rule 1: Always hide if role isn't theoretically allowed
        if (!allowedRoles.includes(person.role)) return false;

        // Rule 2: If this person has messaged me, they are ALWAYS visible
        if (whoReachedOut.has(person.user_email)) return true;

        // Rule 3: Hierarchy Visibility (The "Standard" Flow)
        if (role === "contributor") {
          return (
            person.user_email === reviewer_email || 
            person.user_email === team_lead_email || 
            person.role === "manager"
          );
        }

        if (role === "reviewer") {
          return (
            person.reviewer_email === user.email || // My assigned contributors
            person.user_email === team_lead_email || 
            person.role === "manager"
          );
        }

        if (role === "team_lead") {
          return (
            person.team_lead_email === user.email || // My assigned team
            person.role === "manager"
          );
        }

        if (role === "manager") return true; // Sees everyone in Project/Geo

        if (role === "admin") return person.role === "manager";

        return false;
      }) || [];
      
      setContacts(filtered);
      
      // Auto-select the first person if nothing is selected yet
      if (filtered.length && !selectedContact) {
        setSelectedContact(filtered[0]);
      }
    } catch (e) { 
      console.error("Chat Error:", e); 
    }
  }

  async function loadMessages() {
    if (!selectedContact || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`sender_email.eq.${user.email},recipient_email.eq.${user.email}`)
        .order('created_date', { ascending: true });

      if (error) throw error;

      const conversation = data.filter(m => 
        (m.sender_email === user.email && m.recipient_email === selectedContact.user_email) ||
        (m.sender_email === selectedContact.user_email && m.recipient_email === user.email)
      );

      setMessages(conversation);

      const unreadIds = conversation
        .filter(m => m.recipient_email === user.email && !m.read)
        .map(m => m.id);

      if (unreadIds.length > 0) {
        await supabase.from('chat_messages').update({ read: true }).in('id', unreadIds);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function sendMessage() {
    if (!text.trim() || !selectedContact) return;
    const msgContent = text;
    setText("");
    setShowEmoji(false);

    const { data, error } = await supabase.from('chat_messages').insert({
      sender_email: user.email,
      sender_name: user.user_metadata?.full_name || user.email,
      recipient_email: selectedContact.user_email,
      recipient_name: selectedContact.user_name,
      message: msgContent,
      read: false
    }).select();

    if (!error && data) {
      setMessages(prev => [...prev, data[0]]);
    }
  }

  // --- Formatting & Filter ---
  const filteredContacts = contacts.filter(c => 
    c.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.user_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDividerDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 border-2 border-white rounded-full text-[10px] flex items-center justify-center font-bold">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] bg-[#e5ddd5] rounded-xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4" style={{ height: 580 }}>
          {/* Header */}
          <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-[#075e54] font-bold shrink-0">
              {selectedContact?.user_name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight truncate">{selectedContact?.user_name || "Select Chat"}</p>
              <p className="text-[10px] opacity-80 uppercase tracking-tighter">{selectedContact?.role}</p>
            </div>
            <button onClick={() => setOpen(false)} className="hover:bg-white/10 p-1 rounded"><X className="w-5 h-5" /></button>
          </div>

          {/* Search & Selection Bar */}
          <div className="bg-[#f0f2f5] px-3 py-2 border-b border-slate-200 shrink-0 space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search contact name..."
                className="h-8 text-xs bg-white border-none shadow-sm pl-8 focus-visible:ring-1 focus-visible:ring-[#075e54]"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-2 top-2.5">
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>

            <Select 
              value={selectedContact?.user_email || ""} 
              onValueChange={v => {
                const contact = contacts.find(c => c.user_email === v);
                setSelectedContact(contact);
                setSearchTerm(""); // Optional: Clear search after selection
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-white border-none shadow-sm">
                {/* FIX: We explicitly set the text here so even if the list is filtered, 
                    the name of the person you are currently talking to stays visible.
                */}
                <span className="truncate">
                  {selectedContact ? `${selectedContact.user_name}` : "Select a contact"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {filteredContacts.length > 0 ? (
                  filteredContacts.map(c => {
                    // Check if there are any unread messages from THIS specific contact
                    const hasUnread = messages.some(m => 
                      m.sender_email === c.user_email && 
                      m.recipient_email === user.email && 
                      !m.read
                    );

                    return (
                      <SelectItem key={c.user_email} value={c.user_email}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="flex items-center gap-2">
                            {c.user_name}
                            {hasUnread && (
                              <span className="w-2 h-2 bg-[#25D366] rounded-full animate-pulse" />
                            )}
                          </span>
                          <span className="text-[10px] opacity-50">({c.role})</span>
                        </div>
                      </SelectItem>
                    );
                  })
                ) : (
                  <div className="p-2 text-[10px] text-center text-slate-500">No contacts found</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1 relative scroll-smooth" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: 'contain' }}>
            {messages.map((m, i) => {
              const isMine = m.sender_email === user.email;
              const dateTag = formatDividerDate(m.created_date);
              const showDivider = i === 0 || formatDividerDate(messages[i-1].created_date) !== dateTag;

              return (
                <div key={m.id} className="flex flex-col">
                  {showDivider && (
                    <div className="flex justify-center my-3">
                      <span className="bg-[#d1d7db] text-[#54656f] text-[11px] px-2.5 py-1 rounded-md shadow-sm uppercase font-semibold">
                        {dateTag}
                      </span>
                    </div>
                  )}
                  <div className={`flex w-full mb-1 ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`relative max-w-[85%] px-3 py-1.5 shadow-sm text-[13px] ${
                      isMine ? "bg-[#d9fdd3] rounded-l-lg rounded-tr-lg" : "bg-white rounded-r-lg rounded-tl-lg"
                    }`}>
                      <p className="text-[#111b21] leading-normal pr-10 whitespace-pre-wrap">{m.message}</p>
                      <div className="absolute bottom-1 right-1.5 flex items-center gap-1">
                        <span className="text-[9px] text-[#667781] uppercase">
                          {new Date(m.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                        {isMine && (
                          m.read ? <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" /> : <Check className="w-3.5 h-3.5 text-[#667781]" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input Footer */}
          <div className="bg-[#f0f2f5] p-2 flex items-center gap-2 relative shrink-0">
            {showEmoji && (
              <div className="absolute bottom-full left-0 z-[100] mb-2 shadow-2xl">
                <EmojiPicker onEmojiClick={(e) => setText(t => t + e.emoji)} width={320} height={400} />
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={() => setShowEmoji(!showEmoji)} className="text-[#54656f] hover:bg-transparent shrink-0">
              <Smile className="w-6 h-6" />
            </Button>
            <Input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Type a message"
              className="flex-1 bg-white border-none rounded-lg h-10 shadow-sm focus-visible:ring-0 text-sm"
            />
            <Button 
              onClick={sendMessage} 
              disabled={!text.trim() || !selectedContact}
              className="bg-[#00a884] hover:bg-[#008f72] rounded-full w-10 h-10 p-0 shrink-0 shadow-sm"
            >
              <Send className="w-5 h-5 text-white" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}