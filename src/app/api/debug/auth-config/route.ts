import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

export async function GET() {
    try {
        // Check auth configuration
        const config = {
            hasAdapter: !!(authOptions as any).adapter,
            providersCount: authOptions.providers?.length || 0,
            providerTypes: authOptions.providers?.map((p: any) => p.id || p.name) || [],
            sessionStrategy: authOptions.session?.strategy || 'jwt',
            hasJwtCallback: !!authOptions.callbacks?.jwt,
            hasSessionCallback: !!authOptions.callbacks?.session,
            hasRedirectCallback: !!authOptions.callbacks?.redirect,
            pagesSignIn: authOptions.pages?.signIn,
            debug: (authOptions as any).debug,
        };

        return NextResponse.json({
            status: 'ok',
            config,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            error: error.message,
            stack: error.stack,
        }, { status: 500 });
    }
}
