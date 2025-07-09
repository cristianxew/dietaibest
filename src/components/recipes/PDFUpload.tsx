"use client";

import React, { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ExtractedRecipeData {
  title: string;
  description?: string;
  ingredients: Array<{
    name: string;
    amount: number;
    unit: string;
  }>;
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
}

interface PDFUploadProps {
  onPDFUploaded?: (pdfData: {
    file: File;
    extractedData?: ExtractedRecipeData;
  }) => void;
  onUploadError?: (error: string) => void;
  maxFileSize?: number; // in MB
  maxPages?: number;
  disabled?: boolean;
}

interface UploadState {
  status:
    | "idle"
    | "validating"
    | "uploading"
    | "processing"
    | "analyzing"
    | "success"
    | "error";
  progress: number;
  message: string;
  file?: File;
}

const SUPPORTED_FORMATS = ["application/pdf"];
const DEFAULT_MAX_SIZE = 20; // 20MB
const DEFAULT_MAX_PAGES = 15; // Document AI limit

export function PDFUpload({
  onPDFUploaded,
  onUploadError,
  maxFileSize = DEFAULT_MAX_SIZE,
  maxPages = DEFAULT_MAX_PAGES,
  disabled = false,
}: PDFUploadProps) {
  const t = useTranslations("recipes.pdfUpload");
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
    progress: 0,
    message: "",
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate file type
  const validateFileType = (file: File): boolean => {
    return SUPPORTED_FORMATS.includes(file.type);
  };

  // Validate file size
  const validateFileSize = (file: File): boolean => {
    const maxSizeBytes = maxFileSize * 1024 * 1024;
    return file.size <= maxSizeBytes;
  };

  // Validate PDF page count (estimate based on file size)
  const validatePDFPages = async (file: File): Promise<boolean> => {
    // This is a rough estimation - actual page count would require PDF parsing
    // For now, we'll use file size as a proxy (average 50KB per page)
    const estimatedPages = Math.ceil(file.size / (50 * 1024));
    return estimatedPages <= maxPages;
  };

  // Comprehensive file validation
  const validateFile = async (
    file: File
  ): Promise<{ isValid: boolean; error?: string }> => {
    // Check file type
    if (!validateFileType(file)) {
      return {
        isValid: false,
        error: t("errors.invalidFormat"),
      };
    }

    // Check file size
    if (!validateFileSize(file)) {
      return {
        isValid: false,
        error: t("errors.fileTooLarge", { maxSize: maxFileSize }),
      };
    }

    // Check estimated page count
    const isPagesValid = await validatePDFPages(file);
    if (!isPagesValid) {
      return {
        isValid: false,
        error: t("errors.tooManyPages", { maxPages }),
      };
    }

    return { isValid: true };
  };

  // Upload PDF to backend and process with Document AI
  const uploadPDFAndProcess = async (
    file: File
  ): Promise<ExtractedRecipeData | null> => {
    // Phase 1: Upload (0-30%)
    setUploadState((prev) => ({
      ...prev,
      status: "uploading",
      progress: 0,
      message: t("status.uploading"),
    }));

    // Create form data
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Simulate upload progress
      for (let i = 0; i <= 30; i += 5) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setUploadState((prev) => ({ ...prev, progress: i }));
      }

      // Phase 2: Processing with Document AI (30-80%)
      setUploadState((prev) => ({
        ...prev,
        status: "processing",
        message: t("status.extractingText"),
        progress: 30,
      }));

      // Call backend API
      const response = await fetch("/api/recipes/import/document", {
        method: "POST",
        body: formData,
      });

      // Simulate processing progress
      for (let i = 40; i <= 70; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setUploadState((prev) => ({ ...prev, progress: i }));
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to process PDF");
      }

      // Phase 3: Analyzing content (80-95%)
      setUploadState((prev) => ({
        ...prev,
        status: "analyzing",
        message: t("status.analyzingContent"),
        progress: 80,
      }));

      for (let i = 85; i <= 95; i += 5) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setUploadState((prev) => ({ ...prev, progress: i }));
      }

      // Phase 4: Complete (95-100%)
      setUploadState((prev) => ({
        ...prev,
        status: "success",
        message: t("status.complete"),
        progress: 100,
      }));

      // Return extracted data if available
      if (result.success && result.data) {
        return {
          title: result.data.title,
          description: result.data.description,
          ingredients: result.data.ingredients,
          instructions: result.data.instructions,
          prepTime: result.data.prepTime,
          cookTime: result.data.cookTime,
          servings: result.data.servings,
        };
      }

      return null;
    } catch (error) {
      console.error("PDF processing error:", error);
      throw new Error(
        error instanceof Error ? error.message : t("errors.processingFailed")
      );
    }
  };

  // Handle file processing
  const processFile = async (file: File) => {
    if (disabled) return;

    setUploadState({
      status: "validating",
      progress: 0,
      message: t("status.validating"),
      file,
    });

    try {
      // Validate the file
      const validation = await validateFile(file);
      if (!validation.isValid) {
        setUploadState({
          status: "error",
          progress: 0,
          message: validation.error || t("errors.validationFailed"),
        });
        onUploadError?.(validation.error || t("errors.validationFailed"));
        toast.error(validation.error || t("errors.validationFailed"));
        return;
      }

      // Upload and process the PDF
      const extractedData = await uploadPDFAndProcess(file);

      // Notify parent component
      onPDFUploaded?.({
        file,
        extractedData: extractedData || undefined,
      });

      if (extractedData) {
        toast.success(t("extractionSuccess"));
      } else {
        toast.warning(
          "PDF uploaded but could not extract recipe data automatically"
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t("errors.processingFailed");
      setUploadState({
        status: "error",
        progress: 0,
        message: errorMessage,
      });
      onUploadError?.(errorMessage);
      toast.error(errorMessage);
    }
  };

  // Handle drag and drop events
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        processFile(files[0]);
      }
    },
    [disabled]
  );

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  // Open file picker
  const openFilePicker = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  // Reset upload state
  const resetUpload = () => {
    setUploadState({
      status: "idle",
      progress: 0,
      message: "",
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Render status icon
  const renderStatusIcon = () => {
    switch (uploadState.status) {
      case "validating":
      case "uploading":
      case "processing":
      case "analyzing":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_FORMATS.join(",")}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Main upload area */}
      <Card
        className={cn(
          "border-2 border-dashed transition-all duration-200 cursor-pointer",
          isDragOver && !disabled && "border-primary bg-primary/5",
          uploadState.status === "success" && "border-green-500 bg-green-50",
          uploadState.status === "error" && "border-red-500 bg-red-50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={uploadState.status === "idle" ? openFilePicker : undefined}
      >
        <CardContent className="p-8">
          <div className="flex flex-col items-center space-y-4 text-center">
            {uploadState.file ? (
              // File indicator
              <div className="relative flex flex-col items-center space-y-2">
                <div className="w-16 h-16 rounded-lg bg-red-100 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-red-600" />
                </div>
                <div className="text-sm">
                  <p className="font-medium truncate max-w-48">
                    {uploadState.file.name}
                  </p>
                  <p className="text-muted-foreground">
                    {(uploadState.file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                {uploadState.status === "idle" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetUpload();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              // Upload icon
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
            )}

            {/* Status and instructions */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {renderStatusIcon()}
                <span className="font-medium">
                  {uploadState.message || t("dragAndDrop")}
                </span>
              </div>

              {uploadState.status === "idle" && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{t("clickToUpload")}</p>
                  <p>{t("supportedFormats")}: PDF</p>
                  <p>
                    {t("maxSize")}: {maxFileSize}MB, {t("maxPages")}: {maxPages}
                  </p>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {(uploadState.status === "uploading" ||
              uploadState.status === "processing" ||
              uploadState.status === "analyzing" ||
              uploadState.status === "validating") && (
              <div className="w-full space-y-2">
                <Progress value={uploadState.progress} className="w-full" />
                <p className="text-sm text-muted-foreground">
                  {uploadState.progress}% {t("complete")}
                </p>
              </div>
            )}

            {/* Action buttons */}
            {uploadState.status === "success" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={resetUpload}>
                  {t("uploadAnother")}
                </Button>
              </div>
            )}

            {uploadState.status === "error" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={resetUpload}>
                  {t("tryAgain")}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error alert */}
      {uploadState.status === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{uploadState.message}</AlertDescription>
        </Alert>
      )}

      {/* Success alert */}
      {uploadState.status === "success" && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-700">
            {t("extractionSuccess")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
