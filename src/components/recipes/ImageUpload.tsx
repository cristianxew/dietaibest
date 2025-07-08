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
  FileImage,
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

interface ImageUploadProps {
  onImageUploaded?: (imageData: {
    file: File;
    preview: string;
    extractedData?: ExtractedRecipeData;
  }) => void;
  onUploadError?: (error: string) => void;
  maxFileSize?: number; // in MB
  maxWidth?: number;
  maxHeight?: number;
  disabled?: boolean;
}

interface UploadState {
  status:
    | "idle"
    | "validating"
    | "uploading"
    | "processing"
    | "success"
    | "error";
  progress: number;
  message: string;
  file?: File;
  preview?: string;
}

const SUPPORTED_FORMATS = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const DEFAULT_MAX_SIZE = 10; // 10MB
const DEFAULT_MAX_WIDTH = 4000;
const DEFAULT_MAX_HEIGHT = 4000;

export function ImageUpload({
  onImageUploaded,
  onUploadError,
  maxFileSize = DEFAULT_MAX_SIZE,
  maxWidth = DEFAULT_MAX_WIDTH,
  maxHeight = DEFAULT_MAX_HEIGHT,
  disabled = false,
}: ImageUploadProps) {
  const t = useTranslations("recipes.imageUpload");
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

  // Validate image dimensions
  const validateImageDimensions = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        const isValid = img.width <= maxWidth && img.height <= maxHeight;
        resolve(isValid);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(false);
      };

      img.src = url;
    });
  };

  // Comprehensive file validation
  const validateFile = async (
    file: File
  ): Promise<{ isValid: boolean; error?: string }> => {
    // Check file type
    if (!validateFileType(file)) {
      return {
        isValid: false,
        error: t("errors.invalidFormat", {
          formats: SUPPORTED_FORMATS.map((f) =>
            f.split("/")[1].toUpperCase()
          ).join(", "),
        }),
      };
    }

    // Check file size
    if (!validateFileSize(file)) {
      return {
        isValid: false,
        error: t("errors.fileTooLarge", { maxSize: maxFileSize }),
      };
    }

    // Check image dimensions
    const isDimensionsValid = await validateImageDimensions(file);
    if (!isDimensionsValid) {
      return {
        isValid: false,
        error: t("errors.dimensionsTooLarge", {
          maxWidth,
          maxHeight,
        }),
      };
    }

    return { isValid: true };
  };

  // Upload image to backend and process with OCR
  const uploadImageAndProcess = async (
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

      // Phase 2: Processing with OCR (30-90%)
      setUploadState((prev) => ({
        ...prev,
        status: "processing",
        message: t("status.extractingText"),
        progress: 30,
      }));

      // Call backend API
      const response = await fetch("/api/recipes/import/image", {
        method: "POST",
        body: formData,
      });

      // Simulate processing progress
      for (let i = 40; i <= 90; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setUploadState((prev) => ({ ...prev, progress: i }));
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to process image");
      }

      // Phase 3: Finalizing (90-100%)
      setUploadState((prev) => ({
        ...prev,
        message: t("status.finalizing"),
        progress: 90,
      }));

      await new Promise((resolve) => setTimeout(resolve, 500));
      setUploadState((prev) => ({ ...prev, progress: 100 }));

      // Success
      setUploadState((prev) => ({
        ...prev,
        status: "success",
        message: t("status.success"),
      }));

      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach((warning: string) => {
          toast.warning(warning);
        });
      }

      // Return extracted data if available
      if (result.data && result.data.title) {
        return {
          title: result.data.title,
          description: result.data.description,
          ingredients: result.data.ingredients || [],
          instructions: result.data.instructions || [],
          prepTime: result.data.prepTime,
          cookTime: result.data.cookTime,
          servings: result.data.servings,
        };
      }

      return null;
    } catch (error) {
      throw error;
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

      // Create preview
      const preview = URL.createObjectURL(file);
      setUploadState((prev) => ({ ...prev, preview }));

      // Upload and process the image
      const extractedData = await uploadImageAndProcess(file);

      // Notify parent component
      onImageUploaded?.({
        file,
        preview,
        extractedData: extractedData || undefined,
      });

      if (extractedData) {
        toast.success(t("extractionSuccess"));
      } else {
        toast.warning(
          "Image uploaded but could not extract recipe data automatically"
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
    if (uploadState.preview) {
      URL.revokeObjectURL(uploadState.preview);
    }
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
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <FileImage className="h-5 w-5 text-muted-foreground" />;
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
            {uploadState.preview ? (
              // Image preview
              <div className="relative">
                <img
                  src={uploadState.preview}
                  alt="Preview"
                  className="max-w-full max-h-48 rounded-lg object-contain"
                />
                {uploadState.status === "idle" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
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
                  <p>{t("supportedFormats")}: JPEG, PNG, WebP</p>
                  <p>
                    {t("maxSize")}: {maxFileSize}MB, {t("maxDimensions")}:{" "}
                    {maxWidth}x{maxHeight}px
                  </p>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {(uploadState.status === "uploading" ||
              uploadState.status === "processing" ||
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
