import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, AlertCircle, CheckCircle2, X, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME_TYPES = ["application/pdf"];

export default function PDFUpload() {
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fileName, setFileName] = useState("");
  const [projectName, setProjectName] = useState("");

  const uploadMutation = trpc.pdf.upload.useMutation();
  const pdfFilesQuery = trpc.pdf.list.useQuery();

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return "نوع الملف غير صحيح. يرجى رفع ملف PDF فقط.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return `حجم الملف كبير جداً. الحد الأقصى هو 50 MB، والملف الحالي ${(file.size / 1024 / 1024).toFixed(2)} MB.`;
    }

    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(false);
    const file = e.target.files?.[0];

    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 30;
        });
      }, 300);

      const fileKey = `pdfs/${Date.now()}-${selectedFile.name}`;
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setUploadProgress(100);
      clearInterval(progressInterval);

      await uploadMutation.mutateAsync({
        fileName: selectedFile.name,
        fileKey: fileKey,
        fileUrl: `https://example.com/${fileKey}`,
        fileSize: selectedFile.size,
        projectId: undefined,
        pageCount: undefined,
        extractedText: undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        setSelectedFile(null);
        setFileName("");
        setProjectName("");
        setUploadProgress(0);
        pdfFilesQuery.refetch();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء الرفع");
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setSelectedFile(null);
      } else {
        setSelectedFile(file);
        setFileName(file.name);
        setError(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileName("");
    setError(null);
    setUploadProgress(0);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="container py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocation("/")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">رفع ملف PDF</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Upload Card */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                رفع ملف PDF جديد
              </CardTitle>
              <CardDescription>
                اختر ملف PDF لرفعه. الحد الأقصى لحجم الملف هو 50 MB.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop Zone */}
              {!selectedFile && !success && (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent transition-colors cursor-pointer"
                  onClick={() => document.getElementById("pdf-input")?.click()}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">اسحب ملف PDF هنا أو انقر للاختيار</p>
                      <p className="text-sm text-muted-foreground">الملفات المدعومة: PDF فقط (الحد الأقصى 50 MB)</p>
                    </div>
                  </div>
                  <input
                    id="pdf-input"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}

              {/* Selected File Preview */}
              {selectedFile && !success && (
                <div className="border border-border rounded-lg p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-accent" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium truncate">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    {!isUploading && (
                      <button
                        onClick={handleRemoveFile}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Project Name Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">اسم المشروع (اختياري)</label>
                    <Input
                      placeholder="أدخل اسم المشروع أو المجلد..."
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      disabled={isUploading}
                    />
                  </div>

                  {/* Upload Progress */}
                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>جاري الرفع...</span>
                        <span>{Math.round(uploadProgress)}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}
                </div>
              )}

              {/* Success State */}
              {success && (
                <div className="border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <div className="text-left">
                      <p className="font-medium text-green-900 dark:text-green-100">تم رفع الملف بنجاح!</p>
                      <p className="text-sm text-green-800 dark:text-green-200">{selectedFile?.name}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setLocation("/");
                  }}
                  disabled={isUploading}
                >
                  العودة
                </Button>
                {!success && (
                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || isUploading}
                    className="gradient-primary text-white"
                  >
                    {isUploading ? "جاري الرفع..." : "رفع الملف"}
                  </Button>
                )}
                {success && (
                  <Button
                    onClick={() => {
                      setLocation("/");
                    }}
                  >
                    العودة إلى الرئيسية
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Uploads */}
          {pdfFilesQuery.data && pdfFilesQuery.data.length > 0 && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle>الملفات المرفوعة مؤخراً</CardTitle>
                <CardDescription>{pdfFilesQuery.data.length} ملف</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pdfFilesQuery.data.slice(0, 5).map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-accent flex-shrink-0" />
                        <div className="text-left min-w-0">
                          <p className="font-medium truncate">{file.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(file.uploadedAt).toLocaleDateString("ar-SA")}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
