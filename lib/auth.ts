import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * NextAuth configuration.
 *
 * Supports two auth strategies:
 *  1. Credentials — email + bcrypt-hashed password stored in the User table.
 *  2. Google OAuth — delegates to Google; we store the OAuth account in the
 *     Account table via the Prisma adapter.
 *
 * Sessions are JWT-based (not DB sessions) so we can validate them on the
 * edge in middleware without a DB round-trip.
 */
export const authOptions: NextAuthOptions = {
  // Cast required because @auth/prisma-adapter v1 types differ slightly from
  // next-auth v4 Adapter type — functionally compatible at runtime.
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          throw new Error("EMAIL_PASSWORD_REQUIRED");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password_hash) {
          throw new Error("INVALID_CREDENTIALS");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );

        if (!isValid) {
          throw new Error("INVALID_CREDENTIALS");
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],

  callbacks: {
    /**
     * Persist the user's database ID into the JWT so downstream
     * code can look up the user without another DB query.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    /**
     * Expose the user ID on the session object so server components
     * and API routes can access it via `session.user.id`.
     */
    async session({ session, token }) {
      if (token?.id && session.user) {
        (session.user as { id: string } & typeof session.user).id =
          token.id as string;
      }
      return session;
    },
  },
};
