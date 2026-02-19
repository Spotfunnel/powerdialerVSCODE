
import { NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
    // NOTE: PrismaAdapter is NOT compatible with CredentialsProvider
    // Credentials auth uses JWT strategy, not database sessions
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                console.log('[AUTH] Authorize called with email:', credentials?.email);
                console.log('[AUTH] Raw credentials:', JSON.stringify(credentials));

                if (!credentials?.email || !credentials?.password) {
                    console.log('[AUTH] Missing credentials');
                    return null;
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email }
                });

                if (!user) {
                    console.log('[AUTH] User not found:', credentials.email);
                    return null;
                }

                console.log('[AUTH] User found:', user.email, 'ID:', user.id);
                console.log('[AUTH] Has password hash:', !!user.passwordHash, 'Length:', user.passwordHash?.length);

                const passwordMatch = await bcrypt.compare(credentials.password, user.passwordHash);

                console.log('[AUTH] Password match:', passwordMatch);

                if (!passwordMatch) {
                    console.log('[AUTH] Password mismatch');
                    return null;
                }

                console.log('[AUTH] Authorization successful for:', user.email);
                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    repPhoneNumber: user.repPhoneNumber,
                };
            }
        })
    ],
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (trigger === "update" && session) {
                return { ...token, ...session.user };
            }

            if (user) {
                token.role = (user as any).role;
                token.repPhoneNumber = (user as any).repPhoneNumber;
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = token.role;
                (session.user as any).repPhoneNumber = token.repPhoneNumber;
                (session.user as any).id = token.id;
            }
            return session;
        },
        async redirect({ url, baseUrl }) {
            console.log('[AUTH] Redirect callback called with:', { url, baseUrl });

            // Ensure baseUrl is a valid URL or fallback to something safe
            let safeBaseUrl = baseUrl;
            try {
                new URL(baseUrl);
            } catch (e) {
                console.error('[AUTH] Invalid baseUrl in redirect callback:', baseUrl);
                // In production, try to use the current protocol/host if possible, 
                // but usually baseUrl is provided by NextAuth from NEXTAUTH_URL
            }

            // Handle both production domains
            const allowedDomains = [
                'https://powerdialer.vercel.app',
                'https://powerdialer-two.vercel.app',
                'https://www.getspotfunnel.com',
                'https://getspotfunnel.com',
                'http://localhost:3000',
                'http://localhost:9000'
            ];

            // If URL is just the base or login page, redirect to dialer
            // We check for endsWith('/login') to catch subdomains but we should check if it's an allowed domain
            if (url === baseUrl || url.endsWith('/login') || url === '/login' || url === '/') {
                // Try to stay on the current domain if it's one of our allowed domains
                try {
                    const currentUrlObj = new URL(url, safeBaseUrl);
                    const matchingDomain = allowedDomains.find(domain =>
                        new URL(domain).origin === currentUrlObj.origin
                    );
                    if (matchingDomain) {
                        console.log('[AUTH] Staying on domain:', matchingDomain);
                        return matchingDomain + '/dialer';
                    }
                } catch (e) {
                    // Fallback to relative /dialer (uses baseUrl)
                }
                return '/dialer';
            }

            // Allow relative URLs (will use baseUrl)
            if (url.startsWith('/')) {
                return url;
            }

            // check for localhost and common local network IPs
            if (url.includes('localhost:') ||
                url.includes('127.0.0.1') ||
                /192\.168\.\d+\.\d+/.test(url) ||
                /172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+/.test(url) ||
                /10\.\d+\.\d+\.\d+/.test(url)) {
                return url;
            }

            // Check if URL is from an allowed domain
            try {
                // Pass baseUrl to handle relative URLs that somehow made it here
                const urlObj = new URL(url, safeBaseUrl);
                const isAllowed = allowedDomains.some(domain =>
                    urlObj.origin === new URL(domain).origin
                );

                if (isAllowed) {
                    return url;
                }
            } catch (e) {
                console.error('[AUTH] Error parsing URL in redirect callback:', url, e);
            }

            console.log('[AUTH] Redirect fell back to /dialer for URL:', url);
            return '/dialer';
        }
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    secret: process.env.NEXTAUTH_SECRET,
    debug: true, // Enable debug mode to see what's happening
};
