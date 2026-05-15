import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",  type: "email" },
        password: { label: "Şifrə", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email və şifrə tələb olunur");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error("İstifadəçi tapılmadı");
        }

        if (user.active === false) {
          throw new Error("Hesabınız deaktiv edilib");
        }

        if (!user.password) {
          throw new Error("Bu hesab Google ilə qeydiyyatdan keçib. Google ilə daxil olun.");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Şifrə yanlışdır");
        }

        return {
          id:        user.id,
          name:      user.name,
          email:     user.email,
          role:      user.role,
          image:     user.image,
          teacherId: (user as any).teacherId ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Google ilə giriş zamanı istifadəçi mövcud deyilsə avtomatik yaradılır (adapter edir)
      // Mövcuddursa active yoxlanır
      if (account?.provider === "google") {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });
        if (dbUser && dbUser.active === false) {
          return false; // deaktiv hesab
        }
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role      = (user as any).role;
        token.id        = user.id;
        token.teacherId = (user as any).teacherId ?? null;
      }

      if (trigger === "update" || (!user && token.id)) {
        try {
          const dbUser = await prisma.user.findUnique({
            where:  { id: token.id as string },
            select: { role: true, active: true, teacherId: true },
          });
          if (dbUser) {
            token.role      = dbUser.role;
            token.teacherId = (dbUser as any).teacherId ?? null;
          }
        } catch {
          // DB xətası olsa köhnə token-i saxla
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role      = token.role;
        (session.user as any).id        = token.id;
        (session.user as any).teacherId = token.teacherId ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/giris",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
