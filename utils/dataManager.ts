import {
	getItemMapping,
	setItemMapping,
	getLatestPrices,
	setLatestPrices,
	shouldRefreshData,
	markDataRefreshed,
} from './cache';
import { prefetchItemImages } from './images';
import { getImageConfig } from './imageConfig';

/**
 * Initialize data for the app
 * This function should be called when the app starts
 */
export const initializeAppData = async (): Promise<void> => {
	try {
		console.log('Initializing app data...');

		// First check if we already have cached data
		const cachedPrices = await getLatestPrices();
		const cachedMapping = await getItemMapping();

		// Load image config to ensure it's initialized
		await getImageConfig();

		// If we have no cached data, we need to fetch it
		if (!cachedPrices || !cachedMapping) {
			console.log('No cached data found, fetching initial data...');
			await refreshAllData();
			return;
		}

		// Check if we need to refresh data (it's been 24 hours)
		const needsRefresh = await shouldRefreshData();

		if (needsRefresh) {
			console.log('Daily refresh needed, fetching new data...');
			// Use a timeout to not block the UI thread
			setTimeout(() => {
				refreshAllData().catch((err) =>
					console.error('Background refresh failed:', err)
				);
			}, 2000);
		} else {
			console.log('Using cached data (last refresh was within 24 hours)');
		}
	} catch (error) {
		console.error('Error initializing app data:', error);
		throw error; // Re-throw to let the caller handle it
	}
};

/**
 * Refresh all app data from API sources
 */
export const refreshAllData = async (): Promise<void> => {
	try {
		// Add timeout between requests to prevent overwhelming the API
		const fetchWithTimeout = async (url: string, timeout = 10000) => {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);

			try {
				const response = await fetch(url, { signal: controller.signal });
				clearTimeout(timeoutId);
				return response;
			} catch (err) {
				clearTimeout(timeoutId);
				throw err;
			}
		};

		// Fetch latest prices
		const priceResponse = await fetchWithTimeout(
			'https://prices.runescape.wiki/api/v1/osrs/latest'
		);

		if (!priceResponse.ok) {
			throw new Error(`Price API responded with ${priceResponse.status}`);
		}

		const priceData = await priceResponse.json();
		await setLatestPrices(priceData);

		// Wait a bit before next request
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Fetch mapping data
		const mappingResponse = await fetchWithTimeout(
			'https://prices.runescape.wiki/api/v1/osrs/mapping'
		);

		if (!mappingResponse.ok) {
			throw new Error(`Mapping API responded with ${mappingResponse.status}`);
		}

		const mappingData = await mappingResponse.json();
		await setItemMapping(mappingData);

		// Prefetch images for popular/important items
		// This could be a subset of all items to save storager
		const topItemIds = Object.keys(priceData.data)
			.slice(0, 50) // Reduced from 100 to 50 to be faster
			.filter((id) => {
				const price = priceData.data[id];
				return price.high > 0 && price.low > 0;
			});

		// Set a timeout to prefetch images after the app is loaded
		setTimeout(() => {
			prefetchItemImages(topItemIds).catch((err) =>
				console.error('Error prefetching images:', err)
			);
		}, 5000);

		// Mark that we've refreshed the data
		await markDataRefreshed();

		console.log('All data refreshed successfully');
	} catch (error) {
		console.error('Error refreshing all data:', error);
		throw error;
	}
};
