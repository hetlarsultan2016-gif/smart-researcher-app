import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, MessageSquare, FileText, Plus, ArrowLeft } from "lucide-react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Streamdown } from 'streamdown';
import { useLocation } from "wouter";

/**
 * Home page - Landing page and main dashboard for Smart Researcher PRO
 */
export default function Home() {
  const { user, loading, error, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("chat");
  const [newConversationTitle, setNewConversationTitle] = useState("");
  const [currentMessage, setCurrentMessage] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);

  // Queries
  const conversationsQuery = trpc.conversation.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const messagesQuery = trpc.message.list.useQuery(selectedConversation || 0, {
    enabled: isAuthenticated && selectedConversation !== null,
  });
  const pdfFilesQuery = trpc.pdf.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const statsQuery = trpc.stats.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Mutations
  const createConversationMutation = trpc.conversation.create.useMutation();
  const sendMessageMutation = trpc.message.send.useMutation();

  const handleCreateConversation = async () => {
    if (!newConversationTitle.trim()) return;
    try {
      await createConversationMutation.mutateAsync({
        title: newConversationTitle,
        description: undefined,
        projectId: undefined,
        relatedPdfIds: undefined,
      });
      setNewConversationTitle("");
      conversationsQuery.refetch();
    } catch (err) {
      console.error("Failed to create conversation", err);
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedConversation) return;
    try {
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConversation,
        content: currentMessage,
        tokens: 0,
      });
      setCurrentMessage("");
      messagesQuery.refetch();
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
        <header className="border-b border-border">
          <div className="container py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold">الباحث الذكي PRO</h1>
            </div>
            <Button onClick={() => window.location.href = getLoginUrl()}>
              تسجيل الدخول
            </Button>
          </div>
        </header>

        <section className="container py-20">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              منصة ذكية لإدارة ملفات PDF والمحادثة مع الذكاء الاصطناعي
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              رفع ملفات PDF، طرح الأسئلة، والحصول على إجابات ذكية فورية باستخدام أحدث تقنيات الذكاء الاصطناعي
            </p>
            <Button size="lg" onClick={() => window.location.href = getLoginUrl()} className="gradient-primary text-white">
              ابدأ الآن مجاناً
            </Button>
          </div>
        </section>

        <section className="container py-16">
          <h3 className="text-3xl font-bold text-center mb-12">المميزات الرئيسية</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Upload,
                title: "رفع ملفات PDF",
                description: "رفع ملفات PDF بسهولة وتخزينها بأمان في السحابة",
              },
              {
                icon: MessageSquare,
                title: "محادثة ذكية",
                description: "اطرح أسئلة واحصل على إجابات دقيقة من محتوى ملفاتك",
              },
              {
                icon: FileText,
                title: "تحليل متقدم",
                description: "تحليل ذكي لمحتوى الملفات باستخدام تقنيات LLM",
              },
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <Card key={idx} className="border-border hover:border-accent transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-accent" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  // Authenticated view
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="container py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold">الباحث الذكي PRO</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.name}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              المحادثات
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              الملفات
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              الإحصائيات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="md:col-span-1 border-border">
                <CardHeader>
                  <CardTitle className="text-lg">المحادثات</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="عنوان جديد"
                      value={newConversationTitle}
                      onChange={(e) => setNewConversationTitle(e.target.value)}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={handleCreateConversation}
                      disabled={createConversationMutation.isPending}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {conversationsQuery.data?.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv.id)}
                        className={`w-full text-right p-2 rounded-lg transition-colors ${
                          selectedConversation === conv.id
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        <p className="text-sm font-medium truncate">{conv.title}</p>
                        <p className="text-xs opacity-75">{conv.messageCount} رسالة</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-3 border-border flex flex-col">
                <CardHeader>
                  <CardTitle>
                    {selectedConversation
                      ? conversationsQuery.data?.find((c) => c.id === selectedConversation)?.title
                      : "اختر محادثة"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  {selectedConversation ? (
                    <>
                      <div className="flex-1 overflow-y-auto mb-4 space-y-3 max-h-96">
                        {messagesQuery.data?.map((msg) => (
                          <div
                            key={msg.id}
                            className={`chat-message ${
                              msg.role === "user" ? "user" : "assistant"
                            }`}
                          >
                            {msg.role === "assistant" ? (
                              <Streamdown>{msg.content}</Streamdown>
                            ) : (
                              <p>{msg.content}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Input
                          placeholder="اكتب سؤالك هنا..."
                          value={currentMessage}
                          onChange={(e) => setCurrentMessage(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                        />
                        <Button
                          onClick={handleSendMessage}
                          disabled={sendMessageMutation.isPending || !currentMessage.trim()}
                        >
                          {sendMessageMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "إرسال"
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      اختر محادثة لبدء الدردشة
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="files">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>ملفات PDF المرفوعة</CardTitle>
                  <CardDescription>
                    {pdfFilesQuery.data?.length || 0} ملف
                  </CardDescription>
                </div>
                <Button onClick={() => setLocation("/upload-pdf")} className="gradient-primary text-white">
                  <Upload className="w-4 h-4 ml-2" />
                  رفع ملف جديد
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pdfFilesQuery.data?.map((file) => (
                    <div key={file.id} className="pdf-card">
                      <div className="flex items-start justify-between mb-2">
                        <FileText className="w-6 h-6 text-accent" />
                        <span className="text-xs bg-muted px-2 py-1 rounded">
                          {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      <h3 className="font-medium truncate">{file.fileName}</h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(file.uploadedAt).toLocaleDateString("ar-SA")}
                      </p>
                    </div>
                  ))}
                </div>
                {(!pdfFilesQuery.data || pdfFilesQuery.data.length === 0) && (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground mb-4">لم تقم برفع أي ملفات بعد</p>
                    <Button onClick={() => setLocation("/upload-pdf")} className="gradient-primary text-white">
                      <Upload className="w-4 h-4 ml-2" />
                      رفع ملف PDF الآن
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "إجمالي الملفات",
                  value: statsQuery.data?.totalFiles || 0,
                },
                {
                  label: "المحادثات",
                  value: statsQuery.data?.totalConversations || 0,
                },
                {
                  label: "الرسائل",
                  value: statsQuery.data?.totalMessages || 0,
                },
                {
                  label: "التخزين المستخدم",
                  value: `${((statsQuery.data?.totalStorageUsed || 0) / 1024 / 1024).toFixed(2)} MB`,
                },
              ].map((stat, idx) => (
                <Card key={idx} className="border-border">
                  <CardHeader>
                    <CardDescription>{stat.label}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-accent">{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
