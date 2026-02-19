"use client";

import React, { useState, useEffect } from "react";
import { Smartphone, RotateCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function OrientationLock() {
    const [isLandscape, setIsLandscape] = useState(false);

    useEffect(() => {
        const checkOrientation = () => {
            // Check if mobile and landscape
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const landscape = window.innerWidth > window.innerHeight && isMobile;
            setIsLandscape(landscape);
        };

        checkOrientation();
        window.addEventListener("resize", checkOrientation);
        window.addEventListener("orientationchange", checkOrientation);

        return () => {
            window.removeEventListener("resize", checkOrientation);
            window.removeEventListener("orientationchange", checkOrientation);
        };
    }, []);

    return (
        <AnimatePresence>
            {isLandscape && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center text-white p-8 text-center"
                >
                    <motion.div
                        animate={{ rotate: [0, -90, 0] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        className="mb-8 bg-teal-500/10 p-6 rounded-3xl border border-teal-500/20"
                    >
                        <Smartphone className="h-16 w-16 text-teal-400" />
                    </motion.div>

                    <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-4">
                        Portrait Only
                    </h2>

                    <p className="text-slate-400 font-medium max-w-xs leading-relaxed">
                        The PowerDialer interface is optimized for vertical use. Please rotate your device to continue.
                    </p>

                    <div className="mt-12 flex items-center gap-3 text-teal-400/50 text-[10px] font-black uppercase tracking-[0.2em]">
                        <RotateCw className="h-3 w-3 animate-spin-slow" />
                        System Locked
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
