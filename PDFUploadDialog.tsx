import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, AlertCircle, CheckCircle2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";


export interface PDFUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess?: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME_TYPES = ["application/pdf"];

export function PDFUploadDialog({ open, onOpenChange, onUploadSuccess }: PDFUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fileName, setFileName] = useState("");

  const uploadMutation = trpc.pdf.upload.useMutation();

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return "نوع الملف غير صحيح. يرجى رفع ملف PDF فقط.";
    }

    // Check file size
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
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 30;
        });
      }, 300);

      // Upload file to S3
      const fileKey = `pdfs/${Date.now()}-${selectedFile.name}`;
      const fileBuffer = await selectedFile.arrayBuffer();

      // In a real scenario, this would call your backend API
      // For now, we'll simulate the upload
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setUploadProgress(100);
      clearInterval(progressInterval);

      // Save to database via tRPC
      await uploadMutation.mutateAsync({
        fileName: selectedFile.name,
        fileKey: fileKey,
        fileUrl: `https://example.com/${fileKey}`, // This would be the S3 URL
        fileSize: selectedFile.size,
        projectId: undefined,
        pageCount: undefined,
        extractedText: undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        setSelectedFile(null);
        setFileName("");
        setUploadProgress(0);
        onOpenChange(false);
        onUploadSuccess?.();
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            رفع ملف PDF
          </DialogTitle>
          <DialogDescription>
            اختر ملف PDF لرفعه. الحد الأقصى لحجم الملف هو 50 MB.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          {!selectedFile && !success && (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
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
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Selected File Preview */}
          {selectedFile && !success && (
            <div className="border border-border rounded-lg p-4 space-y-3">
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
            <div className="border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium text-green-900 dark:text-green-100">تم رفع الملف بنجاح!</p>
                <p className="text-sm text-green-800 dark:text-green-200">{selectedFile?.name}</p>
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
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                handleRemoveFile();
              }}
              disabled={isUploading}
            >
              إلغاء
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
                  onOpenChange(false);
                  handleRemoveFile();
                }}
              >
                إغلاق
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
