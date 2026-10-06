export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  mediaUrl: process.env.NEXT_PUBLIC_MEDIA_URL ?? 'http://localhost:9000/dating-media',
} as const;
