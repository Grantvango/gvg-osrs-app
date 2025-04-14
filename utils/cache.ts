import AsyncStorage from '@react-native-async-storage/async-storage';

// Updated to 24 hours instead of 15 minutes
const CACHE_EXPIRY = 1000 * 60 * 60 * 24; // 24 hours
const MAPPING_CACHE_KEY = 'osrs_item_mapping';
const LATEST_PRICES_CACHE_KEY = 'osrs_latest_prices';
const LAST_FULL_FETCH_KEY = 'osrs_last_full_fetch';
// New cache key for processed items
const PROCESSED_ITEMS_CACHE_KEY = 'osrs_processed_items';

export interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

export async function getCachedData<T>(key: string): Promise<T | null> {
	try {
		const cachedData = await AsyncStorage.getItem(key);
		if (!cachedData) return null;

		const entry: CacheEntry<T> = JSON.parse(cachedData);
		const now = Date.now();

		if (now - entry.timestamp > CACHE_EXPIRY) {
			// Cache expired
			return null;
		}

		return entry.data;
	} catch (error) {
		console.error('Error reading from cache:', error);
		return null;
	}
}

export async function setCachedData<T>(key: string, data: T): Promise<void> {
	try {
		const entry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
		};
		await AsyncStorage.setItem(key, JSON.stringify(entry));
	} catch (error) {
		console.error('Error writing to cache:', error);
	}
}

export async function getItemMapping(): Promise<any[] | null> {
	return getCachedData<any[]>(MAPPING_CACHE_KEY);
}

export async function setItemMapping(data: any[]): Promise<void> {
	return setCachedData(MAPPING_CACHE_KEY, data);
}

export async function getLatestPrices(): Promise<any | null> {
	return getCachedData<any>(LATEST_PRICES_CACHE_KEY);
}

export async function setLatestPrices(data: any): Promise<void> {
	return setCachedData(LATEST_PRICES_CACHE_KEY, data);
}

// New functions for processed items
export async function getProcessedItems(): Promise<any[] | null> {
	return getCachedData<any[]>(PROCESSED_ITEMS_CACHE_KEY);
}

export async function setProcessedItems(data: any[]): Promise<void> {
	return setCachedData(PROCESSED_ITEMS_CACHE_KEY, data);
}

// New functions for managing daily data fetching

export async function shouldRefreshData(): Promise<boolean> {
	try {
		const lastFetchStr = await AsyncStorage.getItem(LAST_FULL_FETCH_KEY);
		if (!lastFetchStr) return true;

		const lastFetch = parseInt(lastFetchStr, 10);
		const now = Date.now();
		const oneDayMs = 1000 * 60 * 60 * 24; // 24 hours in milliseconds

		// Return true if last fetch was more than 24 hours ago
		return now - lastFetch > oneDayMs;
	} catch (error) {
		console.error('Error checking last fetch time:', error);
		return true; // Default to refreshing if we can't determine
	}
}

export async function markDataRefreshed(): Promise<void> {
	try {
		const now = Date.now().toString();
		await AsyncStorage.setItem(LAST_FULL_FETCH_KEY, now);
	} catch (error) {
		console.error('Error marking data as refreshed:', error);
	}
}

export async function forceRefreshData(): Promise<void> {
	try {
		// Clear the timestamp to force a refresh
		await AsyncStorage.removeItem(LAST_FULL_FETCH_KEY);
	} catch (error) {
		console.error('Error forcing data refresh:', error);
	}
}
