import "next-auth";

declare module "next-auth" {
  interface Session {
    idleExpires?: number;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sessionVersion?: number;
    lastActivity?: number;
  }
}
