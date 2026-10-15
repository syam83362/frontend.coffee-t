import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	allowedDevOrigins: ['172.26.57.40'],
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'images.unsplash.com',
			},
		],
	},
};

export default nextConfig;