"use client";

import { Modal } from "./modal";
import { Button } from "./button";

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "destructive";
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default"
}: ConfirmModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} width="max-w-sm">
            <div className="flex flex-col gap-6">
                <p className="text-zinc-600 text-sm leading-relaxed">
                    {description}
                </p>

                <div className="flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-800 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all active:scale-95 ${variant === 'destructive'
                                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                                : 'bg-teal-600 hover:bg-teal-500 shadow-teal-600/20'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
