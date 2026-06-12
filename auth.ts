import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import { getUserFromDb } from "./utils/db"
import { loginSchema } from "./lib/zod"
import { ZodError } from "zod"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        token: {},
        user: {},
      },
      authorize: async (credentials) => {
        try {
          // If token and user are provided (from our custom login flow), use them
          if (credentials.token && credentials.user) {
            const user = credentials.user as any
            return {
              id: user.id || '1',
              email: credentials.email as string,
              name: user.name || credentials.email,
              token: credentials.token,
              ...user
            } as any
          }

          // Fallback to original flow for backward compatibility
          const { email, password } = await loginSchema.parseAsync(credentials)
          const user = await getUserFromDb(email, password)

          if (!user) {
            return null
          }
          return user
        } 
        catch (error) {
          if (error instanceof ZodError) {
            return null
          }
          return null
        }
      }
    }),
    
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true, // Required for production deployments (VPS, Vercel, etc.)
  // Untuk VPS, pastikan NEXTAUTH_URL diset dengan benar di environment variables
  // Contoh: NEXTAUTH_URL=https://oneprox.id
  // Jangan gunakan trailing slash di akhir URL
  pages: {
    signIn: '/auth/login',
  },
  // Konfigurasi untuk mengatasi CSRF error di production
  useSecureCookies: process.env.NODE_ENV === "production",
  // Konfigurasi cookies eksplisit untuk production
  cookies: process.env.NODE_ENV === "production" ? {
    sessionToken: {
      name: `authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true, // Hanya di production (HTTPS)
      },
    },
    csrfToken: {
      name: `authjs.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
      },
    },
  } : undefined,
})