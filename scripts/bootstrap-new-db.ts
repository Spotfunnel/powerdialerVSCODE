/**
 * One-shot bootstrap for a fresh/replacement Postgres (Supabase) project.
 *
 * Context: Supabase project `lxsxwrunbmoiayhtexiz` stopped resolving — its
 * pooler reports "tenant/user not found" in every region and
 * db.<ref>.supabase.co is NXDOMAIN, i.e. paused or deleted. Everything the app
 * needs at rest lived in that database, including the Twilio credentials
 * (Settings singleton) which are NOT mirrored into any env var.
 *
 * Run order for a cutover:
 *   1. Put the new connection strings in .env (POSTGRES_PRISMA_URL + POSTGRES_URL_NON_POOLING)
 *   2. npx prisma db push          # creates the schema (repo has no migrations dir)
 *   3. npx tsx scripts/bootstrap-new-db.ts
 *
 * Idempotent: safe to re-run. Creates nothing it cannot upsert.
 */

import 'dotenv/config';
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({ log: ["error"] });

function mask(url: string | undefined) {
    return (url ?? "(unset)").replace(/:([^:@/]+)@/, ":****@");
}

async function verifyConnection() {
    console.log("\n[1/4] Verifying connection");
    console.log(`      pooled: ${mask(process.env.POSTGRES_PRISMA_URL)}`);
    console.log(`      direct: ${mask(process.env.POSTGRES_URL_NON_POOLING)}`);
    const t0 = Date.now();
    await prisma.$queryRawUnsafe(`select 1`);
    console.log(`      OK (${Date.now() - t0}ms)`);
}

async function verifySchema() {
    console.log("\n[2/4] Verifying schema");
    const rows = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
        `select table_name from information_schema.tables where table_schema = 'public' order by table_name`
    );
    if (rows.length === 0) {
        throw new Error("No tables in `public`. Run `npx prisma db push` first.");
    }
    console.log(`      ${rows.length} tables: ${rows.map(r => r.table_name).join(", ")}`);
}

async function ensureAdminUser() {
    console.log("\n[3/4] Ensuring admin user");
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        console.log("      SKIPPED — set BOOTSTRAP_ADMIN_EMAIL (and BOOTSTRAP_ADMIN_PASSWORD");
        console.log("      or reuse ADMIN_PASSWORD) to create a login.");
        return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
        where: { email },
        update: { passwordHash, role: "ADMIN" },
        create: { email, passwordHash, role: "ADMIN", name: email.split("@")[0] },
    });
    console.log(`      ${user.email} (role=${user.role}, id=${user.id}) — password set`);
}

async function reportGaps() {
    console.log("\n[4/4] Post-restore inventory");
    const [users, leads, calls, numbers, settings] = await Promise.all([
        prisma.user.count(),
        prisma.lead.count(),
        prisma.call.count(),
        prisma.numberPool.count(),
        prisma.settings.count(),
    ]);
    console.log(`      User        ${users}`);
    console.log(`      Lead        ${leads}`);
    console.log(`      Call        ${calls}`);
    console.log(`      NumberPool  ${numbers}`);
    console.log(`      Settings    ${settings}`);

    const todo: string[] = [];
    if (settings === 0) {
        todo.push(
            "Settings is empty — the dialer cannot place calls without Twilio creds.\n" +
            "        These were only ever stored in the DB, not in env. Recover the\n" +
            "        Account SID / Auth Token / TwiML App SID from console.twilio.com,\n" +
            "        export TWILIO_* vars, then run: npx tsx scripts/seed-settings.ts"
        );
    }
    if (numbers === 0) {
        todo.push("NumberPool is empty — outbound number rotation has nothing to select from.");
    }
    if (leads === 0) {
        todo.push("Lead is empty — re-import via /import or scripts/import-sms-csvs.ts.");
    }

    if (todo.length === 0) {
        console.log("\n      Nothing outstanding.");
        return;
    }
    console.log("\n      OUTSTANDING:");
    for (const t of todo) console.log(`      - ${t}`);
}

async function main() {
    await verifyConnection();
    await verifySchema();
    await ensureAdminUser();
    await reportGaps();
    console.log("\nBootstrap complete.\n");
}

main()
    .catch(err => {
        console.error(`\nFAILED: ${err?.message ?? err}\n`);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
