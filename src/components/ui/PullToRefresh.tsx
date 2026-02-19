"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSwipeable } from "react-swipeable";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { RefreshCw } from "lucide-react";

interface PullToRefreshProps {
    children: React.ReactNode;
    onRefresh?: () => Promise<void>;
    threshold?: number;
}

export function PullToRefresh({
    children,
    onRefresh,
    threshold = 80
}: PullToRefreshProps) {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isAtTop, setIsAtTop] = useState(true);
    const controls = useAnimation();

    const handleScroll = useCallback(() => {
        setIsAtTop(window.scrollY === 0);
    }, []);

    useEffect(() => {
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [handleScroll]);

    const performRefresh = async () => {
        setIsRefreshing(true);
        setPullDistance(0);

        if (onRefresh) {
            await onRefresh();
        } else {
            // Standard PWA refresh behavior
            window.location.reload();
        }

        // If we didn't reload, reset state
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const handlers = useSwipeable({
        onSwiping: (e) => {
            if (!isAtTop || isRefreshing || e.dir !== "Down") return;

            // Apply resistance
            const distance = Math.min(e.deltaY * 0.4, threshold + 20);
            setPullDistance(distance);
        },
        onSwipedDown: (e) => {
            if (!isAtTop || isRefreshing) return;

            if (pullDistance >= threshold) {
                performRefresh();
            } else {
                setPullDistance(0);
            }
        },
        trackMouse: false,
        preventScrollOnSwipe: pullDistance > 0,
    });

    return (
        <div {...handlers} className="relative w-full h-full touch-pan-x">
            {/* Pull Indicator */}
            <div
                className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-50"
                style={{ height: pullDistance }}
            >
                <AnimatePresence>
                    {(pullDistance > 10 || isRefreshing) && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.5 }}
                            animate={{
                                opacity: 1,
                                y: isRefreshing ? 20 : Math.min(pullDistance - 30, 20),
                                scale: 1,
                                rotate: isRefreshing ? 360 : (pullDistance / threshold) * 180
                            }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{
                                rotate: isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : { type: "spring", stiffness: 200 }
                            }}
                            className="bg-white text-teal-600 p-2 rounded-full shadow-xl border border-teal-100/50 flex items-center justify-center h-10 w-10 sticky top-4"
                        >
                            <RefreshCw className="h-5 w-5" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Content Wrapper */}
            <motion.div
                animate={{ y: isRefreshing ? 60 : pullDistance }}
                transition={pullDistance === 0 ? { type: "spring", stiffness: 300, damping: 30 } : { duration: 0 }}
                className="w-full h-full"
            >
                {children}
            </motion.div>
        </div>
    );
}
