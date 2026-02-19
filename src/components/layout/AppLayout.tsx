import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";
import { PullToRefresh } from "../ui/PullToRefresh";
import { OrientationLock } from "../ui/OrientationLock";


const NOISE_TEXTURE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;


export function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col lg:flex-row h-screen lg:h-[100dvh] bg-[#FDFDFD] overflow-hidden font-sans antialiased text-black">
            <OrientationLock />

            {/* Arctic Atmosphere: Extremely Clean & Professional */}
            <div className="fixed inset-0 pointer-events-none -z-10 bg-white">
                {/* Minimalist Texture */}
                <div className="absolute inset-0 opacity-[0.03] mix-blend-multiply" style={{ backgroundImage: NOISE_TEXTURE }}></div>
            </div>

            {/* Desktop Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="flex-1 relative overflow-hidden pb-4 lg:pb-0">
                <PullToRefresh>
                    <div className="h-full overflow-auto custom-scrollbar">
                        {children}
                    </div>
                </PullToRefresh>
            </main>
        </div>
    );
}
