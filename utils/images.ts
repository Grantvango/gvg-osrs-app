import * as FileSystem from 'expo-file-system';
import { getImageConfig, ImageType, getImageUrl } from './imageConfig';

const IMAGE_CACHE_DIRECTORY = `${FileSystem.cacheDirectory}images/`;
const IMAGE_CACHE_EXPIRY = 1000 * 60 * 60 * 24 * 7; // 7 days for images

// Ensure cache directory exists
export const ensureCacheDirectory = async (): Promise<void> => {
	const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIRECTORY);
	if (!dirInfo.exists) {
		await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIRECTORY, {
			intermediates: true,
		});
	}
};

// Get cached image URI or download and cache it
export const getCachedImageUri = async (itemId: string): Promise<string> => {
	await ensureCacheDirectory();

	// Get current image configuration
	const config = await getImageConfig();

	// Use different filenames for normal vs detailed images
	const filePrefix = config.type === ImageType.DETAILED ? 'detailed_' : 'item_';
	const fileExtension = config.type === ImageType.DETAILED ? '.png' : '.gif';
	const fileName = `${filePrefix}${itemId}${fileExtension}`;
	const filePath = `${IMAGE_CACHE_DIRECTORY}${fileName}`;

	const fileInfo = await FileSystem.getInfoAsync(filePath);

	// If file exists and is not expired, return it
	if (fileInfo.exists) {
		const now = Date.now();
		if (
			fileInfo.modificationTime &&
			now - fileInfo.modificationTime * 1000 < IMAGE_CACHE_EXPIRY
		) {
			return filePath;
		}
	}

	// Download and cache the image
	const remoteUri = await getImageUrl(itemId);
	try {
		await FileSystem.downloadAsync(remoteUri, filePath);
		return filePath;
	} catch (error) {
		console.error(`Error caching image for item ${itemId}:`, error);
		// Return remote URI as fallback
		return remoteUri;
	}
};

// Prefetch and cache multiple images in the background
export const prefetchItemImages = async (itemIds: string[]): Promise<void> => {
	try {
		await ensureCacheDirectory();
		const config = await getImageConfig();

		// Process in batches to avoid overwhelming the system
		const batchSize = 10;
		for (let i = 0; i < itemIds.length; i += batchSize) {
			const batch = itemIds.slice(i, i + batchSize);
			await Promise.all(
				batch.map(async (id) => {
					const filePrefix =
						config.type === ImageType.DETAILED ? 'detailed_' : 'item_';
					const fileExtension =
						config.type === ImageType.DETAILED ? '.png' : '.gif';
					const fileName = `${filePrefix}${id}${fileExtension}`;
					const filePath = `${IMAGE_CACHE_DIRECTORY}${fileName}`;
					const fileInfo = await FileSystem.getInfoAsync(filePath);

					// Skip if already cached and not expired
					if (fileInfo.exists) {
						const now = Date.now();
						if (
							fileInfo.modificationTime &&
							now - fileInfo.modificationTime * 1000 < IMAGE_CACHE_EXPIRY
						) {
							return;
						}
					}

					// Download and cache
					const remoteUri = await getImageUrl(id);
					await FileSystem.downloadAsync(remoteUri, filePath);
				})
			);
		}
		console.log(`Prefetched ${itemIds.length} images`);
	} catch (error) {
		console.error('Error prefetching images:', error);
	}
};

// Clear expired images from cache
export const clearExpiredImages = async (): Promise<void> => {
	try {
		await ensureCacheDirectory();
		const files = await FileSystem.readDirectoryAsync(IMAGE_CACHE_DIRECTORY);
		const now = Date.now();

		for (const file of files) {
			const filePath = `${IMAGE_CACHE_DIRECTORY}${file}`;
			const fileInfo = await FileSystem.getInfoAsync(filePath);

			if (
				fileInfo.modificationTime &&
				now - fileInfo.modificationTime * 1000 > IMAGE_CACHE_EXPIRY
			) {
				await FileSystem.deleteAsync(filePath);
			}
		}
	} catch (error) {
		console.error('Error clearing expired images:', error);
	}
};

// Clear all image cache (used when switching image types)
export const clearAllImageCache = async (): Promise<void> => {
	try {
		await ensureCacheDirectory();
		const files = await FileSystem.readDirectoryAsync(IMAGE_CACHE_DIRECTORY);

		for (const file of files) {
			const filePath = `${IMAGE_CACHE_DIRECTORY}${file}`;
			await FileSystem.deleteAsync(filePath);
		}
		console.log('Cleared all image cache');
	} catch (error) {
		console.error('Error clearing image cache:', error);
	}
};
