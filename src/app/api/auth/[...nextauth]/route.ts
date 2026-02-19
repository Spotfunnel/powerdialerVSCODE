import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = (req: any, res: any) => {
    console.log(`[AUTH-ROUTE] ${req.method} ${req.url}`);
    return NextAuth(authOptions)(req, res);
};

export { handler as GET, handler as POST };
