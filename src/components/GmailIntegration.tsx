'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { 
  Card, 
  Title, 
  Text, 
  Button, 
  TextInput,
  Textarea,
  Grid,
  Col,
  Divider,
  List,
  ListItem,
  Badge,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  Metric,
  ProgressBar,
  Select,
  SelectItem,
  DateRangePicker,
  BarChart,
  DonutChart
} from '@tremor/react';
import { toast } from 'react-toastify';
import { 
  XCircleIcon, 
  CheckCircleIcon, 
  EnvelopeIcon, 
  MagnifyingGlassIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  InboxIcon,
  PaperAirplaneIcon,
  TrashIcon,
  ArrowPathIcon,
  StarIcon,
  EyeIcon,
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  CalendarIcon,
  TagIcon,
  FunnelIcon,
  AdjustmentsHorizontalIcon,
  ClockIcon,
  BookmarkIcon,
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  XMarkIcon,
  MinusIcon,
  PaperClipIcon,
  DocumentIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface GmailMessage {
  id: string;
  subject: string;
  sender: string;
  date: string;
  snippet: string;
  read?: boolean;
  starred?: boolean;
  labels?: string[];
  category?: 'primary' | 'social' | 'promotions' | 'updates';
}

interface EmailStats {
  total: number;
  unread: number;
  starred: number;
  sent: number;
  category: {
    primary: number;
    social: number;
    promotions: number;
    updates: number;
  };
}

export default function GmailIntegration() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState(0);
  
  // Compose email state
  const [sendToEmail, setSendToEmail] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [ccEmail, setCcEmail] = useState<string>('');
  const [bccEmail, setBccEmail] = useState<string>('');
  const [showCcBcc, setShowCcBcc] = useState<boolean>(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  
  // View message state
  const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null);
  const [viewMessageMode, setViewMessageMode] = useState<boolean>(false);
  
  // Email templates
  const emailTemplates = [
    { name: "Meeting Request", subject: "Request for Meeting", body: "Dear recipient,\n\nI hope this email finds you well. I would like to schedule a meeting to discuss [topic]. Would you be available on [date] at [time]?\n\nBest regards,\n[Your Name]" },
    { name: "Thank You", subject: "Thank You", body: "Dear recipient,\n\nI wanted to express my sincere gratitude for [reason]. Your support/contribution has been invaluable.\n\nBest regards,\n[Your Name]" },
    { name: "Project Update", subject: "Project Update: [Project Name]", body: "Hello team,\n\nI'm writing to provide an update on our project status:\n\n- Task 1: [status]\n- Task 2: [status]\n- Task 3: [status]\n\nNext steps:\n1. [Next step 1]\n2. [Next step 2]\n\nPlease let me know if you have any questions.\n\nRegards,\n[Your Name]" }
  ];

  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [selectedDateRange, setSelectedDateRange] = useState<any>(null);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);
  const [scheduledEmails, setScheduledEmails] = useState<any[]>([]);
  const [emailStats, setEmailStats] = useState<EmailStats>({
    total: 0,
    unread: 0,
    starred: 0,
    sent: 0,
    category: {
      primary: 0,
      social: 0,
      promotions: 0,
      updates: 0
    }
  });

  // Email categories for filtering
  const categories = [
    { name: 'Primary', value: 'primary', icon: InboxIcon },
    { name: 'Social', value: 'social', icon: FolderIcon },
    { name: 'Promotions', value: 'promotions', icon: TagIcon },
    { name: 'Updates', value: 'updates', icon: ArchiveBoxIcon }
  ];

  // Advanced search options
  const searchFilters = {
    from: '',
    to: '',
    subject: '',
    hasAttachment: false,
    dateRange: null,
    labels: []
  };

  // Calculate email statistics
  const calculateStats = (messages: GmailMessage[]) => {
    const stats: EmailStats = {
      total: messages.length,
      unread: messages.filter(m => !m.read).length,
      starred: messages.filter(m => m.starred).length,
      sent: 0, // You would need to track sent emails separately
      category: {
        primary: messages.filter(m => m.category === 'primary').length,
        social: messages.filter(m => m.category === 'social').length,
        promotions: messages.filter(m => m.category === 'promotions').length,
        updates: messages.filter(m => m.category === 'updates').length
      }
    };
    setEmailStats(stats);
  };

  // Schedule email for later
  const scheduleEmail = (email: any, scheduledTime: Date) => {
    setScheduledEmails([...scheduledEmails, { ...email, scheduledTime }]);
    toast.success('Email scheduled successfully');
  };

  // Analytics data
  const emailChartData = [
    { category: 'Primary', value: emailStats.category.primary },
    { category: 'Social', value: emailStats.category.social },
    { category: 'Promotions', value: emailStats.category.promotions },
    { category: 'Updates', value: emailStats.category.updates }
  ];

  // New state for compose email
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const [replyTo, setReplyTo] = useState<GmailMessage | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [editorContent, setEditorContent] = useState<string>('');
  const editorRef = useRef<HTMLDivElement>(null);

  // Custom editor commands
  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      setEditorContent(content);
    }
  };

  // Enhanced email sending function
  const handleSendEmail = async () => {
    try {
      setSendingEmail(true);
      
      const formData = new FormData();
      formData.append('to', sendToEmail);
      formData.append('subject', emailSubject);
      formData.append('body', editorContent);
      
      if (ccEmail) formData.append('cc', ccEmail);
      if (bccEmail) formData.append('bcc', bccEmail);
      
      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      await axios.post('/api/gmail/send', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Email sent successfully!');
      resetComposeForm();
    } catch (error) {
      toast.error('Failed to send email. Please try again.');
      console.error('Send email error:', error);
    } finally {
      setSendingEmail(false);
    }
  };

  const resetComposeForm = () => {
    setSendToEmail('');
    setEmailSubject('');
    setEditorContent('');
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    setCcEmail('');
    setBccEmail('');
    setAttachments([]);
    setIsComposing(false);
    setReplyTo(null);
  };

  const handleReply = (message: GmailMessage) => {
    setIsComposing(true);
    setReplyTo(message);
    setSendToEmail(message.sender);
    setEmailSubject(`Re: ${message.subject}`);
    setEditorContent(`\n\n\nOn ${message.date}, ${message.sender} wrote:\n> ${message.snippet}`);
  };

  const handleForward = (message: GmailMessage) => {
    setIsComposing(true);
    setEmailSubject(`Fwd: ${message.subject}`);
    setEditorContent(`\n\n\n---------- Forwarded message ----------\nFrom: ${message.sender}\nDate: ${message.date}\nSubject: ${message.subject}\n\n${message.snippet}`);
  };

  // Simplified Message List component
  const MessageList = ({ messages }: { messages: GmailMessage[] }) => (
    <div className="space-y-2">
      {messages.map((message, index) => (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card 
            className={`transition-all duration-200 hover:shadow-md ${
              !message.read ? 'border-l-4 border-l-blue-500' : ''
            }`}
          >
            <div className="flex items-start gap-4">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStar(message.id);
                }}
                className={`mt-1 p-1 rounded-full hover:bg-gray-100 ${
                  message.starred ? 'text-amber-500' : 'text-gray-400'
                }`}
              >
                <StarIcon className="w-5 h-5" />
              </button>
              
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <Text className="font-medium truncate">{message.sender}</Text>
                  <Text className="text-sm text-gray-500">
                    {new Date(message.date).toLocaleDateString()}
                  </Text>
                </div>
                
                <Text className="text-gray-900 truncate mb-1">
                  {message.subject}
                </Text>
                
                <Text className="text-sm text-gray-600 line-clamp-2">
                  {message.snippet}
                </Text>

                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="xs"
                    variant="light"
                    icon={ArrowUturnLeftIcon}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReply(message);
                    }}
                  >
                    Reply
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    icon={ArrowUturnRightIcon}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleForward(message);
                    }}
                  >
                    Forward
                  </Button>
                  <div className="flex-grow" />
                  {message.category && (
                    <Badge 
                      color="gray" 
                      size="xs"
                      className="capitalize"
                    >
                      {message.category}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );

  // Compose Email Modal
  const ComposeEmailModal = () => {
    const formatButtons = [
      { icon: 'B', command: 'bold', tooltip: 'Bold' },
      { icon: 'I', command: 'italic', tooltip: 'Italic' },
      { icon: 'U', command: 'underline', tooltip: 'Underline' },
      { icon: '•', command: 'insertUnorderedList', tooltip: 'Bullet List' },
      { icon: '1.', command: 'insertOrderedList', tooltip: 'Numbered List' },
      { icon: 'H1', command: 'formatBlock', value: 'h1', tooltip: 'Heading 1' },
      { icon: 'H2', command: 'formatBlock', value: 'h2', tooltip: 'Heading 2' },
      { icon: '""', command: 'formatBlock', value: 'blockquote', tooltip: 'Quote' },
    ];

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-white/5 backdrop-blur-sm p-4"
      >
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="w-full max-w-3xl bg-white rounded-t-lg sm:rounded-lg shadow-2xl flex flex-col relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <Text className="font-medium">
              {replyTo ? 'Reply to Email' : 'New Message'}
            </Text>
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant="light"
                icon={MinusIcon}
                onClick={() => {/* Implement minimize */}}
                className="text-gray-600"
              />
              <Button
                size="xs"
                variant="light"
                icon={XMarkIcon}
                onClick={resetComposeForm}
                className="text-gray-600"
              />
            </div>
          </div>

          {/* Email Form */}
          <div className="flex-grow overflow-y-auto">
            {/* Recipients Section */}
            <div className="border-b divide-y">
              <div className="px-4 py-2 flex items-center">
                <Text className="w-16 text-sm text-gray-600">To:</Text>
                <TextInput
                  value={sendToEmail}
                  onChange={(e) => setSendToEmail(e.target.value)}
                  placeholder="Recipients"
                  className="border-none shadow-none focus:ring-0"
                />
              </div>

              {showCcBcc && (
                <>
                  <div className="px-4 py-2 flex items-center">
                    <Text className="w-16 text-sm text-gray-600">Cc:</Text>
                    <TextInput
                      value={ccEmail}
                      onChange={(e) => setCcEmail(e.target.value)}
                      placeholder="Carbon copy"
                      className="border-none shadow-none focus:ring-0"
                    />
                  </div>
                  <div className="px-4 py-2 flex items-center">
                    <Text className="w-16 text-sm text-gray-600">Bcc:</Text>
                    <TextInput
                      value={bccEmail}
                      onChange={(e) => setBccEmail(e.target.value)}
                      placeholder="Blind carbon copy"
                      className="border-none shadow-none focus:ring-0"
                    />
                  </div>
                </>
              )}

              <div className="px-4 py-2 flex items-center">
                <Text className="w-16 text-sm text-gray-600">Subject:</Text>
                <TextInput
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Subject"
                  className="border-none shadow-none focus:ring-0"
                />
              </div>
            </div>

            {/* Formatting Toolbar */}
            <div className="px-4 py-2 border-b bg-gray-50">
              <div className="flex flex-wrap items-center gap-1">
                {formatButtons.map((button) => (
                  <button
                    key={button.command + (button.value || '')}
                    onClick={() => execCommand(button.command, button.value)}
                    className="p-2 rounded hover:bg-gray-200 transition-colors"
                    title={button.tooltip}
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {button.icon}
                    </span>
                  </button>
                ))}
                
                <div className="h-5 w-px bg-gray-300 mx-2" />
                
                <Button
                  size="xs"
                  variant="light"
                  icon={PaperClipIcon}
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="text-gray-700"
                >
                  Attach
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  onChange={(e) => setAttachments(Array.from(e.target.files || []))}
                  className="hidden"
                />
              </div>
            </div>

            {/* Editor */}
            <div
              ref={editorRef}
              className="p-4 min-h-[300px] focus:outline-none"
              contentEditable
              onInput={(e) => setEditorContent(e.currentTarget.innerHTML)}
              dangerouslySetInnerHTML={replyTo ? {
                __html: `\n\n\nOn ${replyTo.date}, ${replyTo.sender} wrote:\n> ${replyTo.snippet}`
              } : undefined}
            />

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="px-4 py-3 border-t bg-gray-50">
                <Text className="text-sm text-gray-600 mb-2">
                  Attachments ({attachments.length})
                </Text>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border"
                    >
                      <DocumentIcon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm truncate max-w-[200px]">
                        {file.name}
                      </span>
                      <button
                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                icon={PaperAirplaneIcon}
                loading={sendingEmail}
                onClick={handleSendEmail}
                disabled={!sendToEmail || !emailSubject || !editorContent.trim()}
              >
                Send
              </Button>
              
              {!showCcBcc && (
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => setShowCcBcc(true)}
                  className="text-gray-600"
                >
                  Cc/Bcc
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Select
                value=""
                onValueChange={(value) => {
                  const template = emailTemplates.find(t => t.name === value);
                  if (template) {
                    setEmailSubject(template.subject);
                    if (editorRef.current) {
                      editorRef.current.innerHTML = template.body;
                      setEditorContent(template.body);
                    }
                  }
                }}
                className="w-40"
              >
                <SelectItem value="">
                  Templates
                </SelectItem>
                {emailTemplates.map((template) => (
                  <SelectItem key={template.name} value={template.name}>
                    {template.name}
                  </SelectItem>
                ))}
              </Select>
              
              <Button
                variant="light"
                icon={TrashIcon}
                onClick={resetComposeForm}
                className="text-gray-600"
              >
                Discard
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  // Check Gmail authentication status
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Check for error parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        if (error) {
          toast.error(`Authentication failed: ${error}`);
          setLoading(false);
          return;
        }

        const response = await axios.get('/mcp/gmail/status');
        setIsAuthenticated(response.data.authenticated);
        if (response.data.authenticated && response.data.email) {
          setUserEmail(response.data.email);
          fetchMessages();
          toast.success('Gmail connected successfully!');
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to check Gmail authentication status:', error);
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Fetch Gmail messages
  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/mcp/gmail/messages');
      
      // Add some mock properties for better UI demo
      const messagesWithStatus = (response.data.messages || []).map((msg: GmailMessage, index: number) => ({
        ...msg,
        read: index % 3 !== 0, // Mark every third message as unread for demo
        starred: index % 5 === 0 // Star every fifth message for demo
      }));
      
      setMessages(messagesWithStatus);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch Gmail messages:', error);
      toast.error('Failed to fetch Gmail messages');
      setLoading(false);
    }
  };

  // Authenticate with Gmail
  const handleAuthenticate = () => {
    window.location.href = '/mcp/gmail/auth';
  };
  
  // Handle search
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      return;
    }
    
    setSearchLoading(true);
    // Simulate search with delay
    setTimeout(() => {
      const filtered = messages.filter(msg => 
        msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
        msg.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.sender.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setMessages(filtered);
      setSearchLoading(false);
    }, 800);
  };
  
  // Reset search and fetch all messages again
  const resetSearch = () => {
    setSearchQuery('');
    fetchMessages();
  };
  
  // Apply email template
  const applyTemplate = (template: {subject: string, body: string}) => {
    setEmailSubject(template.subject);
    setEmailBody(template.body);
  };
  
  // Toggle star status
  const toggleStar = (messageId: string) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? {...msg, starred: !msg.starred} : msg
      )
    );
    toast.success('Message starred');
  };
  
  // Mark as read/unread
  const toggleRead = (messageId: string) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? {...msg, read: !msg.read} : msg
      )
    );
    toast.success('Message status updated');
  };
  
  // View message details
  const viewMessage = (message: GmailMessage) => {
    setSelectedMessage(message);
    setViewMessageMode(true);
    
    // Mark as read
    setMessages(prev => 
      prev.map(msg => 
        msg.id === message.id ? {...msg, read: true} : msg
      )
    );
  };
  
  // Back to message list
  const backToList = () => {
    setViewMessageMode(false);
    setSelectedMessage(null);
  };
  
  // Get unread count
  const unreadCount = useMemo(() => {
    return messages.filter(msg => !msg.read).length;
  }, [messages]);

  // Render unread badge
  const renderUnreadBadge = (count: number) => {
    if (count === 0) return null;
    return <Badge color="red" size="xs">{count}</Badge>;
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {!isAuthenticated ? (
        <Card className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="bg-blue-50 p-4 rounded-full mb-6">
              <EnvelopeIcon className="w-12 h-12 text-blue-500" />
          </div>
            <Title className="mb-2">Connect Gmail</Title>
            <Text className="mb-6 max-w-md text-gray-600">
              Connect your Gmail account to manage your emails directly within the application.
            </Text>
          <Button 
            size="lg" 
              variant="primary"
              onClick={handleAuthenticate}
            icon={EnvelopeIcon}
          >
              Connect Account
          </Button>
        </div>
        </Card>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <EnvelopeIcon className="w-6 h-6 text-blue-500" />
        <div>
                <Title className="text-xl">Gmail</Title>
                <Text className="text-sm text-gray-600">{userEmail}</Text>
              </div>
            </div>
              <Button
              variant="primary"
              icon={PaperAirplaneIcon}
              onClick={() => setIsComposing(true)}
            >
              Compose
              </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card 
              decoration="top" 
              decorationColor="blue"
              className="relative overflow-hidden"
            >
              <div className="flex items-center gap-4">
                <div className="flex-grow">
                  <Text>Total Emails</Text>
                  <Metric>{emailStats.total}</Metric>
                        </div>
                <InboxIcon className="w-12 h-12 text-blue-100" />
                        </div>
              {emailStats.total > 0 && (
                <ProgressBar 
                  value={emailStats.unread / emailStats.total * 100}
                  className="mt-3"
                />
              )}
                        <Text className="text-sm text-gray-500 mt-1">
                {emailStats.unread} unread
                        </Text>
            </Card>

            <Card 
              decoration="top" 
              decorationColor="amber"
            >
              <div className="flex items-center gap-4">
                <div className="flex-grow">
                  <Text>Starred</Text>
                  <Metric>{emailStats.starred}</Metric>
                </div>
                <StarIcon className="w-12 h-12 text-amber-100" />
                      </div>
            </Card>

            <Card 
              decoration="top" 
              decorationColor="green"
            >
              <div className="flex items-center gap-4">
                <div className="flex-grow">
                  <Text>Sent</Text>
                  <Metric>{emailStats.sent}</Metric>
                              </div>
                <PaperAirplaneIcon className="w-12 h-12 text-green-100" />
                                  </div>
            </Card>
                            </div>

          {/* Main Content */}
          <Card>
            <TabGroup>
              <TabList className="mb-4">
                <Tab className="relative">
                  Inbox
                  {emailStats.unread > 0 && (
                    <Badge 
                      color="red" 
                      size="xs"
                      className="absolute -top-1 -right-1"
                    >
                      {emailStats.unread}
                    </Badge>
                  )}
                </Tab>
                <Tab>Sent</Tab>
                <Tab>Starred</Tab>
                <Tab>Analytics</Tab>
              </TabList>

              <div className="mb-4">
                <div className="flex gap-2">
                      <TextInput
                    icon={MagnifyingGlassIcon}
                    placeholder="Search emails..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-grow"
                  />
                        <Select 
                    placeholder="Category"
                    className="w-40"
                  >
                    {categories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.name}
                            </SelectItem>
                          ))}
                        </Select>
                      </div>
                </div>
              
              <TabPanels>
              <TabPanel>
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                        <Text>Loading your emails...</Text>
                      </div>
                                </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-12">
                      <InboxIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <Text>No emails found</Text>
                                  </div>
                  ) : (
                    <MessageList messages={messages} />
                )}
              </TabPanel>
                {/* Other tab panels remain the same */}
            </TabPanels>
          </TabGroup>
          </Card>
        </>
      )}

      {isComposing && <ComposeEmailModal />}
    </div>
  );
} 