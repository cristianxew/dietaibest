"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Send, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  onSend: (text: string, file?: File) => void;
  initialValue?: string;
  disabled?: boolean;
}

export function ChatComposer({ onSend, initialValue = "", disabled = false }: ChatComposerProps) {
  const t = useTranslations("chat");
  const [text, setText] = useState(initialValue);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(initialValue);
  }, [initialValue]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSend = () => {
    if ((text.trim() || file) && !disabled) {
      onSend(text.trim(), file || undefined);
      setText("");
      setFile(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 10 * 1024 * 1024) {
        alert(t("attach.maxSize"));
        return;
      }
      setFile(selected);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type.startsWith("image/")) {
      if (droppedFile.size > 10 * 1024 * 1024) {
        alert(t("attach.maxSize"));
        return;
      }
      setFile(droppedFile);
    }
  };

  return (
    <div 
      className={cn(
        "p-4 border-t border-border bg-background relative",
        isDragging && "bg-brand-50/50 dark:bg-brand-900/10"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-brand-400 rounded-lg m-2">
          <p className="text-brand-600 dark:text-brand-400 font-medium">{t("attach.dropImage")}</p>
        </div>
      )}

      {file && (
        <div className="mb-3 flex items-center gap-3 p-2 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 w-max pr-8 relative">
          <div className="w-10 h-10 rounded-md bg-stone-200 dark:bg-stone-700 overflow-hidden flex items-center justify-center shrink-0">
            {file.type.startsWith("image/") ? (
              <img 
                src={URL.createObjectURL(file)} 
                alt="Attachment preview" 
                className="w-full h-full object-cover"
              />
            ) : (
              <Paperclip className="w-5 h-5 text-stone-500" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
          <button
            onClick={() => setFile(null)}
            className="absolute top-1 right-1 p-1 rounded-full bg-stone-200/50 hover:bg-stone-300 dark:bg-stone-700/50 dark:hover:bg-stone-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className={cn(
        "flex items-end gap-2 p-2 rounded-2xl border transition-colors",
        "bg-card",
        text.trim() ? "border-brand-300 dark:border-brand-500/50" : "border-input",
        disabled && "opacity-50 cursor-not-allowed"
      )}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2 shrink-0 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors disabled:opacity-50"
          aria-label={t("attach")}
        >
          <Paperclip size={20} />
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
          />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={t("placeholder")}
          className="flex-1 max-h-[120px] min-h-[24px] py-2 bg-transparent resize-none focus:outline-none text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed"
          rows={1}
        />

        <button
          onClick={handleSend}
          disabled={(!text.trim() && !file) || disabled}
          className={cn(
            "p-2 shrink-0 rounded-xl transition-all duration-200",
            (text.trim() || file) && !disabled
              ? "bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:-translate-y-0.5"
              : "bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-600"
          )}
          aria-label={t("send")}
        >
          <Send size={18} className={cn((text.trim() || file) && !disabled ? "translate-x-0.5" : "")} />
        </button>
      </div>
    </div>
  );
}
